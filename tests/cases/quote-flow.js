// The `jsdoc-flow/quote-flow` cases, shared by its own tests and the tests of
// all the rules together.  A blockquote's text is flowed as a paragraph is,
// inside a `> ` for each level, and each quote is reported from its first `>`
// to the end of its text.
import { block } from '../helpers.js';

// A narrow width keeps the inputs short:  ` * > ` leaves 36 columns of text.
const narrow = { 'jsdoc-flow': { width: 42 } };

// An error on a quote from a line and column of the file, to the end of
// the text on a later line.
const at = (line, column, endLine, endColumn) => ({
  messageId: 'quote',
  line,
  column,
  endLine,
  endColumn,
});

export const quoteValid = [
  {
    name: 'a flowed quote, nested, with paragraphs',
    code: block(
      'Intro.',
      '',
      '> A short quote.',
      '>',
      '> > A nested one.',
      '>',
      '> Back out.',
    ),
  },
  {
    name: 'a hard break is kept, at a backslash or a `<br>`',
    code: block('> Line one\\', '> line two<br>', '> line three.'),
  },
  {
    name: 'a quote in a tag description, and one indented under a list item',
    code: block('@param x - the x', '> A quote.', '- item', '  > A quote.'),
  },
  {
    name: 'a fence, a list, a heading, a table, and HTML keep a quote whole',
    code: block(
      '> ```js',
      '> const a  =  1;',
      '> ```',
      '',
      '> - one',
      '> - two',
      '',
      '> # Title',
      '> text',
      '',
      '> | a | b |',
      '> | - | - |',
      '',
      '> <div>',
      '> text',
      '> </div>',
    ),
  },
  {
    name: 'a quote with something kept in any of its paragraphs is kept whole',
    code: block('> Some', '> text.', '>', '> - one', '> - two'),
  },
  {
    name: 'indented code, a label above short lines, and a tag in a quote',
    code: block(
      '>     const a  =  1;',
      '>     a  +  1;',
      '',
      '> Usage:',
      '> run it',
      '> then stop',
      '',
      '> @see   foo',
      '> bar',
    ),
  },
  {
    name: 'lines starting at different columns, or four or more in, are kept',
    code: block('> Some', ' > text.', '', 'Text', '    > some', '    > text.'),
  },
  {
    name: 'a quote in a table, a fence, and an `@example` is kept',
    code: block(
      'a | b',
      '--|--',
      '> c | d',
      '> e',
      '',
      '```md',
      '> Some',
      '> text.',
      '```',
      '',
      '@example',
      '> Some',
      '> text.',
    ),
  },
  {
    name: 'whitespace that other rules fix is left to them',
    code: block('> A quote.  ', '', '>​quote', '', '> a\tb', '', '>  '),
  },
  {
    name: 'a one-line block is left to `single-line`',
    code: 'class A {\n  /** > A short quote. */\n  x = 1;\n}\n',
  },
  {
    name: 'a block with an ignore marker',
    code: '// jsdoc-flow-ignore\n' + block('> Some', '> text   that is kept.'),
  },
  {
    name: 'a block with a verbatim tag',
    code: block('@license MIT', '', '> Some', '> text   that is kept.'),
  },
  {
    name: 'a quote of only markers',
    code: block('>', '> >', '>'),
  },
];

