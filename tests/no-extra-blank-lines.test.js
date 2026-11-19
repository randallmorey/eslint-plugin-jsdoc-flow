// Tests for the `jsdoc-flow/no-extra-blank-lines` rule.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RuleTester } from 'eslint';

import plugin from '../lib/index.js';
import { dropBlanks, extraBlanks, reflowComment } from '../lib/flow.js';
import './helpers.js';
import { blankInvalid, blankValid } from './cases/blank-lines.js';

const ruleTester = new RuleTester();

// Idempotency:  every fixed output is itself valid, so fixing it again
// changes nothing.  An output that's another case's code is checked once.
const seen = new Set(blankValid.map((c) => c.code));
const blankFixedAgain = blankInvalid
  .filter(({ output }) => !seen.has(output) && seen.add(output))
  .map(({ name, output }) => ({ name: `idempotent:  ${name}`, code: output }));

ruleTester.run(
  'jsdoc-flow/no-extra-blank-lines',
  plugin.rules['no-extra-blank-lines'],
  {
    valid: [...blankValid, ...blankFixedAgain],
    invalid: blankInvalid,
  },
);

// `reflow` keeps every blank line, so it leaves extra ones to this rule, and
// dropping them before or after a reflow gives the same block.
test('reflow keeps blank lines, and dropping them commutes with it', () => {
  const text = '/**\n *\n * One. Two\n * three.\n *\n *\n * Four.\n *\n */';
  const reflowed = reflowComment(text, '');
  assert.deepEqual(extraBlanks(reflowed ?? '', ''), [1, 4, 6]);
  assert.equal(
    dropBlanks(reflowed ?? '', ''),
    reflowComment(dropBlanks(text, ''), ''),
  );
});

test("a one-line block, or one whose form isn't handled, has no extra blanks", () => {
  assert.deepEqual(extraBlanks('/**  */', ''), []);
  assert.deepEqual(extraBlanks('/**\n *\n *\n * One. */', ''), []);
});
