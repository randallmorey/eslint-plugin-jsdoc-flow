// Tests for the `jsdoc-flow/padding-lines` rule.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RuleTester } from 'eslint';

import plugin from '../lib/index.js';
import { dropBlanks, padBlanks, reflowComment, unpadded } from '../lib/flow.js';
import './helpers.js';
import { paddingInvalid, paddingValid } from './cases/padding-lines.js';

const ruleTester = new RuleTester();

// Idempotency:  every fixed output is itself valid, so fixing it again
// changes nothing.  An output that's another case's code is checked once.
const seen = new Set(paddingValid.map((c) => c.code));
const paddingFixedAgain = paddingInvalid
  .filter(({ output }) => !seen.has(output) && seen.add(output))
  .map(({ name, output }) => ({ name: `idempotent:  ${name}`, code: output }));

ruleTester.run('jsdoc-flow/padding-lines', plugin.rules['padding-lines'], {
  valid: [...paddingValid, ...paddingFixedAgain],
  invalid: paddingInvalid,
});

const body = (...lines) =>
  ['/**', ...lines.map((l) => (l ? ` * ${l}` : ' *')), ' */'].join('\n');

// `reflow` and `no-extra-blank-lines` keep the blank lines this rule adds,
// and adding them before or after either gives the same block.
test('padding commutes with reflow and dropping blank lines', () => {
  const text = body('', 'One', 'two:', '```js', 'a();', '```', 'Three', '', '');
  const reflowed = reflowComment(text, '') ?? '';
  assert.equal(padBlanks(reflowed, ''), reflowComment(padBlanks(text, ''), ''));
  assert.equal(
    padBlanks(dropBlanks(text, ''), ''),
    dropBlanks(padBlanks(text, ''), ''),
  );
});

test('no blank line goes where it would change how a line is read', () => {
  // A blank line ends a table with no edge pipes, so the lines after a fence
  // in one would be read as text.
  const code = `${body('a | b', '--|--', '1 | 2', '```', 'x', '```', 'c | d')}\n`;
  assert.deepEqual(unpadded(code, ''), []);
});

test("a one-line block, or one whose form isn't handled, needs none", () => {
  assert.deepEqual(unpadded('/** # One */', ''), []);
  assert.deepEqual(unpadded('/**\n # One\n * Two. */', ''), []);
});
