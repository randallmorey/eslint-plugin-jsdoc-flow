// The `jsdoc-flow/bullet-align` cases, shared by its own tests and the tests
// of all the rules together.  A list item's wrapped lines start under its
// text, and the fix only re-indents them.
import { block } from '../helpers.js';

const alignErrors = (n) => Array(n).fill({ messageId: 'align' });

export const bulletAlignValid = [
  {
    name: 'bullets and numbered items, aligned',
    code: block(
      '- a bullet,',
      '  continued',
      '* another,',
      '  continued',
      '1. a numbered one,',
      '   continued',
      '10. ten,',
      '    continued',
    ),
  },
  {
    name: 'nested items, each under its own text',
    code: block(
      '- an outer one,',
      '  continued',
      '  - an inner one,',
      '    continued',
      '      * a deeper one,',
      '        continued',
    ),
  },
  {
    name: "an item in a tag's description, under the item's text",
    code: block(
      '@param opts - the options:',
      '- `a`, the first,',
      '  continued',
      '- `b`, the second',
    ),
  },
  {
    name: 'a blank line, a tag or another raw line ends an item',
    code: block(
      '- a bullet',
      '',
      'A paragraph.',
      '- a bullet',
      '@returns the result',
      '- a bullet',
      '| a | table |',
      'A paragraph.',
    ),
  },
  {
    name: "a marker's own spacing is `bullet-spacing`'s",
    code: block('-  a bullet,', '  continued'),
  },
  {
    name: 'bullets in fenced code, indented code and `@example` are skipped',
    code: block(
      '    - indented code',
      '    continued',
      '',
      '```',
      '- fenced',
      'continued',
      '```',
      '@example',
      '- an example',
      'continued',
    ),
  },
  {
    name: 'a one-line block',
    code: '/** - a bullet */\nexport const x = 1;\n',
  },
];

export const bulletAlignInvalid = [
  {
    // Text that starts before its column is highlighted from its start.
    name: "wrapped lines under the item's marker",
    errors: [
      { messageId: 'align', line: 3, column: 4, endLine: 3, endColumn: 13 },
    ],
    code: block('- a bullet,', 'continued'),
    output: block('- a bullet,', '  continued'),
  },
  {
    // Text that starts after its column is highlighted from its column, so
    // the whitespace it should lose is highlighted too.
    name: 'wrapped lines indented too far',
    errors: [
      { messageId: 'align', line: 3, column: 6, endLine: 3, endColumn: 16 },
    ],
    code: block('- a bullet,', '    and more'),
    output: block('- a bullet,', '  and more'),
  },
  {
    // So the fix doesn't depend on whether `bullet-spacing` fixes the marker
    // first.
    name: 'the text column is one space after the marker, as `bullet-spacing` spaces it',
    code: block('-   a bullet,', '    continued'),
    output: block('-   a bullet,', '  continued'),
  },
  {
    name: 'numbered items, with one digit and two',
    code: block('1. one,', 'continued', '10. ten,', 'continued'),
    output: block('1. one,', '   continued', '10. ten,', '    continued'),
    errors: alignErrors(2),
  },
  {
    name: 'nested items',
    code: block(
      '- an outer one,',
      'continued',
      '  * an inner one,',
      '  continued',
    ),
    output: block(
      '- an outer one,',
      '  continued',
      '  * an inner one,',
      '    continued',
    ),
    errors: alignErrors(2),
  },
  {
    name: 'each wrapped line is reported, and only those that are off',
    code: block('- one,', ' two,', '  three,', 'four'),
    output: block('- one,', '  two,', '  three,', '  four'),
    errors: alignErrors(2),
  },
  {
    // As in Markdown, a line right after an item is a lazy continuation.
    name: 'a paragraph right after an item, with no blank line, is its wrapped lines',
    code: block('- an item', 'Then more text.'),
    output: block('- an item', '  Then more text.'),
  },
  {
    name: "an item in a tag's description",
    code: block(
      '@param opts - the options:',
      '- `a`, the first,',
      '              continued',
    ),
    output: block(
      '@param opts - the options:',
      '- `a`, the first,',
      '  continued',
    ),
  },
  {
    name: "a wrapped line's own star is re-indented",
    code: [
      '/**',
      ' * - an item,',
      '   *   continued',
      ' */',
      'export const x = 1;',
      '',
    ].join('\n'),
    output: block('- an item,', '  continued'),
  },
  {
    name: 'nested indentation (a class member)',
    code: [
      'class A {',
      '  /**',
      '   * - a bullet,',
      '   * continued',
      '   */',
      '  m() {}',
      '}',
      '',
    ].join('\n'),
    output: [
      'class A {',
      '  /**',
      '   * - a bullet,',
      '   *   continued',
      '   */',
      '  m() {}',
      '}',
      '',
    ].join('\n'),
  },
].map((c) => ({ errors: alignErrors(1), ...c }));
