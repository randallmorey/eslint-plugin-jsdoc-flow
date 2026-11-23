// Tests for the `jsdoc-flow/quote-flow` rule.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RuleTester } from 'eslint';

import plugin from '../lib/index.js';
import {
  fixEdges,
  fixWhitespace,
  misquoted,
  reflowComment,
} from '../lib/flow.js';
import './helpers.js';
import { quoteInvalid, quoteUnsafe, quoteValid } from './cases/quote-flow.js';
import { blockValid } from './cases/blocks.js';

const ruleTester = new RuleTester();

// Idempotency:  every fixed output is itself valid, so fixing it again
// changes nothing.
const quoteFixedAgain = quoteInvalid.map(({ name, output, settings }) => ({
  name: `idempotent:  ${name}`,
  code: output,
  ...(settings && { settings }),
}));

ruleTester.run('jsdoc-flow/quote-flow', plugin.rules['quote-flow'], {
  valid: [...quoteValid, ...blockValid, ...quoteFixedAgain],
  invalid: [...quoteInvalid, ...quoteUnsafe],
});

const body = (...lines) =>
  ['/**', ...lines.map((l) => (l ? ` * ${l}` : ' *')), ' */'].join('\n');

// The rule's options are `reflow`'s, so a quote breaks where a paragraph
// would with the same options.
test('a quote takes the options that reflow takes', () => {
  const words = 'Some words that run on, and on. '.repeat(3).trim();
  for (const options of [{}, { hang: false, widows: 0, shortWords: false }]) {
    const [para] = reflowComment(body(words), '', 50, options)
      .split('\n')
      .slice(1, -1)
      .map((l) => l.slice(3));
    const [quote] = misquoted(body(`> ${words}`), '', 52, options).quotes;
    assert.equal(quote.lines[0], ` * > ${para}`);
  }
  const rule = plugin.rules['quote-flow'].meta.schema;
  assert.deepEqual(rule, plugin.rules.reflow.meta.schema);
});

// `reflow` keeps a quote's lines as they are, and `quote-flow` changes no
// other line, so neither finds what the other fixes, and each fixes the same
// block before or after the other.
test('flowing quotes commutes with reflow and the whitespace fixes', () => {
  const text = body(
    'Some text',
    'to join.',
    '> A quote  ',
    '>to\tjoin.',
    'More',
    'text.',
  );
  const flow = (t) => {
    const { quotes } = misquoted(t, '');
    const lines = t.split('\n');
    for (const q of [...quotes].reverse()) {
      lines.splice(q.at, q.end - q.at + 1, ...q.lines);
    }
    return lines.join('\n');
  };
  const others = [
    (t) => reflowComment(t, '') ?? '',
    (t) => fixWhitespace(t, ''),
    (t) => fixEdges(t, ''),
  ];
  for (const other of others) {
    assert.equal(flow(other(text)), other(flow(text)));
  }
  assert.equal(
    flow(reflowComment(text, '') ?? ''),
    body('Some text to join.', '> A quote to join.', 'More text.'),
  );
});

test("a block with no quote, or whose form isn't handled, has none to flow", () => {
  assert.deepEqual(misquoted(body('One.', '', 'Two.'), '').quotes, []);
  assert.deepEqual(misquoted('/** > a b */', '').quotes, []);
  assert.deepEqual(misquoted('/**\n > a\n > b\n */', '').quotes, []);
});
