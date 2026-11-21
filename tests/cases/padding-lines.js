// The `jsdoc-flow/padding-lines` cases, shared by its own tests and the tests
// of all the rules together.  A fence, an ATX heading, or a table is set off
// from the text beside it by a blank line, which is reported on the line of
// the construct, and the fix adds it.
import { block } from '../helpers.js';

// An error on a construct's line at a line of the file, from its text to its
// end.
const at = (messageId, what, line, endColumn, column = 4) => ({
  messageId,
  data: { what },
  line,
  column,
  endLine: line,
  endColumn,
});

export const paddingValid = [
  {
    name: 'a fence with blank lines around it',
    code: block('One:', '', '```js', 'a();', '```', '', 'Two.'),
  },
  {
    name: 'a fence at the start and end of a block',
    code: block('```js', 'a();', '```'),
  },
  {
    name: 'a heading and a table with blank lines around them',
    code: block('# One', '', 'Two.', '', '| a | b |', '|---|---|', '', 'c'),
  },
  {
    name: 'a fence in an `@example`',
    code: block('@example', 'a();', '```js', 'b();', '```', 'c();'),
  },
  {
    name: 'a fence right after a tag with no description',
    code: block('@remarks', '```js', 'a();', '```', '@returns it'),
  },
  {
    name: 'a fence right before a tag',
    code: block('One:', '', '```js', 'a();', '```', '@param x - y'),
  },
  {
    name: 'a fence after a list item, in or out of it',
    code: block('- one', '  ```js', '  a();', '  ```', '  two', '- three'),
  },
  {
    name: 'a heading before a list',
    code: block('# One', '- two', '- three'),
  },
  {
    name: 'a setext heading over its underline',
    code: block('One', '---', 'Two.'),
  },
  {
    name: 'a table with no edge pipes, then a tag',
    code: block('One.', '', 'a | b', '--|--', '1 | 2', '@returns it'),
  },
  {
    name: 'a delimiter row with no header, and a heading among its rows',
    code: block('One.', '', '--|--', '# a', 'b'),
  },
  {
    name: 'a delimiter row right after a table, which GFM reads as a row',
    code: block('| a | b |', '| - | - |', '| 1 | 2 |', '--|--', '3 | 4'),
  },
  {
    name: 'a heading in a fence',
    code: block('```md', '# One', '```'),
  },
  {
    name: 'a word that starts with `#`',
    code: block('One', '#two', 'three.'),
  },
  {
    name: 'a kept line indented to be code after a blank line',
    code: block('```js', 'a();', '```', '    # One'),
  },
  {
    name: 'a one-line block',
    code: '/** # One */\nexport const x = 1;\n',
  },
];

export const paddingInvalid = [
  {
    name: 'a fence between paragraphs',
    code: block('One:', '```js', 'a();', '```', 'Two.'),
    output: block('One:', '', '```js', 'a();', '```', '', 'Two.'),
    errors: [at('before', 'code fence', 3, 9), at('after', 'code fence', 5, 7)],
  },
  {
    name: 'a fence right after another',
    code: block('```js', 'a();', '```', '```sh', 'b', '```'),
    output: block('```js', 'a();', '```', '', '```sh', 'b', '```'),
    errors: [at('after', 'code fence', 4, 7)],
  },
  {
    name: 'a `~~~` fence after a tag that describes it',
    code: block('@param fn - a function, as in:', '~~~', 'f()', '~~~'),
    output: block('@param fn - a function, as in:', '', '~~~', 'f()', '~~~'),
    errors: [at('before', 'code fence', 3, 7)],
  },
  {
    name: 'a heading between paragraphs',
    code: block('One.', '## Two', 'Three.'),
    output: block('One.', '', '## Two', '', 'Three.'),
    errors: [at('before', 'heading', 3, 10), at('after', 'heading', 3, 10)],
  },
  {
    name: 'a table with edge pipes between paragraphs',
    code: block('One:', '| a | b |', '|---|---|', '| 1 | 2 |', 'Two.'),
    output: block(
      'One:',
      '',
      '| a | b |',
      '|---|---|',
      '| 1 | 2 |',
      '',
      'Two.',
    ),
    errors: [at('before', 'table', 3, 13), at('after', 'table', 5, 13)],
  },
  {
    name: 'a table with no edge pipes after a paragraph',
    code: block('One:', 'a | b', '--|--', '1 | 2'),
    output: block('One:', '', 'a | b', '--|--', '1 | 2'),
    errors: [at('before', 'table', 3, 9)],
  },
  {
    name: 'a heading right after a table',
    code: block('| a |', '|---|', '# One'),
    output: block('| a |', '|---|', '', '# One'),
    errors: [at('after', 'table', 3, 9)],
  },
  {
    name: 'a paragraph indented as code after a fence is moved left',
    code: block('```js', 'a();', '```', '     One', '      two.'),
    output: block('```js', 'a();', '```', '', 'One', 'two.'),
    errors: [at('after', 'code fence', 4, 7)],
  },
  {
    name: 'every line that `text-indent` moves left is moved with it',
    code: block('```', 'a', '```', '     One', '       two', '   three'),
    output: block('```', 'a', '```', '', 'One', '       two', 'three'),
    errors: [at('after', 'code fence', 4, 7)],
  },
  {
    name: 'an indented block',
    code: [
      'class A {',
      '  /**',
      '   * One:',
      '   * ```js',
      '   * a();',
      '   * ```',
      '   */',
      '  x = 1;',
      '}',
      '',
    ].join('\n'),
    output: [
      'class A {',
      '  /**',
      '   * One:',
      '   *',
      '   * ```js',
      '   * a();',
      '   * ```',
      '   */',
      '  x = 1;',
      '}',
      '',
    ].join('\n'),
    errors: [at('before', 'code fence', 4, 11, 6)],
  },
  {
    name: 'a heading on the `/**` line',
    code: '/** # One\n * Two. */\nexport const x = 1;\n',
    output: '/** # One\n *\n * Two. */\nexport const x = 1;\n',
    errors: [at('after', 'heading', 1, 10, 5)],
  },
];
