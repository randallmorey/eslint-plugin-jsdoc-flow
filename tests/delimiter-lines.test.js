// Tests for the `jsdoc-flow/delimiter-lines` rule.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Linter, RuleTester } from 'eslint';

import plugin from '../lib/index.js';
import {
  delimiterText,
  hasVerbatimTag,
  reflowComment,
  safeSpread,
  spreadDelimiters,
} from '../lib/flow.js';
import './helpers.js';
import { messyBlocks } from './cases/verbatim.js';
import {
  delimiterInvalid,
  delimiterSettled,
  delimiterUnhandled,
  delimiterValid,
} from './cases/delimiter-lines.js';

const ruleTester = new RuleTester();

// Idempotency:  every fixed output is itself valid, so fixing it again
// changes nothing.  An output that's another case's is checked once.
const seen = new Set();
const delimiterFixedAgain = delimiterInvalid
  .filter(({ output }) => !seen.has(output) && seen.add(output))
  .map(({ name, output, settings }) => ({
    name: `idempotent:  ${name}`,
    code: output,
    ...(settings && { settings }),
  }));

ruleTester.run('jsdoc-flow/delimiter-lines', plugin.rules['delimiter-lines'], {
  valid: [...delimiterValid, ...delimiterUnhandled, ...delimiterFixedAgain],
  invalid: delimiterInvalid,
});

const linter = new Linter();
const fix = (code, rules = Object.keys(plugin.rules)) =>
  linter.verifyAndFix(
    code,
    [
      {
        files: ['**/*.js'],
        plugins: { 'jsdoc-flow': plugin },
        rules: Object.fromEntries(
          rules.map((r) => [`jsdoc-flow/${r}`, 'warn']),
        ),
      },
    ],
    { filename: 'x.js' },
  ).output;

// The block of a case's code, and the whitespace before it on its line.
const blockOf = (code) => {
  const [, indent, text] = /^([ \t]*)(\/\*\*[\s\S]*?\*\/)/m.exec(code) ?? [];
  return { indent, text };
};

const RULES = Object.keys(plugin.rules);
const OTHERS = RULES.filter((r) => r !== 'delimiter-lines');

// The other rules read a block with text beside its delimiters as this rule
// spreads it, and a fix of theirs spreads it too, so they format it the same
// before or after this rule.
for (const c of delimiterSettled) {
  test(`the other rules format a block as it's spread:  ${c.name}`, () => {
    assert.equal(fix(fix(c.code, OTHERS), ['delimiter-lines']), c.output);
    assert.equal(fix(fix(c.code, ['delimiter-lines']), OTHERS), c.output);
    assert.equal(fix(c.code), c.output);
  });
}

// The blocks that every rule reports (see `cases/verbatim.js`), with the text
// of their first and last lines moved beside their delimiters.
const squeeze = (code) =>
  code
    .replace(/^\/\*\*\n\s*\*(?=[ \t]*\S)/, '/**')
    .replace(/\n(\s*\*[^\n]*\S)[ \t]*\n\s*\*\//, '\n$1 */');
const squeezed = [
  ...messyBlocks.map(squeeze),
  '/** One.\n   *  Two.  \n * Three. */\nexport const q = 8;\n',
];
const off = { 'jsdoc-flow': { verbatimTags: [] } };
const fixOff = (code, rules) =>
  linter.verifyAndFix(code, configFor(rules, off), { filename: 'x.js' }).output;
const configFor = (rules, settings) => [
  {
    files: ['**/*.js'],
    ...(settings && { settings }),
    plugins: { 'jsdoc-flow': plugin },
    rules: Object.fromEntries(rules.map((r) => [`jsdoc-flow/${r}`, 'warn'])),
  },
];

test('the squeezed blocks have text beside their delimiters', () => {
  assert.equal(
    squeezed.filter((b) => /^\/\*\* *\S[^\n]*\n/.test(b)).length,
    squeezed.length - 1,
  );
});

for (const rule of OTHERS) {
  test(`${rule} reports and fixes blocks with text beside their delimiters`, () => {
    const code = squeezed.join('');
    const messages = linter.verify(code, configFor([rule], off), {
      filename: 'x.js',
    });
    assert.notEqual(messages.length, 0);
    assert.notEqual(fixOff(code, [rule]), code);
  });
}

test('all rules format a squeezed block as they do it spread', () => {
  for (const code of squeezed) {
    const spread = fixOff(code, ['delimiter-lines']);
    assert.equal(fixOff(code, RULES), fixOff(spread, RULES), code);
    assert.equal(
      fixOff(fixOff(code, OTHERS), ['delimiter-lines']),
      fixOff(spread, OTHERS),
      code,
    );
  }
});

// A report on the spread is moved back to the same words as written.
test('a rule reports on the words as written', () => {
  const code = '/** One. Two.\n * Three. Four. */\nexport const x = 1;\n';
  const messages = linter.verify(code, configFor(['sentence-spacing']), {
    filename: 'x.js',
  });
  assert.deepEqual(
    messages.map((m) => [m.line, m.column, m.endLine, m.endColumn]),
    [
      [1, 5, 1, 14],
      [2, 4, 2, 16],
    ],
  );
});

test('a block with mixed line breaks is skipped', () => {
  const code = '/** Saves it.\r\n * Then returns.\n */\nexport const x = 1;\n';
  assert.equal(fix(code), code);
});

test("every fix leaves a block whose form is handled, so it's reflowed", () => {
  for (const { name, code } of delimiterInvalid) {
    const { text, indent } = blockOf(code);
    assert.equal(reflowComment(text, indent), null, name);
    const spread = spreadDelimiters(text, indent) ?? '';
    assert.ok(safeSpread(text, spread, indent), name);
    assert.notEqual(reflowComment(spread, indent), null, name);
  }
});

test("a block that's still not handled once spread isn't safe to spread", () => {
  for (const { name, code } of delimiterUnhandled) {
    const { text, indent } = blockOf(code);
    const spread = spreadDelimiters(text, indent) ?? '';
    assert.ok(spread, name);
    assert.equal(safeSpread(text, spread, indent), false, name);
  }
});

test('a fix that changes more than whitespace is not safe', () => {
  const text = '/** Saves it.\n * Then returns. */';
  assert.equal(
    safeSpread(text, '/**\n * Saves it!\n * Then returns.\n */', ''),
    false,
  );
});

test('a one-line block has no delimiter text, which `single-line` spreads', () => {
  assert.deepEqual(delimiterText('/** Saves it. */', ''), []);
  assert.equal(spreadDelimiters('/** Saves it. */', ''), null);
});

test('verbatim tags are found as the block would be spread', () => {
  const names = new Set(['license']);
  for (const text of [
    '/** @license MIT\n * Copyright.\n */',
    '/** Copyright.\n * @license MIT */',
  ])
    assert.ok(hasVerbatimTag(text, '', names), text);
  // In a fence, it isn't one, as it wouldn't be once spread.
  assert.equal(
    hasVerbatimTag('/** ```\n * @license MIT\n * ``` */', '', names),
    false,
  );
});

// Its fix would add a `*`, so no rule reads or changes the block.
for (const c of delimiterUnhandled) {
  test(`all rules skip a block that isn't handled once spread:  ${c.name}`, () => {
    assert.equal(fix(c.code), c.code);
  });
}

// Nor does any rule change a block that this one leaves alone, since none
// reads it.
for (const c of delimiterValid) {
  test(`all rules settle on a block this rule leaves:  ${c.name}`, () => {
    const once = fix(c.code);
    assert.equal(fix(once), once);
  });
}
