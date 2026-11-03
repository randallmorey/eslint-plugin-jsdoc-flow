// Tests for the `jsdoc-flow/single-line` rule.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Linter, RuleTester } from 'eslint';

import plugin from '../lib/index.js';
import './helpers.js';
import { singleInvalid, singleValid } from './cases/single-line.js';

const ruleTester = new RuleTester();

// Idempotency:  every fixed output is itself valid, so fixing it again
// changes nothing.
const singleFixedAgain = singleInvalid.map(
  ({ name, output, filename, languageOptions }) => ({
    name: `idempotent:  ${name}`,
    code: output,
    ...(filename && { filename }),
    ...(languageOptions && { languageOptions }),
  }),
);

ruleTester.run('jsdoc-flow/single-line', plugin.rules['single-line'], {
  valid: [
    ...singleValid,
    ...singleFixedAgain,
    // It's exempt as `no-exotic-whitespace` would leave it.
    {
      name: 'a directive after a zero-width space',
      code: '/** \u200b@ts-ignore */\nexport const x = 1;\n',
    },
  ],
  invalid: singleInvalid,
});

// `allowTags` takes tag names, so a leading `@` or a blank name is a config
// error rather than an option that silently matches nothing.
const verifyWith = (options) =>
  new Linter().verify('/** @type {Foo} */\n', [
    {
      files: ['**/*.*'],
      plugins: { 'jsdoc-flow': plugin },
      rules: { 'jsdoc-flow/single-line': ['warn', options] },
    },
  ]);

test('allowTags defaults to none', () => {
  assert.equal(verifyWith({}).length, 1);
});

for (const allowTags of [['@type'], [''], ['a b'], 'type', [1], ['a', 'a']]) {
  test(`allowTags rejects ${JSON.stringify(allowTags)}`, () => {
    assert.throws(() => verifyWith({ allowTags }), /jsdoc-flow\/single-line/);
  });
}
