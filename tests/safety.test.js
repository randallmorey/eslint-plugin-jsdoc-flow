// Tests for what keeps a bad block from failing a whole run:  each block is
// checked on its own, and one that throws is reported without a fix.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Linter } from 'eslint';

import plugin from '../lib/index.js';
import { blockRule, fixOf } from '../lib/rules/block.js';
import { block } from './helpers.js';

// A rule that throws on a block holding `boom`, and on one holding `late`
// only once it has found a report, and otherwise reports each block.
const flaky = blockRule(
  { messages: { seen: 'Seen.' } },
  (context) => (comment, text) => {
    if (text.includes('boom')) throw new Error('boom');
    const seen = { loc: comment.loc, messageId: 'seen' };
    if (!text.includes('late')) return [seen];
    // An edit past the block's last line, which `fixOf` can't place.
    const edit = { at: 99, start: 0, end: 0, text: ' ' };
    return [seen, { ...seen, fix: fixOf(context.sourceCode, comment, edit) }];
  },
);

const linter = new Linter();
const config = [
  {
    files: ['**/*.js'],
    plugins: { test: { rules: { flaky } }, 'jsdoc-flow': plugin },
    rules: { 'test/flaky': 'warn', 'jsdoc-flow/sentence-spacing': 'warn' },
  },
];
const lint = (code) =>
  linter
    .verify(code, config, { filename: 'x.js' })
    .map((m) => [m.ruleId, m.messageId, m.line, !!m.fix]);

// Runs `fn` with `JSDOC_FLOW_STRICT` set to `value`, or unset if undefined.
const withStrict = (value, fn) => {
  const was = process.env.JSDOC_FLOW_STRICT;
  const set = (v) => {
    if (v === undefined) delete process.env.JSDOC_FLOW_STRICT;
    else process.env.JSDOC_FLOW_STRICT = v;
  };
  set(value);
  try {
    return fn();
  } finally {
    set(was);
  }
};

// Three blocks, whose code declares three names.
const three = (a, b, c) =>
  block(a) +
  block(b).replace('const x', 'const y') +
  block(c).replace('const x', 'const z');

test('the tests run with JSDOC_FLOW_STRICT=1, so engine errors throw', () => {
  assert.equal(process.env.JSDOC_FLOW_STRICT, '1');
});

test('a block that throws is reported once, and the rest still lint', () => {
  withStrict(undefined, () => {
    assert.deepEqual(lint(three('One. Two.', 'boom. Two.', 'Three. Four.')), [
      ['test/flaky', 'seen', 1, false],
      ['jsdoc-flow/sentence-spacing', 'sentence', 2, true],
      ['test/flaky', 'internal', 5, false],
      ['jsdoc-flow/sentence-spacing', 'sentence', 6, true],
      ['test/flaky', 'seen', 9, false],
      ['jsdoc-flow/sentence-spacing', 'sentence', 10, true],
    ]);
    // So does the next file.
    assert.deepEqual(lint(block('Five.')), [['test/flaky', 'seen', 1, false]]);
  });
});

test('a block that throws after finding a report reports only the error', () => {
  withStrict(undefined, () => {
    assert.deepEqual(lint(three('One.', 'late', 'Three.')), [
      ['test/flaky', 'seen', 1, false],
      ['test/flaky', 'internal', 5, false],
      ['test/flaky', 'seen', 9, false],
    ]);
  });
});

test('the error says how to see it', () => {
  withStrict(undefined, () => {
    const [m] = linter.verify(block('boom'), config, { filename: 'x.js' });
    assert.match(m.message, /could not process this block.*JSDOC_FLOW_STRICT/);
  });
});

test('with JSDOC_FLOW_STRICT=1, a block that throws fails the run', () => {
  withStrict('1', () => {
    assert.throws(() => lint(three('One.', 'boom', 'Three.')), /boom/);
  });
});
