import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Linter } from 'eslint';

import plugin from '../lib/index.js';
import { invalid, valid } from './cases/reflow.js';
import {
  bulletInvalid,
  colonInvalid,
  punctuationInvalid,
  sentenceInvalid,
  spacingMixed,
  spacingValid,
  tagInvalid,
  wordInvalid,
} from './cases/spacing.js';
import {
  edgeMixed,
  edgeValid,
  leadingInvalid,
  starInvalid,
  trailingInvalid,
} from './cases/edges.js';
import { exoticInvalid, exoticMixed, exoticValid } from './cases/whitespace.js';
import { alignInvalid, alignValid } from './cases/tag-align.js';
import { bulletAlignInvalid, bulletAlignValid } from './cases/bullet-align.js';
import { singleInvalid, singleValid } from './cases/single-line.js';

// All the rules together:  `--fix` with all of them, or with any one and then
// the rest, settles on the same text, which no rule reports (except the
// unsafe case, which has no fix).
const RULES = [
  'reflow',
  'sentence-spacing',
  'colon-spacing',
  'word-spacing',
  'no-extra-punctuation-space',
  'tag-spacing',
  'bullet-spacing',
  'no-exotic-whitespace',
  'star-align',
  'text-indent',
  'no-trailing-space',
  'tag-align',
  'bullet-align',
  'single-line',
];
const linter = new Linter();
const configFor = (c, rules) => [
  {
    files: ['**/*.*'],
    ...(c.languageOptions && { languageOptions: c.languageOptions }),
    plugins: { 'jsdoc-flow': plugin },
    rules: Object.fromEntries(
      rules.map((r) => [
        `jsdoc-flow/${r}`,
        ['warn', ...(r === 'reflow' ? (c.options ?? []) : [])],
      ]),
    ),
  },
];
const fixWith = (c, rules, code) =>
  linter.verifyAndFix(code, configFor(c, rules), {
    filename: c.filename ?? 'x.js',
  }).output;

for (const c of [
  ...valid,
  ...invalid,
  ...spacingValid,
  ...sentenceInvalid,
  ...colonInvalid,
  ...wordInvalid,
  ...punctuationInvalid,
  ...tagInvalid,
  ...bulletInvalid,
  ...spacingMixed,
  ...exoticValid,
  ...exoticInvalid,
  ...exoticMixed,
  ...edgeValid,
  ...starInvalid,
  ...leadingInvalid,
  ...trailingInvalid,
  ...edgeMixed,
  ...alignValid,
  ...alignInvalid,
  ...bulletAlignValid,
  ...bulletAlignInvalid,
  ...singleValid,
  ...singleInvalid,
]) {
  test(`all rules converge:  ${c.name}`, () => {
    const all = fixWith(c, RULES, c.code);
    for (const rule of RULES) {
      const rest = RULES.filter((r) => r !== rule);
      const first = fixWith(c, rest, fixWith(c, [rule], c.code));
      assert.equal(first, all, `${rule} first`);
    }
    const left = linter.verify(all, configFor(c, RULES), {
      filename: c.filename ?? 'x.js',
    });
    assert.deepEqual(
      left.filter((m) => m.messageId !== 'unsafe').map((m) => m.message),
      [],
    );
  });
}
