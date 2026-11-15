// Tests of the thresholds in `flow.js`, each at its limit and one on either
// side:  the widest label and the lines after it that stay as they are, the
// margin and the punctuation that may hang past it, the widest head with its
// description beside it, and the abbreviations that don't end a sentence.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { reflowComment } from '../lib/flow.js';

const block = (...lines) =>
  ['/**', ...lines.map((l) => (l ? ` * ${l}` : ' *')), ' */'].join('\n');
const reflow = (text, options) => reflowComment(text, '', 80, options);
// No limit but the width decides where a line breaks.
const free = {
  orphans: { sentence: false, clause: false, paren: false },
  names: false,
  shortWords: false,
  widows: 0,
};
const sides = (limit) => [limit - 1, limit, limit + 1];

// A label is a line ending in `:` with at most 24 characters other than
// whitespace, and the short lines after it stay as they are.
for (const size of sides(24)) {
  test(`a label of ${size} characters keeps the lines after it, up to 24`, () => {
    const label = `A ${'b'.repeat(size - 2)}:`;
    const text = block(label, 'one', 'two');
    assert.equal(reflow(text), size <= 24 ? text : block(`${label}  one two`));
  });
}

// Each line after a label has at most 50 characters other than whitespace.
for (const size of sides(50)) {
  test(`a line of ${size} characters after a label is kept, up to 50`, () => {
    const line = `${'x'.repeat(size - 1)} y`;
    const text = block('Options:', line, 'two');
    assert.equal(
      reflow(text),
      size <= 50 ? text : block(`Options:  ${line} two`),
    );
  });
}

// At width 80, a line may be 78 columns, two short of it, or 79 if it ends in
// punctuation that hangs.
// The first two words of a paragraph stay together, so the line breaks
// before the third.
const lineOf = (columns, end = 'b') => [
  'a a',
  `${'b'.repeat(columns - ' * a a '.length - end.length)}${end}`,
];
for (const columns of sides(78)) {
  test(`a line of ${columns} columns fits at width 80, up to 78`, () => {
    const [a, b] = lineOf(columns);
    const text = block(a, b);
    assert.equal(reflow(text, free), columns <= 78 ? block(`${a} ${b}`) : text);
  });
}

for (const mark of '.,;:!?)]\'"\u2019\u201d') {
  test(`\`${mark}\` may hang one column past the margin, and no more`, () => {
    const [a, b] = lineOf(79, mark);
    assert.equal(reflow(block(a, b), free), block(`${a} ${b}`));
    assert.equal(reflow(block(a, b), { ...free, hang: false }), block(a, b));
    const [c, d] = lineOf(80, mark);
    assert.equal(reflow(block(c, d), free), block(c, d));
  });
}

for (const mark of '-(*_>/') {
  test(`\`${mark}\` doesn't hang past the margin`, () => {
    const [a, b] = lineOf(79, `b${mark}`);
    assert.equal(reflow(block(a, b), free), block(a, b));
  });
}

// A tag's head may be 44 columns at width 80, 0.55 of it, and have its
// description beside it, or as wide as `maxHead` says.
for (const [maxHead, limit] of [
  [undefined, 44],
  [0.3, 24],
]) {
  for (const head of sides(limit)) {
    test(`a head of ${head} columns has its description beside it, up to ${limit}`, () => {
      const name = 'n'.repeat(head - '@param  - '.length);
      const text = block(`@param ${name} - ${'word '.repeat(14).trim()}`);
      const [first, ...rest] = reflow(text, { maxHead })
        .split('\n')
        .slice(1, -1);
      const beside = head <= limit;
      assert.equal(first.length > ' * '.length + head, beside);
      for (const line of rest) {
        assert.equal(line.indexOf('word'), beside ? 3 + head : 5, line);
      }
    });
  }
}

// An abbreviation's period ends no sentence before a lowercase word, or
// before a name for those that come beside one, as in `Mr. Smith`.  `No.`
// and `Nos.` are words too, so only a number after them shows they're
// abbreviations.
const ABBREVIATIONS =
  'e.g i.e etc al a.k.a w.r.t esp incl approx vs cf fig eq sec ch vol pp ' +
  'a.m p.m a.d b.c a.c.e b.c.e dr mr mrs ms prof st jr sr inc ltd corp co';
const BESIDE_NAME = 'dr mr mrs ms prof st vs cf';
const spaced = (before, after, gap) => `/** One ${before}.${gap}${after} */`;
for (const abbr of ABBREVIATIONS.split(' ')) {
  test(`\`${abbr}.\` ends no sentence before a lowercase word`, () => {
    assert.equal(reflow(spaced(abbr, 'two', ' ')), spaced(abbr, 'two', ' '));
  });
  const beside = BESIDE_NAME.split(' ').includes(abbr);
  test(`\`${abbr}.\` ${beside ? 'ends no' : 'ends a'} sentence before a name`, () => {
    const gap = beside ? ' ' : '  ';
    assert.equal(
      reflow(spaced(abbr, 'Smith', ' ')),
      spaced(abbr, 'Smith', gap),
    );
  });
}
for (const abbr of ['no', 'nos', 'No', 'two']) {
  test(`\`${abbr}.\` ends no sentence before a number, but before a word`, () => {
    const gap = abbr === 'two' ? '  ' : ' ';
    assert.equal(reflow(spaced(abbr, '5', ' ')), spaced(abbr, '5', gap));
    assert.equal(reflow(spaced(abbr, 'two', ' ')), spaced(abbr, 'two', '  '));
  });
}
