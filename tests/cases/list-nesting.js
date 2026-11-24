// The `jsdoc-flow/list-nesting` cases, shared by its own tests and the tests
// of all the rules together.  An item two or more columns past the marker of
// the item above it, but short of its text, renders as a sibling in
// CommonMark, so the fix moves it, its wrapped lines, and its own children
// under that item's text, changing only their indentation.
import { block } from '../helpers.js';

const nestErrors = (n) => Array(n).fill({ messageId: 'nest' });

export const nestingValid = [
  {
    name: "nested items at or past their parent's text",
    code: block(
      '1. Parse the block.',
      '   - Tokens first.',
      '     continued',
      '10. Then the rest.',
      '    - Under ten.',
      '      * Deeper.',
      '- A bullet.',
      '  + Under it.',
      '     - Past its text.',
    ),
  },
  {
    name: 'siblings at the same column',
    code: block('1. one', '2. two', '- a', '- b', '  - c', '  - d'),
  },
  {
    // One column is a slip, which `bullet-indent` lines up with
    // the siblings.
    name: "an item one column past its sibling's marker is left to `bullet-indent`",
    code: block('1. one', ' 2. two', ' - three', '- four', ' - five'),
  },
  {
    name: 'an item before the marker above it is a sibling of an outer item',
    code: block('1. one', '   1. inner', ' - back out'),
  },
  {
    name: 'lists in fenced code, indented code, and `@example` are skipped',
    code: block(
      '```',
      '1. a',
      '  - b',
      '```',
      '',
      '    1. a',
      '      - b',
      '',
      '@example',
      '1. a',
      '  - b',
    ),
  },
  {
    name: 'a list in a table or a blockquote is skipped',
    code: block('| 1. a |', '|---|', '|  - b |', '', '> 1. a', '>   - b'),
  },
  {
    // A list laid out by hand in columns is kept as it is.
    name: 'a list laid out by hand',
    code: block('1. one     the first', '  - two     the second'),
  },
  {
    // Moved under `10.`'s text after a blank line, `- a` would be indented
    // code, so the list has no fix.
    name: 'a list whose fix would make an item indented code',
    code: block('10. ten', '', '   - a'),
  },
  {
    name: 'a block with an ignore comment',
    code: `// jsdoc-flow-ignore\n${block('1. one', '  - two')}`,
  },
  {
    name: 'a block with a verbatim tag',
    code: block('@license', '1. one', '  - two'),
  },
];

export const nestingInvalid = [
  {
    name: "an item short of an ordered parent's text",
    code: block('1. Parse the block.', '  - Tokens first.', '2. Then.'),
    output: block('1. Parse the block.', '   - Tokens first.', '2. Then.'),
    // The highlight starts at the marker, short of the column.
    errors: [
      { messageId: 'nest', line: 3, column: 6, endLine: 3, endColumn: 21 },
    ],
  },
  {
    name: 'an ordered item under a bullet, with a bullet under it',
    code: block('- a', '  1) b', '    + c', '    * d'),
    output: block('- a', '  1) b', '     + c', '     * d'),
    errors: nestErrors(2),
  },
  {
    name: 'markers of different widths',
    code: block('9. nine', '  - a', '10. ten', '  - b', '   - c'),
    output: block('9. nine', '   - a', '10. ten', '    - b', '    - c'),
    errors: nestErrors(3),
  },
  {
    name: 'a deeper level',
    code: block('1. a', '   1. b', '     - c', '   2. d'),
    output: block('1. a', '   1. b', '      - c', '   2. d'),
  },
  {
    name: "an item under an outer item's marker, past an inner list",
    code: block('1. a', '   1. b', '  - c'),
    output: block('1. a', '   1. b', '   - c'),
  },
  {
    name: 'wrapped lines move with the item, and stay under its text',
    code: block(
      '1. Parse the block.',
      '  - Tokens first, then',
      '    the rest, and',
      '   more.',
      '2. Then.',
    ),
    output: block(
      '1. Parse the block.',
      '   - Tokens first, then',
      '     the rest, and',
      '     more.',
      '2. Then.',
    ),
  },
  {
    name: 'children move with their parent',
    code: block('1. a', '  - b', '    - c', '      wrapped', '  - d'),
    output: block('1. a', '   - b', '     - c', '       wrapped', '   - d'),
    errors: [
      { messageId: 'nest' },
      { messageId: 'follow', line: 4 },
      { messageId: 'nest' },
    ],
  },
  {
    name: 'items after blank lines, in a loose list',
    code: block('1. a', '', '  - b', '', '  - c'),
    output: block('1. a', '', '   - b', '', '   - c'),
    errors: nestErrors(2),
  },
  {
    name: "an item in a tag's description",
    code: block('@param opts - the steps:', '1. one', '  - first', '2. two'),
    output: block('@param opts - the steps:', '1. one', '   - first', '2. two'),
  },
  {
    name: "the fix puts each line's `*` under the `/**`",
    code: [
      '/**',
      ' * 1. one',
      '   *   - two,',
      '  *    wrapped',
      ' */',
      'export const x = 1;',
      '',
    ].join('\n'),
    output: block('1. one', '   - two,', '     wrapped'),
  },
  {
    name: 'a block with text beside its delimiters',
    code: '/** 1. one\n *   - two */\nexport const x = 1;\n',
    output: '/** 1. one\n *    - two */\nexport const x = 1;\n',
  },
  {
    name: 'nested indentation (a class member)',
    code: [
      'class A {',
      '  /**',
      '   * 1. one',
      '   *   - two',
      '   */',
      '  m() {}',
      '}',
      '',
    ].join('\n'),
    output: [
      'class A {',
      '  /**',
      '   * 1. one',
      '   *    - two',
      '   */',
      '  m() {}',
      '}',
      '',
    ].join('\n'),
  },
].map((c) => ({ errors: nestErrors(1), ...c }));

// Lists that `list-nesting` nests and that `bullet-indent` and `bullet-align`
// then line up, which all the rules settle on in any order.
export const nestingMixed = [
  {
    name: 'an item nested once its parent is lined up',
    code: block(' - a', '1. b', '  - c,', '    wrapped', ' - d'),
  },
  {
    name: 'a misnested list with misaligned siblings and wrapped lines',
    code: block(
      '1. one,',
      '  wrapped',
      '  - two,',
      '      wrapped',
      '   - three',
      ' 2. four',
      '   - five',
    ),
  },
];
