// The `jsdoc-flow/list-spacing` cases, shared by its own tests and the tests
// of all the rules together.  A blank line between two items of a list makes
// CommonMark render it loose, so the first blank line between them is
// reported, and the fix drops them all.  A list whose items hold more than
// one paragraph, or other blocks, is loose anyway, and is left as it is.
import { block } from '../helpers.js';

// An error on the blank line at a line of the file, from its `*` to its end.
const at = (line, column = 2) => ({
  messageId: 'loose',
  line,
  column,
  endLine: line,
  endColumn: column + 1,
});

export const looseValid = [
  {
    name: 'a tight list, with a blank line before and after it',
    code: block('Steps:', '', '- Parse.', '- Fill.', '  - Wrap.', '', 'Done.'),
  },
  {
    name: 'an ordered list in a tag description',
    code: block('@param steps - in order:', '  1. Parse.', '  2. Fill.'),
  },
  {
    name: 'an item with indented code',
    code: block('- a', '', '- b', '', '      code();'),
  },
  {
    name: 'an item with a fence',
    code: block('- a', '', '- b', '  ```js', '  code();', '  ```'),
  },
  {
    // Moved four columns in after a blank line, `- two` would be indented
    // code, so `bullet-indent` can't line it up, and the list is left loose
    // rather than let it.
    name: 'an item that `bullet-indent` should move but cannot',
    code: block('Text:', '    - one', '', '- two'),
  },
  {
    name: 'adjacent lists with different bullets',
    code: block('- a', '- b', '', '* c', '* d'),
  },
  {
    name: 'an ordered list, then a bullet list',
    code: block('1. a', '', '- b'),
  },
  {
    name: 'ordered lists with different delimiters',
    code: block('1. a', '', '2) b'),
  },
  {
    name: 'nested lists with different bullets',
    code: block('- a', '  - b', '', '  * c'),
  },
  {
    // Without the blank line, `2.` would be part of the text above it.
    name: 'a nested ordered list that starts past 1',
    code: block('- a', '', '  2. b'),
  },
  {
    name: 'lists in a fence and an `@example`',
    code: block(
      '```',
      '- a',
      '',
      '- b',
      '```',
      '',
      '@example',
      '- a',
      '',
      '- b',
    ),
  },
  {
    name: 'a list in a blockquote',
    code: block('> - a', '>', '> - b'),
  },
  {
    name: 'a list laid out by hand',
    code: block('- one     the first', '- two     the second', '', '- three'),
  },
  {
    name: 'a block with an ignore comment',
    code: `// jsdoc-flow-ignore\n${block('- a', '', '- b')}`,
  },
  {
    name: 'a block with a verbatim tag',
    code: block('@license', '- a', '', '- b'),
  },
];

export const looseInvalid = [
  {
    name: 'a blank line between items',
    code: block(
      'Steps:',
      '',
      '- Parse the block.',
      '',
      '- Fill each paragraph.',
      '- Align the tags.',
    ),
    output: block(
      'Steps:',
      '',
      '- Parse the block.',
      '- Fill each paragraph.',
      '- Align the tags.',
    ),
    errors: [at(5)],
  },
  {
    // `no-extra-blank-lines` reports the second.
    name: 'blank lines in a row are reported once, and dropped together',
    code: block('- a', '', '', '- b'),
    output: block('- a', '- b'),
    errors: [at(3)],
  },
  {
    name: 'nested items',
    code: block('- a', '', '  - b', '', '  - c', '', '- d'),
    output: block('- a', '  - b', '  - c', '- d'),
    errors: [at(3), at(5), at(7)],
  },
  {
    name: 'an ordered list, with an ordered list nested from 1',
    code: block('1. a', '', '   1. b', '', '2. c'),
    output: block('1. a', '   1. b', '2. c'),
    errors: [at(3), at(5)],
  },
  {
    name: 'a list in a tag description',
    code: block('@param x - one of:', '  - a', '', '  - b', '@returns y'),
    output: block('@param x - one of:', '  - a', '  - b', '@returns y'),
    errors: [at(4)],
  },
  {
    // `text-indent` moves the paragraph left, out of the list, so it's read
    // where it will be.
    name: 'a paragraph indented under an item ends the list',
    code: block('- a', '', '  more a', '- b', '', '- c'),
    output: block('- a', '', '  more a', '- b', '- c'),
    errors: [at(6)],
  },
  {
    name: 'items with wrapped lines',
    code: block('- a, which', '  wraps', '', '- b'),
    output: block('- a, which', '  wraps', '- b'),
    errors: [at(4)],
  },
  {
    name: 'a list that follows a list with another bullet',
    code: block('- a', '', '* b', '', '* c'),
    output: block('- a', '', '* b', '* c'),
    errors: [at(5)],
  },
  {
    // The fix drops a line, so it spreads the block, as `delimiter-lines`
    // would.
    name: 'a block with text beside its delimiters',
    code: '/** - a\n *\n * - b */\nexport const x = 1;\n',
    output: block('- a', '- b'),
    errors: [at(2, 2)],
  },
  {
    name: 'nested indentation (a class member)',
    code: [
      'class A {',
      '  /**',
      '   * - a',
      '   *',
      '   * - b',
      '   */',
      '  m() {}',
      '}',
      '',
    ].join('\n'),
    output: [
      'class A {',
      '  /**',
      '   * - a',
      '   * - b',
      '   */',
      '  m() {}',
      '}',
      '',
    ].join('\n'),
    errors: [at(4, 4)],
  },
];
