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
  {
    name: 'a paragraph indented as code after a fence',
    code: code(
      '/**',
      ' * ```',
      ' * a',
      ' * ```',
      ' *     One',
      ' *      two.',
      ' */',
    ),
    output: block('```', 'a', '```', '', 'One two.'),
  },
  {
    name: 'a fence between paragraphs, with extra blank lines',
    code: code(
      '/**',
      ' *',
      ' * One',
      ' * two:',
      ' * ```js',
      ' * a();',
      ' * ```',
      ' * Three',
      ' *',
      ' *',
      ' */',
    ),
    output: block('One two:', '', '```js', 'a();', '```', '', 'Three'),
  },
  {
    name: 'a heading beside the `/**`',
    code: code('/** # One', ' * Two  three. */'),
    output: block('# One', '', 'Two three.'),
  },
  {
    name: 'a ragged table beside the `*/`, with a tab and spaces to fix',
    code: code(
      '/** One',
      ' * two:',
      ' * | a |\tbb |  ',
      ' *   |-|:-:|',
      ' * | ccc\u200b | d | */',
    ),
    output: block(
      'One two:',
      '',
      '| a   | bb  |',
      '  | -   | :-: |',
      '| ccc |  d  |',
    ),
  },
  {
    name: "a table too wide to align in a tag's description",
    settings: narrow,
    code: code(
      '/**',
      ' * @param o - the options,  which are:',
      ' * |Name|Use|',
      ' * |--|--|',
      ' * |`a`|the first one, which is long enough|',
      ' * @returns  it',
      ' */',
    ),
    output: block(
      '@param o - the options, which are:',
      '',
      '| Name | Use |',
      '| -- | -- |',
      '| `a` | the first one, which is long enough |',
      '@returns it',
    ),
  },
  {
    name: 'a table with no edge pipes after a heading, with text after it',
    code: code(
      '/**',
      ' * # Table',
      ' * a | b',
      ' * :-:|-:',
      ' * one | two',
      ' *',
      ' * Text',
      ' * after.',
      ' */',
    ),
    output: block(
      '# Table',
      '',
      'a   |   b',
      ':-: |  -:',
      'one | two',
      '',
      'Text after.',
    ),
  },
  {
    name: 'badly spaced links, which wrap as their spaced text does',
    settings: narrow,
    code: code(
      '/**',
      ' * Calls {@link   Store#save  the save method } and then',
      ' * returns a [ promise   of the result ](https://x.y).',
      ' */',
    ),
    output: block(
      'Calls {@link Store#save the save method}',
      'and then returns',
      'a [promise of the result](https://x.y).',
    ),
  },
  {
    name: "a badly spaced link in a tag's head, which sets its hang",
    settings: narrow,
    code: code(
      '/**',
      ' * @see {@link   Foo  bar } which is the one we want',
      ' *   to see here, and the rest.',
      ' */',
    ),
    output: block(
      '@see {@link Foo bar} which is',
      '                     the one we',
      '                     want to see',
      '                     here,',
      '                     and the rest.',
    ),
  },
  {
    name: 'badly spaced links across lines',
    code: code(
      '/**',
      ' * See {@link  Foo',
      ' * bar  } and [ a',
      ' * b ](c).',
      ' */',
    ),
    output: block('See {@link Foo bar} and [a b](c).'),
  },
  {
    name: 'a one-liner with a badly spaced link',
    settings: narrow,
    code: code('/** See {@link   Foo   } now, then go. */'),
    output: block('See {@link Foo} now, then go.'),
  },
  {
    name: 'a space inside a link before a capital or a number',
    code: code(
      '/**',
      ' * One etc. [ Foo](u) two.  Mr. [ Smith ](u) and No. [ 5](u).',
      ' */',
    ),
    output: block('One etc.  [Foo](u) two.  Mr. [Smith](u) and No. [5](u).'),
  },
  {
    name: 'a tab and a zero-width space inside links',
    settings: oneSpace,
    code: code('/** See [​ a\t b ](c) and {@link Foo |\tbar }. */'),
    output: block('See [a b](c) and {@link Foo | bar}.'),
  },
];
