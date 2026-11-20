// Tests for the `jsdoc-flow/bullet-indent` rule.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RuleTester } from 'eslint';

import plugin from '../lib/index.js';
import { alignBullets, misindented, reflowComment } from '../lib/flow.js';
import './helpers.js';
import {
  bulletIndentInvalid,
  bulletIndentValid,
} from './cases/bullet-indent.js';

const ruleTester = new RuleTester();

// Idempotency:  every fixed output is itself valid, so fixing it again
// changes nothing.
const bulletIndentFixedAgain = bulletIndentInvalid.map(({ name, output }) => ({
  name: `idempotent:  ${name}`,
  code: output,
}));

ruleTester.run('jsdoc-flow/bullet-indent', plugin.rules['bullet-indent'], {
  valid: [...bulletIndentValid, ...bulletIndentFixedAgain],
  invalid: bulletIndentInvalid,
});

const body = (...lines) =>
  ['/**', ...lines.map((l) => (l ? ` * ${l}` : ' *')), ' */'].join('\n');

// `reflow` and `bullet-align` hang a moved item's wrapped lines under its text
// where it moves to, and `reflow` moves the item too, so the three rules agree
// in any order.
test("a moved item's wrapped lines hang where it moves to", () => {
  const text = body('- one', ' - two,', '   continued', '   more');
  const hung = body('- one', ' - two,', '  continued', '  more');
  assert.equal(alignBullets(text, ''), hung);
  assert.equal(reflowComment(text, ''), body('- one', '- two, continued more'));
  assert.deepEqual(
    misindented(hung, '').map(({ at, column }) => [at, column]),
    [[2, 3]],
  );
});

test('items kept in a preformatted run are left alone', () => {
  // With the guard on, the lines after `  a` are in its run, and with it off
  // they're a list whose second item is off.
  const text = body('Example:', '  a', '  - b', '   - c');
  assert.deepEqual(misindented(text, '', { preformatted: true }), []);
  assert.deepEqual(
    misindented(text, '', { preformatted: false }).map(({ at }) => at),
    [4],
  );
});

test("a block whose form isn't handled has no items to move", () => {
  assert.deepEqual(misindented('/**\n - a\n  - b\n */', ''), []);
});