export const quoteInvalid = [
  {
    name: 'a long quote wraps',
    code: block(
      '> Note: this runs before the cache is warmed, so the first call may be slow and should not be timed.',
    ),
    output: block(
      '> Note:  this runs before the cache is warmed, so the first call may be',
      '> slow and should not be timed.',
    ),
    errors: [at(2, 4, 2, 104)],
  },
  {
    name: 'short lines join',
    code: block('> A short', '> quote,', '> on three lines.'),
    output: block('> A short quote, on three lines.'),
    errors: [at(2, 4, 4, 21)],
  },
  {
    name: 'a nested quote keeps its level, and each level is filled on its own',
    settings: narrow,
    code: block(
      '> Outer',
      '> text.',
      '> > Inner text, long enough to wrap at this width.',
      '> Outer again.',
    ),
    output: block(
      '> Outer text.',
      '> > Inner text, long enough to wrap',
      '> > at this width.',
      '> Outer again.',
    ),
    errors: [at(2, 4, 5, 18)],
  },
  {
    name: 'a marker without a space gets one',
    code: block('>No space', '>', '>>Nested,', '>  >  wide.'),
    output: block('> No space', '>', '> > Nested, wide.'),
    errors: [at(2, 4, 5, 15)],
  },
  {
    name: 'paragraphs on either side of a bare `>` stay apart',
    code: block('> One', '> two.', '>', '>Three', '> four.'),
    output: block('> One two.', '>', '> Three four.'),
    errors: [at(2, 4, 6, 11)],
  },
  {
    name: 'a hard break stays, and the text after it is filled on its own',
    code: block('> Line one\\', '> line two', '> and three.'),
    output: block('> Line one\\', '> line two and three.'),
    errors: [at(2, 4, 4, 16)],
  },
  {
    name: 'an inline tag, a link, and a code span are never broken',
    settings: narrow,
    code: block(
      '> See {@link Foo bar baz} and [a long link](https://example.com) and `a b c d` now.',
    ),
    output: block(
      '> See {@link Foo bar baz} and',
      '> [a long link](https://example.com)',
      '> and `a b c d` now.',
    ),
    errors: [at(2, 4, 2, 87)],
  },
  {
    name: 'text in a quote is spaced as reflow spaces a paragraph',
    code: block('> One. Two  three: four ,  {@link  Foo }.'),
    output: block('> One.  Two three:  four, {@link Foo}.'),
    errors: [at(2, 4, 2, 45)],
  },
  {
    name: 'two quotes in a block are reported apart',
    code: block('> One', '> two.', '', 'Text.', '', '> Three', '> four.'),
    output: block('> One two.', '', 'Text.', '', '> Three four.'),
    errors: [at(2, 4, 3, 10), at(7, 4, 8, 11)],
  },
  {
    name: "a quote's whitespace before its markers is kept, and the star moved",
    code: [
      '/**',
      ' *  > Some',
      '   *  > text.',
      ' */',
      'export const x = 1;',
      '',
    ].join('\n'),
    output: block(' > Some text.'),
    errors: [at(2, 5, 3, 14)],
  },
  {
    name: "a quote in a tag's description",
    code: block('@param x - the x', '> Some', '> text.'),
    output: block('@param x - the x', '> Some text.'),
    errors: [at(3, 4, 4, 11)],
  },
  {
    name: 'trailing and exotic whitespace go with a fix',
    code: block('> Some  ', '>\ttext here.'),
    output: block('> Some text here.'),
    errors: [at(2, 4, 3, 16)],
  },
  {
    name: 'one space after a sentence end, with one-space settings',
    settings: { 'jsdoc-flow': { spaces: 1 } },
    code: block('> One.  Two', '> three.'),
    output: block('> One. Two three.'),
    errors: [at(2, 4, 3, 12)],
  },
  {
    name: 'an indented block',
    code: [
      'class A {',
      '  /**',
      '   * > Some',
      '   * > text.',
      '   */',
      '  x = 1;',
      '}',
      '',
    ].join('\n'),
    output: [
      'class A {',
      '  /**',
      '   * > Some text.',
      '   */',
      '  x = 1;',
      '}',
      '',
    ].join('\n'),
    errors: [at(3, 6, 4, 13)],
  },
  {
    name: 'a quote beside the `/**` is flowed as the block will be spread',
    code: '/** > Some\n * > text.\n */\nexport const x = 1;\n',
    output: '/**\n * > Some text.\n */\nexport const x = 1;\n',
    errors: [at(1, 5, 2, 11)],
  },
  {
    name: 'a one-line block is flowed as `single-line` spreads it',
    code: '/** > A short  quote. */\nexport const x = 1;\n',
    output: '/**\n * > A short quote.\n */\nexport const x = 1;\n',
    errors: [at(1, 5, 1, 25)],
  },
];

// The safety net:  `\u0001` is the engine's own stand-in for a masked space,
// so a quote holding one would come out with a space in its place.
// That changes a word, so the rule reports it without a fix.
export const quoteUnsafe = [
  {
    name: 'no fix when flowing would change more than whitespace',
    code: block('> a\u0001b  c.'),
    output: null,
    errors: [{ messageId: 'unsafe' }],
  },
];
