// Tests for the `jsdoc-flow/list-spacing` rule.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Linter, RuleTester } from 'eslint';

import plugin from '../lib/index.js';
import {
  looseBlanks,
  nestBullets,
  reflowComment,
  tightenLists,
} from '../lib/flow.js';
import './helpers.js';
import { looseInvalid, looseValid } from './cases/list-spacing.js';

const ruleTester = new RuleTester();

// Idempotency:  every fixed output is itself valid, so fixing it again
// changes nothing.  An output that's another case's is checked once.
const seen = new Set();
const looseFixedAgain = looseInvalid
  .filter(({ output }) => !seen.has(output) && seen.add(output))
  .map(({ name, output }) => ({ name: `idempotent:  ${name}`, code: output }));

ruleTester.run('jsdoc-flow/list-spacing', plugin.rules['list-spacing'], {
  valid: [...looseValid, ...looseFixedAgain],
  invalid: looseInvalid,
});

const body = (...lines) =>
  ['/**', ...lines.map((l) => (l ? ` * ${l}` : ' *')), ' */'].join('\n');

const linter = new Linter();
const lint = (rules, code) => {
  const config = [
    {
      files: ['**/*.js'],
      plugins: { 'jsdoc-flow': plugin },
      rules: Object.fromEntries(rules.map((r) => [`jsdoc-flow/${r}`, 'warn'])),
    },
  ];
  const options = { filename: 'x.js' };
  return {
    lines: linter.verify(code, config, options).map((m) => m.line),
    output: linter.verifyAndFix(code, config, options).output,
  };
};

// `no-extra-blank-lines` reports all but the first blank line of a run,
// and this rule only the first, so no line is reported by both, and either
// fix leaves the list tight once the other has run.
test('the blank-line rules never report the same line', () => {
  const code = `${body('- a', '', '', '', '- b')}\nexport const x = 1;\n`;
  assert.deepEqual(lint(['list-spacing'], code).lines, [3]);
  assert.deepEqual(lint(['no-extra-blank-lines'], code).lines, [4, 5]);
  const tight = `${body('- a', '- b')}\nexport const x = 1;\n`;
  assert.equal(lint(['list-spacing'], code).output, tight);
  assert.equal(
    lint(['list-spacing'], lint(['no-extra-blank-lines'], code).output).output,
    tight,
  );
});

// `reflow` keeps every blank line, so it leaves a loose list to this rule,
// and tightening it before or after a reflow gives the same block.
test('reflow keeps a loose list, and tightening it commutes with reflow', () => {
  const text = body('- One. Two', '  three.', '', '- Four.', '', '  - Five.');
  const reflowed = reflowComment(text, '') ?? '';
  assert.deepEqual(looseBlanks(reflowed, ''), [[2], [4]]);
  assert.equal(
    tightenLists(reflowed, ''),
    reflowComment(tightenLists(text, ''), ''),
  );
});

// A misnested item is moved by `list-nesting` either way, so the two rules
// settle on the same block in any order.
test('tightening a list commutes with nesting it', () => {
  const text = body('1. a', '', '  - b', '', '  - c');
  assert.equal(
    tightenLists(nestBullets(text, ''), ''),
    nestBullets(tightenLists(text, ''), ''),
  );
});

test('items kept in a preformatted run are left alone', () => {
  const text = body('Example:', '  a', '  - b', '', '  - c');
  assert.deepEqual(looseBlanks(text, '', { preformatted: true }), []);
});

test("a one-line block, or one whose form isn't handled, has no loose lists", () => {
  assert.deepEqual(looseBlanks('/** - a */', ''), []);
  assert.deepEqual(looseBlanks('/**\n - a\n\n - b\n */', ''), []);
});
