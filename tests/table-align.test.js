// Tests for the `jsdoc-flow/table-align` rule.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RuleTester } from 'eslint';

import plugin from '../lib/index.js';
import {
  alignTables,
  fixEdges,
  fixWhitespace,
  mistabled,
  padBlanks,
  reflowComment,
} from '../lib/flow.js';
import './helpers.js';
import { tableInvalid, tableValid } from './cases/table-align.js';

const ruleTester = new RuleTester();

// Idempotency:  every fixed output is itself valid, so fixing it again
// changes nothing.  An output that's another case's code is checked once.
const seen = new Set(tableValid.map((c) => c.code));
const tableFixedAgain = tableInvalid
  .filter(({ output }) => !seen.has(output) && seen.add(output))
  .map(({ name, output, settings }) => ({
    name: `idempotent:  ${name}`,
    code: output,
    ...(settings && { settings }),
  }));

ruleTester.run('jsdoc-flow/table-align', plugin.rules['table-align'], {
  valid: [...tableValid, ...tableFixedAgain],
  invalid: tableInvalid,
});

const body = (...lines) =>
  ['/**', ...lines.map((l) => (l ? ` * ${l}` : ' *')), ' */'].join('\n');

// `reflow`, `padding-lines`, `no-exotic-whitespace`, and the edge rules leave
// a table's rows as this rule writes them, and aligning before or after any
// of them gives the same block.
test('aligning commutes with the other fixes to a table', () => {
  const text = body(
    'One:',
    '| a |  bb\t|  ',
    '|-|:-:|',
    '| ccc\u200b | d |',
    'Two',
    'three.',
  );
  const others = [
    (t) => reflowComment(t, '') ?? '',
    (t) => padBlanks(t, ''),
    (t) => fixWhitespace(t, ''),
    (t) => fixEdges(t, ''),
  ];
  for (const other of others) {
    assert.equal(alignTables(other(text), ''), other(alignTables(text, '')));
  }
});

test("a block with no table, or whose form isn't handled, has no row to fix", () => {
  assert.deepEqual(mistabled(body('One.', '', 'Two.'), ''), []);
  assert.deepEqual(mistabled('/**\n | a |\n |-|\n * Two. */', ''), []);
});
