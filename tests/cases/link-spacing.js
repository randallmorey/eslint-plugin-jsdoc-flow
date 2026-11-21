// The `jsdoc-flow/link-spacing` cases, shared by its own tests and the tests
// of all the rules together.  Inside an inline tag such as `{@link ...}` and
// a Markdown link's text, one space separates words and none pads the text,
// and each bad gap is reported from the word before it to the word after it.
import { block } from '../helpers.js';

// An error on a line of the file whose text is `text`, after ` * `,
// highlighting `shown` in it.
const at = (line, text, shown, prefix = 3) => {
  const column = prefix + 1 + text.indexOf(shown);
  return {
    messageId: 'link',
    line,
    column,
    endLine: line,
    endColumn: column + shown.length,
  };
};

export const linkValid = [
  {
    name: 'inline tags and links spaced as reflow writes them',
    code: block(
      'Wraps {@link Store#save the save method} and returns',
      'a [promise of the result](https://example.com/p), as',
      '{@linkcode Foo}, {@linkplain Bar baz}, {@tutorial intro} and',
      '[the docs][docs] say.',
    ),
  },
  {
    name: 'a pipe with or without a space beside it',
    code: block('See {@link Foo|bar} or {@link Foo | bar}.'),
  },
  {
    name: 'spaces in a `{Type}`, an optional name, and a code span',
    code: block(
      "@param {string  |  number} [name='a  b'] - the name, as",
      '`{@link  Foo }` or `[ a  b ](c)`',
    ),
  },
  {
    name: "spaces in a link's destination and a reference's label",
    code: block('See [the docs](u  "a  title") and [them][ the  docs ].'),
  },
  {
    name: 'spaces in a code span in link text',
    code: block('See [a `b  c` d](u) and {@link Foo `x  y`}.'),
  },
  {
    name: "a gap across a line break, which is reflow's",
    code: block('See {@link Foo', 'bar} and [the', 'docs](u).'),
  },
  {
    name: "a tab, which is `no-exotic-whitespace`'s",
    code: block('See {@link\tFoo} and [a\tb](c).'),
  },
  {
    name: "brackets that aren't a link, and braces that aren't a tag",
    code: block('See [ a  b ] and { @link  Foo } and {@link  Foo.'),
  },
  {
    name: 'a table, a heading, a quote, and code, which are kept',
    code: block(
      '# See {@link  Foo }',
      '',
      '| a | {@link  Foo } |',
      '| - | -            |',
      '',
      '> See [ a  b ](c).',
      '',
      '```js',
      "const a = '{@link  Foo }';",
      '```',
      '@example',
      '[ a ](b)',
    ),
  },
  {
    name: 'an empty inline tag and link text',
    code: block('See {@link} and [](u).'),
  },
];

