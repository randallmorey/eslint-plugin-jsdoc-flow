// Tests for the `jsdoc-flow/list-nesting` rule.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Linter, RuleTester } from 'eslint';

import plugin from '../lib/index.js';
import {
  alignBullets,
  indentBullets,
  misindented,
  misnested,
  mishung,
  nestBullets,
  reflowComment,
} from '../lib/flow.js';
import './helpers.js';
import { nestingInvalid, nestingValid } from './cases/list-nesting.js';

const ruleTester = new RuleTester();

// Idempotency:  every fixed output is itself valid, so fixing it again
// changes nothing.
const nestingFixedAgain = nestingInvalid.map(({ name, output }) => ({
  name: `idempotent:  ${name}`,
  code: output,
}));

ruleTester.run('jsdoc-flow/list-nesting', plugin.rules['list-nesting'], {
  valid: [...nestingValid, ...nestingFixedAgain],
  invalid: nestingInvalid,
});

const body = (...lines) =>
  ['/**', ...lines.map((l) => (l ? ` * ${l}` : ' *')), ' */'].join('\n');

const linter = new Linter();
const fixWith = (rules, code) =>
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
const reports = (rule, code) =>
  linter.verify(
    code,
    [
      {
        files: ['**/*.js'],
        plugins: { 'jsdoc-flow': plugin },
        rules: { [`jsdoc-flow/${rule}`]: 'warn' },
      },
    ],
    { filename: 'x.js' },
  ).length;

// `bullet-indent` leaves a list with a misnested item to `list-nesting`,
// and `bullet-align` leaves a moved item's wrapped lines to `list-nesting`,
// so no line is reported by two of them.
test('the list rules never report the same misnested list', () => {
  const text = body('1. one', '  - two,', '      wrapped', '  - three');
  assert.deepEqual(misindented(text, ''), []);
  assert.deepEqual(mishung(text, ''), []);
  assert.deepEqual(
    misnested(text, '').map(({ at, column, hung }) => [
      at,
      column,
      hung.map((h) => [h.at, h.column]),
    ]),
    [
      [2, 6, [[3, 8]]],
      [4, 6, []],
    ],
  );
  const code = `${text}\nexport const x = 1;\n`;
  assert.equal(reports('bullet-indent', code), 0);
  assert.equal(reports('bullet-align', code), 0);
  assert.equal(reports('list-nesting', code), 2);
});

// `list-nesting` moves every item of a list with a misnested item, lining
// them up as `bullet-indent` would, and `reflow` lays the list out the same
// way, so the rules agree in any order.
test('a misnested list is nested and lined up at once', () => {
  const text = body(' - a', '1. b', '  - c,', '    wrapped');
  const fixed = body(' - a', ' 1. b', '    - c,', '      wrapped');
  assert.equal(nestBullets(text, ''), fixed);
  assert.equal(alignBullets(indentBullets(fixed, ''), ''), fixed);
  assert.equal(
    reflowComment(text, ''),
    body(' - a', ' 1. b', '    - c, wrapped'),
  );
  const code = `${text}\nexport const x = 1;\n`;
  const rules = ['list-nesting', 'bullet-indent', 'bullet-align'];
  const all = fixWith(rules, code);
  assert.equal(all, `${fixed}\nexport const x = 1;\n`);
  for (const rule of rules) {
    const rest = rules.filter((r) => r !== rule);
    assert.equal(fixWith(rest, fixWith([rule], code)), all, rule);
  }
});

test('items kept in a preformatted run are left alone', () => {
  const text = body('Example:', '  a', '  1. b', '    - c');
  assert.deepEqual(misnested(text, '', { preformatted: true }), []);
  assert.deepEqual(
    misnested(text, '', { preformatted: false }).map(({ at }) => at),
    [4],
  );
});

test("a block whose form isn't handled has no items to move", () => {
  assert.deepEqual(misnested('/**\n 1. a\n   - b\n */', ''), []);
});
