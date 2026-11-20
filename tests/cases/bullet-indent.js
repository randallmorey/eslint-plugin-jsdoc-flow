// The `jsdoc-flow/bullet-indent` cases, shared by its own tests and the tests
// of all the rules together.  The items at each level of a list start at
// the same column, nesting is read as CommonMark reads it, and the fix only
// re-indents the items' own lines, so the list renders the same.
import { block } from '../helpers.js';

const indentErrors = (n) => Array(n).fill({ messageId: 'indent' });

export const bulletIndentValid = [
  {
    name: 'a flat list, and nested items, each under its parent',
    code: block(
      '- one',
      '- two',
      '  - two a',
      '  - two b',
      '    1. two b one',
      '- three',
    ),
  },
  {
    name: "a nested list at the author's own depth",
    code: block(
      '- an outer one,',
      '  continued',
      '  - an inner one,',
      '    continued',
      '      * a deeper one,',
      '        continued',
      '      * another deeper one',
    ),
  },
  {
    name: 'a list indented as a whole keeps its column',
    code: block(
      '@param opts - the options:',
      '  - `a`, the first',
      '  - `b`, the second',
      '@param more - more options:',
      ' - `c`, the third',
      ' - `d`, the fourth',
    ),
  },
  {
    name: 'numbered items of different widths start at the same column',
    code: block('9. nine', '10. ten', '    - under ten', '11. eleven'),
  },
  {
    name: "a blank line keeps a list going, and anything else ends it, so the next list's first item sets its own column",
    code: block(
      '- one',
      '',
      '- two',
      'A paragraph.',
      '  - a new list',
      '  - and its second item',
      '@returns the result',
      ' - another list',
    ),
  },
  {
    // A child four or more columns past its parent's text may be code or
    // text in CommonMark, so its list is left alone.
    name: 'a list with a child too deep to read is left as it is',
    code: block('- one', '       - deep', '   - two', '- three'),
  },
  {
    name: "an item in line keeps its line's `*`, even if it's misplaced",
    code: [
      '/**',
      ' * - one',
      '   * - two',
      ' */',
      'export const x = 1;',
      '',
    ].join('\n'),
  },
  {
    name: 'lists in fenced code, indented code and `@example` are skipped',
    code: block(
      '    - indented code',
      '     - more of it',
      '',
      '```',
      '- fenced',
      ' - more',
      '```',
      '@example',
      '- an example',
      '  - more',
      ' - and more',
    ),
  },
  {
    // Moved four columns in after a blank line, `- two` would be indented
    // code, so the list has no fix.
    name: 'a list whose fix would make an item indented code',
    code: block('Text:', '    - one', '', '- two'),
  },
  {
    name: 'a one-line block',
    code: '/** - a bullet */\nexport const x = 1;\n',
  },
];

export const bulletIndentInvalid = [
  {
    name: 'siblings indented a little more than the first item',
    code: block(
      'Throws if:',
      "- it's empty",
      " - it's closed",
      "  - it's locked",
    ),
    output: block(
      'Throws if:',
      "- it's empty",
      "- it's closed",
      "- it's locked",
    ),
    // The highlight starts at the column if the item is past it.
    errors: [
      { messageId: 'indent', line: 4, column: 4, endLine: 4, endColumn: 18 },
      { messageId: 'indent', line: 5, column: 4, endLine: 5, endColumn: 19 },
    ],
  },
  {
    // `- child two` starts before `- child one`'s text, so it's a sibling.
    name: "a nested item that starts before its sibling's text",
    code: block('- parent', '  - child one', '   - child two', '- parent two'),
    output: block('- parent', '  - child one', '  - child two', '- parent two'),
  },
  {
    name: 'a nested list moves with its parent',
    code: block('- a', ' - b', '   - c', '   - d', '  - e'),
    output: block('- a', '- b', '  - c', '  - d', '- e'),
    errors: indentErrors(4),
  },
  {
    name: 'a nested list keeps its depth when its parent moves right',
    code: block(' - a', '- b', '    - c', '- d'),
    output: block(' - a', ' - b', '     - c', ' - d'),
    errors: indentErrors(3),
  },
  {
    name: 'numbered items of different widths, and their children',
    code: block(
      ' 9. nine',
      '     - under nine',
      '10. ten',
      '    - under ten',
      ' 11. eleven',
    ),
    output: block(
      ' 9. nine',
      '     - under nine',
      ' 10. ten',
      '     - under ten',
      ' 11. eleven',
    ),
    errors: indentErrors(2),
  },
  {
    // A changed marker starts a new list in CommonMark whatever its column,
    // so lining it up with the item above doesn't merge the lists.
    name: 'a changed marker is lined up with the items at its level',
    code: block('- dash', ' * star', '1. one', ' 2) two'),
    output: block('- dash', '* star', '1. one', '2) two'),
    errors: indentErrors(2),
  },
  {
    name: 'items after blank lines, in a loose list',
    code: block('- one', '', ' - two', '', '- three'),
    output: block('- one', '', '- two', '', '- three'),
  },
  {
    name: "an item's wrapped lines are left to `bullet-align`",
    code: block('- one', ' - two,', '   continued'),
    output: block('- one', '- two,', '   continued'),
  },
  {
    name: "an item in a tag's description",
    code: block(
      '@param opts - the options:',
      '  - `a`, the first',
      ' - `b`, the second',
    ),
    output: block(
      '@param opts - the options:',
      '  - `a`, the first',
      '  - `b`, the second',
    ),
  },
  {
    name: "the fix puts an item's `*` under the `/**`",
    code: [
      '/**',
      ' * - one',
      '   *  - two',
      ' */',
      'export const x = 1;',
      '',
    ].join('\n'),
    output: block('- one', '- two'),
  },
  {
    name: 'a block with text beside its delimiters',
    code: '/** - one\n *  - two */\nexport const x = 1;\n',
    output: '/** - one\n * - two */\nexport const x = 1;\n',
  },
  {
    name: 'nested indentation (a class member)',
    code: [
      'class A {',
      '  /**',
      '   * - one',
      '   *  - two',
      '   */',
      '  m() {}',
      '}',
      '',
    ].join('\n'),
    output: [
      'class A {',
      '  /**',
      '   * - one',
      '   * - two',
      '   */',
      '  m() {}',
      '}',
      '',
    ].join('\n'),
  },
].map((c) => ({ errors: indentErrors(1), ...c }));
