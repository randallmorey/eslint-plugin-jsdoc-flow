// Tests for files with CRLF line endings:  every rule finds the same things in
// them as with LF, and its fixes keep CRLF.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Linter, RuleTester } from 'eslint';

import plugin from '../lib/index.js';
import { block } from './helpers.js';
import { blankInvalid } from './cases/blank-lines.js';
import { paddingInvalid } from './cases/padding-lines.js';
import { tableInvalid } from './cases/table-align.js';
import { blockInvalid } from './cases/blocks.js';
import { delimiterInvalid } from './cases/delimiter-lines.js';
import { bulletAlignInvalid } from './cases/bullet-align.js';
import { bulletIndentInvalid } from './cases/bullet-indent.js';
import { leadingInvalid, starInvalid, trailingInvalid } from './cases/edges.js';
import { invalid } from './cases/reflow.js';
import { singleInvalid } from './cases/single-line.js';
import {
  bulletInvalid,
  colonInvalid,
  punctuationInvalid,
  sentenceInvalid,
  tagInvalid,
  wordInvalid,
} from './cases/spacing.js';
import { alignInvalid } from './cases/tag-align.js';
import { exoticInvalid } from './cases/whitespace.js';

const crlf = (s) => s.replace(/\r?\n/g, '\r\n');

// Each rule's invalid cases with CRLF, which it reports at the same places,
// and fixes to the same text with CRLF.
const invalidByRule = {
  reflow: [...invalid, ...blockInvalid],
  'sentence-spacing': sentenceInvalid,
  'colon-spacing': colonInvalid,
  'word-spacing': wordInvalid,
  'no-extra-punctuation-space': punctuationInvalid,
  'tag-spacing': tagInvalid,
  'bullet-spacing': bulletInvalid,
  'no-exotic-whitespace': exoticInvalid,
  'star-align': starInvalid,
  'text-indent': leadingInvalid,
  'no-trailing-space': trailingInvalid,
  'tag-align': alignInvalid,
  'bullet-align': bulletAlignInvalid,
  'bullet-indent': bulletIndentInvalid,
  'no-extra-blank-lines': blankInvalid,
  'padding-lines': paddingInvalid,
  'table-align': tableInvalid,
  'delimiter-lines': delimiterInvalid,
  'single-line': singleInvalid,
};
const ruleTester = new RuleTester();
for (const [rule, cases] of Object.entries(invalidByRule)) {
  ruleTester.run(`jsdoc-flow/${rule} with CRLF`, plugin.rules[rule], {
    valid: [],
    // A case that's CRLF already would be a duplicate.
    invalid: cases
      .filter((c) => !c.code.includes('\r'))
      .map(({ name, code, output, ...c }) => ({
        ...c,
        name: `CRLF:  ${name}`,
        code: crlf(code),
        output: output && crlf(output),
      })),
  });
}

const linter = new Linter();
const lint = (code, rules = Object.keys(plugin.rules)) => {
  const config = {
    files: ['**/*.js'],
    plugins: { 'jsdoc-flow': plugin },
    rules: Object.fromEntries(rules.map((r) => [`jsdoc-flow/${r}`, 'warn'])),
  };
  const options = { filename: 'x.js' };
  return {
    messages: linter.verify(code, [config], options),
    output: linter.verifyAndFix(code, [config], options).output,
  };
};

test('`reflow` expands a wide one-liner with CRLF', () => {
  const code = `/** ${'Some words that run on. '.repeat(4)}*/\r\nexport const x = 1;\r\n`;
  const { output } = lint(code, ['reflow']);
  assert.notEqual(output, code);
  assert.equal(output, crlf(lint(code.replace(/\r/g, ''), ['reflow']).output));
  assert.doesNotMatch(output, /(?<!\r)\n/);
});

test('a fix at the end of a line keeps its CRLF', () => {
  const code = crlf(block('One.  ', 'Two.\t'));
  assert.equal(
    lint(code, ['no-trailing-space']).output,
    crlf(block('One.', 'Two.')),
  );
});

test('a block with mixed or unusual line breaks is skipped', () => {
  for (const code of [
    '/**\r\n * One. Two.\n */\r\nexport const x = 1;\r\n',
    '/**\r * One. Two.\r */\nexport const x = 1;\n',
    '/**\n * One. Two.  * Three.\n */\nexport const x = 1;\n',
  ])
    assert.deepEqual(lint(code).messages, [], JSON.stringify(code));
});
