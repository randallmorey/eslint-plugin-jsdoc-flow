import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Linter } from 'eslint';

import plugin from '../lib/index.js';
import { wordsOf } from '../lib/flow.js';
import {
  blockInvalid,
  blockValid,
  guardBlocks,
  convergeWidths,
  noEnd,
  noStart,
} from './cases/blocks.js';
import { invalid, typeValid, valid } from './cases/reflow.js';
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
import {
  singleInvalid,
  singleSettled,
  singleValid,
} from './cases/single-line.js';
import { verbatimCases } from './cases/verbatim.js';
import { preformattedCases, unguardedCases } from './cases/preformatted.js';
import {
  oneSpaceColonInvalid,
  oneSpaceReflowInvalid,
  oneSpaceReflowValid,
  oneSpaceSentenceInvalid,
  oneSpaceValid,
  oneSpaceWordInvalid,
  spacesMixed,
} from './cases/spaces.js';

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
// A case's options are for `single-line` if they're its `allowTags`, and
// otherwise for `reflow`.
const optionsFor = (c, rule) =>
  rule === (c.options?.[0].allowTags ? 'single-line' : 'reflow')
    ? (c.options ?? [])
    : [];
const configFor = (c, rules) => [
  {
    files: ['**/*.*'],
    ...(c.languageOptions && { languageOptions: c.languageOptions }),
    ...(c.settings && { settings: c.settings }),
    plugins: { 'jsdoc-flow': plugin },
    rules: Object.fromEntries(
      rules.map((r) => [`jsdoc-flow/${r}`, ['warn', ...optionsFor(c, r)]]),
    ),
  },
];
const fixWith = (c, rules, code) =>
  linter.verifyAndFix(code, configFor(c, rules), {
    filename: c.filename ?? 'x.js',
  }).output;

// A case as it is with one space after a sentence end or a colon, keeping its
// other settings.
const withOneSpace = (c) => ({
  ...c,
  settings: {
    ...c.settings,
    'jsdoc-flow': { ...c.settings?.['jsdoc-flow'], spaces: 1 },
  },
});

const converging = [
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
  ...blockValid,
  ...blockInvalid,
  ...verbatimCases,
  ...preformattedCases,
  ...unguardedCases,
  ...[...noStart, ...noEnd].flatMap((token) =>
    guardBlocks(token).flatMap((code, k) =>
      convergeWidths.map((width) => ({
        name: `\`${token}\` in a wrap, block ${k + 1} at ${width}`,
        options: [{ width }],
        code,
      })),
    ),
  ),
];

const settlesInAnyOrder = (c) => {
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
  return all;
};

for (const c of converging) {
  test(`all rules converge:  ${c.name}`, () => {
    settlesInAnyOrder(c);
  });
}

// The same cases with one space, which also keep the same words as with two.
for (const c of converging) {
  test(`all rules converge with one space:  ${c.name}`, () => {
    const all = settlesInAnyOrder(withOneSpace(c));
    assert.equal(fixWith(withOneSpace(c), RULES, all), all);
    assert.deepEqual(wordsOf(all), wordsOf(fixWith(c, RULES, c.code)));
  });
}

// The one-space cases, in both modes.
for (const c of [
  ...oneSpaceValid,
  ...oneSpaceSentenceInvalid,
  ...oneSpaceColonInvalid,
  ...oneSpaceWordInvalid,
  ...oneSpaceReflowValid,
  ...oneSpaceReflowInvalid,
  ...spacesMixed,
]) {
  test(`all rules converge, one-space case with two:  ${c.name}`, () => {
    settlesInAnyOrder({ ...c, settings: undefined });
  });
  test(`all rules converge, one-space case with one:  ${c.name}`, () => {
    settlesInAnyOrder(withOneSpace(c));
  });
}

// A multi-line `{Type}` or a Markdown block survives `--fix` with all the rules
// as it is.
for (const c of [...typeValid, ...blockValid]) {
  test(`all rules keep:  ${c.name}`, () => {
    assert.equal(fixWith(c, RULES, c.code), c.code);
  });
  test(`all rules keep with one space:  ${c.name}`, () => {
    assert.equal(fixWith(withOneSpace(c), RULES, c.code), c.code);
  });
}

// A one-liner that `single-line` exempts survives `--fix` with all the rules:
// on one line, unless `reflow` has its own reason to expand it.  A block with
// an ignore comment or a verbatim tag survives it as it is, and one with only
// what looks like them is fixed as usual.  So does a block that the guard on
// unfenced code keeps, in part or whole.
for (const c of [
  ...singleSettled,
  ...verbatimCases,
  ...preformattedCases,
  ...unguardedCases,
]) {
  test(`all rules settle:  ${c.name}`, () => {
    assert.equal(fixWith(c, RULES, c.code), c.output ?? c.code);
  });
  // With one space, they settle on the same text with its sentence and colon
  // gaps narrowed.  In this case, those gaps are all on lines the guard keeps.
  const kept = c.name === 'code after a label in the middle of a paragraph';
  test(`all rules settle with one space:  ${c.name}`, () => {
    const settled = c.output ?? c.code;
    assert.equal(
      fixWith(withOneSpace(c), RULES, c.code),
      kept ? settled : settled.replace(/([.!?:]["')\]]*) {2,}(?=\S)/g, '$1 '),
    );
  });
}
