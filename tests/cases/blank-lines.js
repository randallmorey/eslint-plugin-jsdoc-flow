// The `jsdoc-flow/no-extra-blank-lines` cases, shared by its own tests and
// the tests of all the rules together.  A blank line right after `/**`, right
// before `*/`, or right after another blank line is reported on its own, and
// the fix drops them all.  Blank lines that a block keeps as they are, as in
// code, are never extra.
import { block } from '../helpers.js';

// An error on the blank line at a line of the file, from its `*` to its end.
const at = (line, column = 2) => ({
  messageId: 'extra',
  line,
  column,
  endLine: line,
  endColumn: column + 1,
});

export const blankValid = [
  {
    name: 'one blank line between paragraphs and before the tags',
    code: block('One.', '', 'Two.', '', '@param x - y', '@returns z'),
  },
  {
    name: 'no blank lines',
    code: block('One.', '@returns z'),
  },
  {
    name: 'a one-line block',
    code: '/** One. */\nexport const x = 1;\n',
  },
  {
    name: 'a block of one blank line',
    code: block(''),
  },
  {
    name: 'an empty block',
    code: '/**\n */\nexport const x = 1;\n',
  },
  {
    name: 'blank lines in an `@example`, even at its end',
    code: block('One.', '', '@example', 'a();', '', '', 'b();', '', ''),
  },
  {
    name: 'blank lines in an `@example` before a tag',
    code: block('@example', 'a();', '', '', '@returns z'),
  },
  {
    name: 'blank lines in a fence',
    code: block('One.', '', '```js', '', 'a();', '', '', 'b();', '', '```'),
  },
  {
    name: 'blank lines in `<pre>`',
    code: block('One.', '', '<pre>', 'a', '', '', 'b', '</pre>'),
  },
  {
    name: 'blank lines in and after indented code',
    code: block('One:', '', '    a();', '', '', '    b();', '', '', 'Two.'),
  },
  {
    name: 'blank lines at the end of indented code',
    code: block('    a();', '', ''),
  },
];

export const blankInvalid = [
  {
    name: 'blank lines at the start, at the end, and in a row',
    code: block('', 'Saves it.', '', '', '', '@param x - y', ''),
    output: block('Saves it.', '', '@param x - y'),
    errors: [at(2), at(5), at(6), at(8)],
  },
  {
    name: 'a blank line at the start',
    code: block('', 'One.'),
    output: block('One.'),
    errors: [at(2)],
  },
  {
    name: 'blank lines at the start',
    code: block('', '', 'One.'),
    output: block('One.'),
    errors: [at(2), at(3)],
  },
  {
    name: 'a blank line at the end',
    code: block('One.', ''),
    output: block('One.'),
    errors: [at(3)],
  },
  {
    name: 'two blank lines between paragraphs',
    code: block('One.', '', '', 'Two.'),
    output: block('One.', '', 'Two.'),
    errors: [at(4)],
  },
  {
    name: 'three blank lines before the tags',
    code: block('One.', '', '', '', '@returns z'),
    output: block('One.', '', '@returns z'),
    errors: [at(4), at(5)],
  },
  {
    name: 'two blank lines between tags',
    code: block('@param x - y', '', '', '@returns z'),
    output: block('@param x - y', '', '@returns z'),
    errors: [at(4)],
  },
  {
    name: 'two blank lines in a list',
    code: block('- one', '', '', '- two'),
    output: block('- one', '', '- two'),
    errors: [at(4)],
  },
  {
    name: 'a block of only blank lines keeps the first',
    code: block('', '', ''),
    output: block(''),
    errors: [at(3), at(4)],
  },
  {
    name: 'blank lines with trailing whitespace',
    code: '/**\n *  \n * One.\n *\t\n * \u00a0\n * Two.\n */\nexport const x = 1;\n',
    output: '/**\n * One.\n *\t\n * Two.\n */\nexport const x = 1;\n',
    errors: [
      { ...at(2), endColumn: 5 },
      { ...at(5), endColumn: 5 },
    ],
  },
  {
    name: 'an indented block',
    code: [
      'class A {',
      '  /**',
      '   *',
      '   * One.',
      '   *',
      '   *',
      '   * Two.',
      '   *',
      '   */',
      '  x = 1;',
      '}',
      '',
    ].join('\n'),
    output: [
      'class A {',
      '  /**',
      '   * One.',
      '   *',
      '   * Two.',
      '   */',
      '  x = 1;',
      '}',
      '',
    ].join('\n'),
    errors: [at(3, 4), at(6, 4), at(8, 4)],
  },
  {
    name: 'blank lines around a fence, not in it',
    code: block('', '```', 'a();', '', '', '```', '', '', 'One.', ''),
    output: block('```', 'a();', '', '', '```', '', 'One.'),
    errors: [at(2), at(9), at(11)],
  },
  {
    name: 'blank lines before an `@example`, not in it',
    code: block('One.', '', '', '@example', 'a();', '', ''),
    output: block('One.', '', '@example', 'a();', '', ''),
    errors: [at(4)],
  },
  {
    name: 'blank lines before indented code, which is still code',
    code: block('', '', '    a();', '', 'One.', '', '', '    b();'),
    output: block('    a();', '', 'One.', '', '    b();'),
    errors: [at(2), at(3), at(8)],
  },
];
