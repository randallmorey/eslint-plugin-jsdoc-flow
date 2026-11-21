// Tests for the `jsdoc-flow/link-spacing` rule.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Linter, RuleTester } from 'eslint';

import plugin from '../lib/index.js';
import {
  fixLinks,
  fixPunctuation,
  fixSpacing,
  fixWhitespace,
  misspanned,
  reflowComment,
} from '../lib/flow.js';
import './helpers.js';
import { linkInvalid, linkValid } from './cases/link-spacing.js';
import { punctuationInvalid, wordInvalid } from './cases/spacing.js';
import { exoticInvalid } from './cases/whitespace.js';

const ruleTester = new RuleTester();

// Idempotency:  every fixed output is itself valid, so fixing it again
// changes nothing.
const linkFixedAgain = linkInvalid.map(({ name, output }) => ({
  name: `idempotent:  ${name}`,
  code: output,
}));

// Independence:  what the other spacing rules fix is outside links.
const others = [...wordInvalid, ...punctuationInvalid, ...exoticInvalid].map(
  ({ name, code, settings }) => ({
    name: `left to another rule:  ${name}`,
    code,
    ...(settings && { settings }),
  }),
);

ruleTester.run('jsdoc-flow/link-spacing', plugin.rules['link-spacing'], {
  valid: [...linkValid, ...linkFixedAgain, ...others],
  invalid: linkInvalid,
});

const body = (...lines) =>
  ['/**', ...lines.map((l) => (l ? ` * ${l}` : ' *')), ' */'].join('\n');

// Reflow spaces a link as this rule does, so a block whose only problem is its
// links' spacing reflows to the block this rule fixes, and the spacing rules
// fix the same gaps before or after it.
test('spacing links commutes with reflow and the other spacing fixes', () => {
  const text = body(
    'Wraps {@link   Store#save  the save method }  and returns',
    'a [ promise\tof the result ](https://example.com/p) ,  as',
    '{@link  Foo\u200b}.',
  );
  assert.equal(reflowComment(fixLinks(text, ''), ''), reflowComment(text, ''));
  const others = [
    (t) => fixWhitespace(t, ''),
    (t) => fixSpacing(t, ''),
    (t) => fixPunctuation(t, ''),
  ];
  for (const other of others) {
    assert.equal(fixLinks(other(text), ''), other(fixLinks(text, '')));
  }
  const one = body('See {@link  Foo }.');
  assert.equal(reflowComment(one, ''), fixLinks(one, ''));
});

// A block whose only problem is its links' spacing is left to this rule.
test("reflow doesn't report a block that only needs its links spaced", () => {
  const messages = new Linter().verify(
    linkInvalid[0].code,
    [
      {
        plugins: { 'jsdoc-flow': plugin },
        rules: { 'jsdoc-flow/reflow': 'warn' },
      },
    ],
    { filename: 'x.js' },
  );
  assert.deepEqual(messages, []);
});

test("a block with no link, or whose form isn't handled, has no gap to fix", () => {
  assert.deepEqual(misspanned(body('One.', '', 'Two.'), ''), []);
  assert.deepEqual(misspanned('/**\n {@link  a}\n * Two. */', ''), []);
});