export const linkInvalid = [
  {
    name: 'an inline tag and a link with runs of spaces',
    code: block(
      'Wraps {@link   Store#save  the save method } and returns',
      'a [promise   of the result](https://example.com/p).',
    ),
    output: block(
      'Wraps {@link Store#save the save method} and returns',
      'a [promise of the result](https://example.com/p).',
    ),
    errors: [
      at(
        2,
        'Wraps {@link   Store#save  the save method } and returns',
        '{@link   Store#save',
      ),
      at(
        2,
        'Wraps {@link   Store#save  the save method } and returns',
        'Store#save  the',
      ),
      at(
        2,
        'Wraps {@link   Store#save  the save method } and returns',
        'method }',
      ),
      at(
        3,
        'a [promise   of the result](https://example.com/p).',
        '[promise   of',
      ),
    ],
  },
  {
    name: 'spaces just inside the brackets of link text',
    code: block('See [ the docs ](https://x.y).'),
    output: block('See [the docs](https://x.y).'),
    errors: [
      at(2, 'See [ the docs ](https://x.y).', '[ the'),
      at(2, 'See [ the docs ](https://x.y).', 'docs ](https://x.y).'),
    ],
  },
  {
    name: "a reference link's text, but not its label",
    code: block('See [ the  docs][ the  docs ].'),
    output: block('See [the docs][ the  docs ].'),
    errors: [
      at(2, 'See [ the  docs][ the  docs ].', '[ the'),
      at(2, 'See [ the  docs][ the  docs ].', 'the  docs]['),
    ],
  },
  {
    name: 'other inline tags',
    code: block(
      'As {@linkcode  Foo}, {@linkplain Bar  baz } or {@tutorial  a}.',
    ),
    output: block('As {@linkcode Foo}, {@linkplain Bar baz} or {@tutorial a}.'),
    errors: [
      at(
        2,
        'As {@linkcode  Foo}, {@linkplain Bar  baz } or {@tutorial  a}.',
        '{@linkcode  Foo},',
      ),
      at(
        2,
        'As {@linkcode  Foo}, {@linkplain Bar  baz } or {@tutorial  a}.',
        'Bar  baz',
      ),
      at(
        2,
        'As {@linkcode  Foo}, {@linkplain Bar  baz } or {@tutorial  a}.',
        'baz }',
      ),
      at(
        2,
        'As {@linkcode  Foo}, {@linkplain Bar  baz } or {@tutorial  a}.',
        '{@tutorial  a}.',
      ),
    ],
  },
  {
    name: 'an inline tag of only spaces',
    code: block('See {@inheritDoc   }.'),
    output: block('See {@inheritDoc}.'),
    errors: [at(2, 'See {@inheritDoc   }.', '{@inheritDoc   }.')],
  },
  {
    name: 'spaces around a pipe, which keeps one on each side',
    code: block('See {@link Foo   |  bar}.'),
    output: block('See {@link Foo | bar}.'),
    errors: [
      at(2, 'See {@link Foo   |  bar}.', 'Foo   |'),
      at(2, 'See {@link Foo   |  bar}.', '|  bar}.'),
    ],
  },
  {
    name: 'link text around a code span, which is kept',
    code: block('See [a  `b  c`  d](u).'),
    output: block('See [a `b  c` d](u).'),
    errors: [
      at(2, 'See [a  `b  c`  d](u).', '[a  `b'),
      at(2, 'See [a  `b  c`  d](u).', 'c`  d](u).'),
    ],
  },
  {
    name: 'a tab and a space, and a zero-width space before a `}`',
    code: block('See {@link Foo\t bar\u200b}.'),
    output: block('See {@link Foo bar}.'),
    errors: [
      at(2, 'See {@link Foo\t bar\u200b}.', 'Foo\t bar'),
      at(2, 'See {@link Foo\t bar\u200b}.', 'bar\u200b}.'),
    ],
  },
  {
    name: "a link in a tag's description and a list item",
    code: block('@param x - see {@link  Foo}', '', '- [ a ](b)'),
    output: block('@param x - see {@link Foo}', '', '- [a](b)'),
    errors: [
      at(2, '@param x - see {@link  Foo}', '{@link  Foo}'),
      at(4, '- [ a ](b)', '[ a'),
      at(4, '- [ a ](b)', 'a ](b)'),
    ],
  },
  {
    name: 'a span crossing lines, fixed on each line but not across',
    code: block('See {@link  Foo', 'bar  baz } and [ a', 'b ](c).'),
    output: block('See {@link Foo', 'bar baz} and [a', 'b](c).'),
    errors: [
      at(2, 'See {@link  Foo', '{@link  Foo'),
      at(3, 'bar  baz } and [ a', 'bar  baz'),
      at(3, 'bar  baz } and [ a', 'baz }'),
      at(3, 'bar  baz } and [ a', '[ a'),
      at(4, 'b ](c).', 'b ](c).'),
    ],
  },
  {
    name: 'a one-line block',
    code: '/** See {@link  Foo }. */\nexport const x = 1;\n',
    output: '/** See {@link Foo}. */\nexport const x = 1;\n',
    errors: [
      at(1, 'See {@link  Foo }.', '{@link  Foo', 4),
      at(1, 'See {@link  Foo }.', 'Foo }.', 4),
    ],
  },
  {
    name: 'text beside the delimiters',
    code: '/** See {@link  Foo}\n * and [ a ](b). */\nexport const x = 1;\n',
    output: '/** See {@link Foo}\n * and [a](b). */\nexport const x = 1;\n',
    errors: [
      at(1, 'See {@link  Foo}', '{@link  Foo}', 4),
      at(2, 'and [ a ](b). */', '[ a'),
      at(2, 'and [ a ](b). */', 'a ](b).'),
    ],
  },
];
