// The corpus check:  all the rules fix the real files in `corpus/`, which must
// keep their code, their other comments, the code in their blocks, and every
// character but whitespace, and settle in one `--fix`.  What each rule finds
// and a hash of each fixed file are kept in `corpus/snapshot.json`, so any
// change to the formatting fails until `npm run corpus:update` updates it.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { after, test } from 'node:test';
import { Linter } from 'eslint';
import tseslint from 'typescript-eslint';

import plugin from '../lib/index.js';

const DIR = new URL('corpus/', import.meta.url);
const SNAPSHOT = new URL('snapshot.json', DIR);
const UPDATE = process.argv.includes('--update');

const linter = new Linter();
// Inline config is ignored, so each file is checked whole, and ESLint's own
// fix that removes an unused directive is off.
const config = [
  {
    files: ['**/*'],
    linterOptions: {
      noInlineConfig: true,
      reportUnusedDisableDirectives: 'off',
    },
    plugins: { 'jsdoc-flow': plugin },
    rules: Object.fromEntries(
      Object.keys(plugin.rules).map((r) => [`jsdoc-flow/${r}`, 'warn']),
    ),
  },
  { files: ['**/*.ts'], languageOptions: { parser: tseslint.parser } },
];

const files = readdirSync(DIR, { recursive: true })
  .map((f) => f.replaceAll('\\', '/'))
  .filter((f) => /\.(?:js|ts)$/.test(f))
  .sort();

/**
 * The file just linted:  its messages, code tokens, JSDoc blocks alone on
 * their lines, and other comments.
 */
const parse = (messages) => {
  const { ast, lines } = linter.getSourceCode();
  const alone = ({ loc: { start, end } }) =>
    !/\S/.test(lines[start.line - 1].slice(0, start.column)) &&
    !/\S/.test(lines[end.line - 1].slice(end.column));
  const jsdoc = (c) => c.type === 'Block' && /^\*(?!\*)/.test(c.value);
  return {
    messages,
    tokens: ast.tokens.map((t) => `${t.type} ${t.value}`),
    blocks: ast.comments.filter((c) => jsdoc(c) && alone(c)),
    others: ast.comments.filter((c) => !jsdoc(c) || !alone(c)),
  };
};

/**
 * The code in a multi-line block, past each line's star:  each fence, each
 * `@example` through the next tag, and each `<pre>` that closes.
 */
const codeOf = ({ value }) => {
  const lines = value.split('\n').map((l) => l.replace(/^\s*\* ?/, ''));
  const out = [];
  for (let i = 1; i < lines.length - 1; i++) {
    const t = lines[i].trim();
    const fence = /^(?:(`{3,})[^`]*|(~{3,}).*)$/.exec(t)?.slice(1).join('');
    let end = -1;
    if (fence) {
      end = lines.findIndex((l, k) => k > i && l.trim().startsWith(fence));
      if (end < 0) end = lines.length - 1;
    } else if (/^@example\b/.test(t)) {
      end = lines.findIndex((l, k) => k > i && /^\s*@\w/.test(l));
      if (end < 0) end = lines.length - 1;
    } else if (/^<pre[\s>]/i.test(t)) {
      end = lines.findIndex((l, k) => k > i && /<\/pre\s*>/i.test(l));
    }
    if (end < 0) continue;
    out.push(lines.slice(i, end).join('\n').trimEnd());
    i = end;
  }
  return out;
};

/**
 * The file's text without whitespace, the stars that start its lines,
 * and the blockquote markers after them or a `/**`.
 */
const inkOf = (code) =>
  code
    .replace(/(\/\*\*|\n\s*\*(?!\/))(?:(?:[^\S\n]|\u200b)*>)*/g, (_, start) =>
      start === '/**' ? start : '\n',
    )
    .replace(/[\s\u200b]/g, '');

const results = {};
let regions = 0;

for (const file of files) {
  test(`corpus:  ${file}`, () => {
    const code = readFileSync(new URL(file, DIR), 'utf8');
    const options = { filename: file };
    const was = parse(linter.verify(code, config, options));
    assert.deepEqual(
      was.messages.filter((m) => m.fatal).map((m) => m.message),
      [],
    );
    const { output } = linter.verifyAndFix(code, config, options);
    const again = linter.verifyAndFix(output, config, options);
    assert.equal(again.output, output, 'a second `--fix` changes it');
    const now = parse(again.messages);
    assert.deepEqual(
      now.messages.filter((m) => m.fix).map((m) => `${m.line} ${m.ruleId}`),
      [],
    );
    assert.deepEqual(now.tokens, was.tokens);
    assert.deepEqual(
      now.others.map((c) => c.value),
      was.others.map((c) => c.value),
    );
    assert.equal(now.blocks.length, was.blocks.length);
    assert.equal(inkOf(output), inkOf(code));
    was.blocks.forEach((block, k) => {
      if (!block.value.includes('\n')) return;
      const line = block.loc.start.line;
      const code = codeOf(block);
      assert.deepEqual(codeOf(now.blocks[k]), code, `line ${line}`);
      regions += code.length;
    });

    // Each rule's count is of the blocks it reports.
    const blockAt = (line) =>
      was.blocks.findIndex(
        (b) => b.loc.start.line <= line && line <= b.loc.end.line,
      );
    const rules = {};
    for (const { ruleId, line } of was.messages) {
      if (!ruleId?.startsWith('jsdoc-flow/')) continue;
      (rules[ruleId.slice(11)] ??= new Set()).add(blockAt(line));
    }
    results[file] = {
      blocks: was.blocks.length,
      changed: now.blocks.filter((b, k) => b.value !== was.blocks[k].value)
        .length,
      rules: Object.fromEntries(
        Object.entries(rules)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([rule, blocks]) => [rule, blocks.size]),
      ),
      sha256: createHash('sha256').update(output).digest('hex'),
    };
  });
}

test('corpus:  the snapshot', () => {
  const json = `${JSON.stringify(results, null, 2)}\n`;
  if (UPDATE) {
    writeFileSync(SNAPSHOT, json);
    return;
  }
  const snapshot = JSON.parse(readFileSync(SNAPSHOT, 'utf8'));
  const changed = [...new Set([...files, ...Object.keys(snapshot)])].filter(
    (f) => JSON.stringify(results[f]) !== JSON.stringify(snapshot[f]),
  );
  assert.deepEqual(
    Object.fromEntries(changed.map((f) => [f, results[f]])),
    Object.fromEntries(changed.map((f) => [f, snapshot[f]])),
    'The fixes changed.  If that is deliberate, run `npm run corpus:update`.',
  );
});

after(() => {
  const total = Object.values(results).reduce(
    (sum, r) => ({
      blocks: sum.blocks + r.blocks,
      changed: sum.changed + r.changed,
    }),
    { blocks: 0, changed: 0 },
  );
  process.stdout.write(
    `# corpus: ${files.length} files, ${total.blocks} blocks, ` +
      `${total.changed} changed, ${regions} code regions kept\n`,
  );
});
