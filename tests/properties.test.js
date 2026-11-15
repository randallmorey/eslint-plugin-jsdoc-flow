// Property tests:  random JSDoc blocks (see `arbitraries.js`) must hold up
// under `--fix` with all the rules.  `FUZZ_RUNS` sets the runs per property,
// and `FUZZ_SEED` the seed, which is fixed unless it's set.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Linter } from 'eslint';
import fc from 'fast-check';

import plugin from '../lib/index.js';
import { reflowComment } from '../lib/flow.js';
import { block, file, settings, unstar, withCode } from './arbitraries.js';

const RUNS = Number(process.env.FUZZ_RUNS || 1000);
const SEED = Number(process.env.FUZZ_SEED || 20251115);
const RULES = Object.keys(plugin.rules);

const linter = new Linter();
const configOf = (rules, s) => [
  {
    files: ['**/*.js'],
    settings: { 'jsdoc-flow': s },
    plugins: { 'jsdoc-flow': plugin },
    rules: Object.fromEntries(rules.map((r) => [`jsdoc-flow/${r}`, 'warn'])),
  },
];
const fix = (code, s, rules = RULES) =>
  linter.verifyAndFix(code, configOf(rules, s), { filename: 'x.js' }).output;

/**
 * Fixes a file with all the rules, counting the passes that change it, which
 * are the runs of a rule that's on in each pass but the last.
 */
const fixCounting = (code, s) => {
  let runs = 0;
  const config = configOf(RULES, s);
  config[0].plugins.count = { rules: { runs: { create: () => (runs++, {}) } } };
  config[0].rules['count/runs'] = 'warn';
  const { output } = linter.verifyAndFix(code, config, { filename: 'x.js' });
  return { output, passes: runs - 1 };
};

/**
 * The file's code tokens, and its comments other than JSDoc blocks alone on
 * their lines, which the rules never change.
 */
const untouched = (code) => {
  const messages = linter.verify(code, [{ files: ['**/*.js'] }], {
    filename: 'x.js',
  });
  assert.deepEqual(messages, []);
  const { ast, lines } = linter.getSourceCode();
  const alone = ({ loc: { start, end } }) =>
    !/\S/.test(lines[start.line - 1].slice(0, start.column)) &&
    !/\S/.test(lines[end.line - 1].slice(end.column));
  return {
    tokens: ast.tokens.map((t) => `${t.type} ${t.value}`),
    comments: ast.comments
      .filter((c) => !/^\*(?!\*)/.test(c.value) || !alone(c))
      .map((c) => c.value),
  };
};

/**
 * The file's text without its whitespace and the stars that start its lines,
 * which a fix may change.
 */
const inkOf = (code) =>
  code.replace(/\n\s*\*(?!\/)/g, '\n').replace(/[\s\u200b]/g, '');

const check = (arbitrary, predicate) =>
  fc.assert(fc.property(arbitrary, predicate), { numRuns: RUNS, seed: SEED });

test('all rules settle in at most 3 passes on text no rule reports', () => {
  check(fc.tuple(file, settings), ([code, s]) => {
    const { output, passes } = fixCounting(code, s);
    assert.ok(passes <= 3, `${passes} passes`);
    const left = linter.verify(output, configOf(RULES, s), {
      filename: 'x.js',
    });
    assert.deepEqual(
      left.filter((m) => m.fix || m.fatal).map((m) => m.message),
      [],
    );
    assert.equal(fix(output, s), output);
  });
});

test('all rules change only whitespace and stars in JSDoc blocks', () => {
  check(fc.tuple(file, settings), ([code, s]) => {
    const output = fix(code, s);
    assert.deepEqual(untouched(output), untouched(code));
    assert.equal(inkOf(output), inkOf(code));
  });
});

test('all rules keep code in fences, `@example` and `<pre>` as it is', () => {
  const body = (t) => t.split('\n').map(unstar).join('\n');
  check(fc.tuple(withCode, settings), ([{ code, kept }, s]) => {
    assert.ok(body(fix(code, s)).includes(kept));
  });
});

test('reflow alone is idempotent', () => {
  check(
    fc.tuple(block, settings, fc.boolean(), fc.boolean()),
    ([b, s, hang, shortWords]) => {
      const text = b.trimStart();
      const indent = b.slice(0, b.length - text.length);
      const options = { ...s, hang, shortWords };
      const once = reflowComment(text, indent, s.width, options);
      if (once === null) return;
      assert.equal(reflowComment(once, indent, s.width, options), once);
    },
  );
});

test('any rule first, then the rest, settles as all the rules together do', () => {
  check(
    fc.tuple(file, settings, fc.constantFrom(...RULES)),
    ([code, s, rule]) => {
      const rest = RULES.filter((r) => r !== rule);
      assert.equal(fix(fix(code, s, [rule]), s, rest), fix(code, s));
    },
  );
});
