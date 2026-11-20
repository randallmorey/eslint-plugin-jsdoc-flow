// Tests for what keeps autofix safe:  the guards that drop a fix that would
// change more than whitespace, or any code, and the isolation that reports
// a block that throws without failing the whole run.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Linter } from 'eslint';

import plugin from '../lib/index.js';
import { onlyWhitespace, reflowComment, safeReflow } from '../lib/flow.js';
import { blockRule, fixesOf } from '../lib/rules/block.js';
import { block } from './helpers.js';

// A rule that throws on a block holding `boom`, and on one holding `late`
// only once it has found a report, and otherwise reports each block.
const flaky = blockRule(
  { messages: { seen: 'Seen.' } },
  () => (comment, text) => {
    if (text.includes('boom')) throw new Error('boom');
    const seen = { loc: comment.loc, messageId: 'seen' };
    if (!text.includes('late')) return [seen];
    // An edit past the block's last line, which `fixesOf` can't place.
    const edit = { at: 99, start: 0, end: 0, text: ' ' };
    const [fix] = fixesOf(comment, text, '', {}, [edit]);
    return [seen, { ...seen, fix }];
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

// A rule that reports each of some edits to every block, fixed by `fixesOf`.
const editing = (edits) =>
  blockRule(
    { messages: { edit: 'Edit.' } },
    () => (comment, text, indent, options) => {
      const fixes = fixesOf(comment, text, indent, options, edits);
      return fixes.map((fix) => ({ loc: comment.loc, messageId: 'edit', fix }));
    },
  );
// Which of the edits get a fix, in a block of text and fenced code.
const fixed = (...edits) =>
  linter
    .verify(
      block('One two.', '```', '  code', '```'),
      {
        files: ['**/*.js'],
        plugins: { test: { rules: { editing: editing(edits) } } },
        rules: { 'test/editing': 'warn' },
      },
      { filename: 'x.js' },
    )
    .map((m) => !!m.fix);

// Line 1 is ` * One two.`, and line 3, ` *   code`, is code.
test('an edit that changes only whitespace is fixed', () => {
  assert.deepEqual(fixed({ at: 1, start: 6, end: 7, text: '  ' }), [true]);
});

test("an edit that moves a line's `*` is fixed, as `tag-align`'s do", () => {
  assert.deepEqual(fixed({ at: 1, start: 0, end: 3, text: '  *  ' }), [true]);
  assert.deepEqual(fixed({ at: 3, start: 0, end: 1, text: '  ' }), [true]);
});

test('an edit that changes more than whitespace gets no fix', () => {
  for (const edit of [
    { at: 1, start: 6, end: 7, text: '_' },
    { at: 1, start: 3, end: 6, text: ' ' },
    { at: 1, start: 0, end: 3, text: ' ' },
  ])
    assert.deepEqual(fixed(edit), [false], JSON.stringify(edit));
});

test('an edit across a line break gets no fix', () => {
  for (const edit of [
    { at: 1, start: 11, end: 13, text: ' ' },
    { at: 1, start: 6, end: 6, text: '\n' },
  ])
    assert.deepEqual(fixed(edit), [false], JSON.stringify(edit));
});

test("edits that change code's whitespace get no fix, nor do the others", () => {
  assert.deepEqual(fixed({ at: 3, start: 3, end: 4, text: '' }), [false]);
  assert.deepEqual(fixed({ at: 3, start: 3, end: 3, text: ' ' }), [false]);
  assert.deepEqual(
    fixed(
      { at: 1, start: 6, end: 7, text: '  ' },
      { at: 3, start: 2, end: 3, text: '  ' },
    ),
    [false, false],
  );
});

// A block's text, as `reflow` sees it.
const text = (...lines) => block(...lines).split('\nexport')[0];

test('a reflow that changes only whitespace is safe', () => {
  const was = text('One. Two', 'three.', '', '```', '  a  =  1;', '```');
  const now = reflowComment(was, '');
  assert.notEqual(now, was);
  assert.ok(safeReflow(was, now, ''));
  assert.ok(onlyWhitespace('/** One. */', text('One.')));
});

test('a reflow that changes, joins or splits a word is not safe', () => {
  const was = text('One two.');
  for (const now of [
    text('One too.'),
    text('One two'),
    text('Onetwo.'),
    text('O ne two.'),
    text('One two.', '*'),
  ])
    assert.equal(safeReflow(was, now, ''), false, now);
});

test("a reflow that isn't a well-formed block is not safe", () => {
  const was = text('One two.');
  for (const now of [
    '/**\n * One two.\n *',
    '/**\n * One two.\n */ */',
    '/**\n * One */ two.\n */',
    '/**\n One two.\n */',
    '/*\n * One two.\n **/',
    '/**\n * One two.\n */\n',
  ])
    assert.equal(safeReflow(was, now, ''), false, now);
});

test('a reflow that changes code, even its whitespace, is not safe', () => {
  const was = text('One.', '', '```', '  a  =  1;', '```');
  for (const now of [
    text('One.', '', '```', 'a = 1;', '```'),
    text('One.', '', '```', '  a  =  1;  ', '```'),
    text('One.', '', '```', '  a  =  1;', '', '```'),
    text('One.', '', '```', '  a  =', '  1;', '```'),
  ])
    assert.equal(safeReflow(was, now, ''), false, now);
  // Its line's prefix may change.
  assert.ok(safeReflow(was, was.replace(' *   a', '   *   a'), ''));
});

test('a reflow that turns text into code is not safe', () => {
  const was = text('One two ``` three.');
  assert.equal(safeReflow(was, text('One two ```', 'three.'), ''), true);
  assert.equal(safeReflow(was, text('One two', '``` three.'), ''), false);
});
