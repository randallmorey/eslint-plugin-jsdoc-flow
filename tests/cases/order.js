// Blocks that once settled on different text with one rule fixed first, as
// random testing found (see `properties.test.js`), each with the text that all
// the rules settle on in any order.  A zero-width space is whitespace to every
// rule, as it is to `no-exotic-whitespace`, a tab after a line's `*` is its
// one space, and the whitespace before a one-liner's text is the one space's
// excess unless it makes the text indented code.
import { block } from '../helpers.js';

const narrow = { 'jsdoc-flow': { width: 40 } };
const oneSpace = { 'jsdoc-flow': { width: 40, spaces: 1 } };
const code = (...lines) => `${lines.join('\n')}\nexport const x = 1;\n`;

export const orderCases = [
  {
    name: 'a one-liner of only a zero-width space',
    code: code('/** \u200b */'),
    output: block(''),
  },
  {
    name: 'a zero-width space before the text',
    code: code('/**', ' * \u200b returns', ' */'),
    output: block('returns'),
  },
  {
    name: 'a zero-width space between `[` and a word',
    settings: oneSpace,
    code: code('/** the   [\u200bthe */'),
    output: block('the [the'),
  },
  {
    name: 'a zero-width space that a wrap would put at the start of a line',
    settings: oneSpace,
    code: code(
      '/**',
      ' * a [x] http://example.com/a.b \u200b {@link Foo}',
      ' */',
    ),
    output: block('a [x]', 'http://example.com/a.b {@link Foo}'),
  },
  {
    name: 'a zero-width space after a sentence end',
    settings: narrow,
    code: code(
      '/**',
      ' * @throws {Error} {@link Foo} end? \u200b > the { | i.e.',
      ' */',
    ),
    output: block('@throws {Error} {@link Foo} end?  > the { | i.e.'),
  },
  {
    name: 'a zero-width space between the words of a line too wide',
    settings: oneSpace,
    code: code('/** the the the the the the { the\u200b</pre> */'),
    output: block('the the the the the the {', 'the </pre>'),
  },
  {
    name: 'a one-liner indented enough to be code',
    code: code('/**     [x](http://y) */'),
    output: block('    [x](http://y)'),
  },
  {
    name: 'a one-liner indented less than code, before a list marker',
    code: code('/**   1. */'),
    output: block('1.'),
  },
  {
    name: 'a one-liner indented with a tab, before a heading',
    code: code('/** \t# */'),
    output: block('#'),
  },
  {
    name: 'a tab after the `*`, then enough spaces to be code',
    code: code('/**', ' *\t    the', ' *', ' *\t-', ' */'),
    output: code('/**', ' *\t    the', ' *', ' * -', ' */'),
  },
  {
    name: 'a tab after the `*` of the line that closes a `{Type}`',
    settings: narrow,
    code: code(
      '/**',
      ' *\t@param {{',
      ' *  a: string',
      ' *\t}} o - the paren) the http://example.com/a.b',
      ' */',
    ),
    output: block(
      '@param {{',
      ' a: string',
      '}} o - the paren)',
      '       the http://example.com/a.b',
    ),
  },
  {
    name: 'a tag whose line is indented too far',
    code: code(
      '/**',
      ' *  @typedef {object} Options the options that a caller passes to the function,',
      ' * which it reads once',
      ' */',
    ),
    output: block(
      '@typedef {object} Options the options that a caller passes to the function,',
      '                          which it reads once',
    ),
  },
  {
    name: "a space in a tag's head that `no-extra-punctuation-space` removes",
    settings: { 'jsdoc-flow': { width: 60 } },
    code: code(
      '/**',
      ' * @typedef {object} T[ the the the the the Foo|bar}',
      ' * the the',
      ' */',
    ),
    output: block(
      '@typedef {object} T[the the the the the Foo|bar}',
      '                        the the',
    ),
  },
];
