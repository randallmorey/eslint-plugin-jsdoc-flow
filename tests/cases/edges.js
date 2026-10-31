// The cases of the edge rules (`jsdoc-flow/star-align`, `text-indent` and
// `no-trailing-space`), shared by their own tests and the tests of all the
// rules together.  Each line whose edge is off is reported on its own,
// highlighting the whitespace with the word beside it, and the fix changes
// only that whitespace.  The valid cases are valid for all three rules, and
// each invalid case has edges of only one kind, so it's valid for the other
// two.
import ember from 'eslint-plugin-ember/recommended';

import { block } from '../helpers.js';

export const edgeValid = [
  {
    name: 'each `*` under the `/**`, one space before the text, and none after',
    code: block('One sentence.', '', '@param name - the description'),
  },
  {
    name: "a tag's continuation lines are left to `tag-align`",
    code: block('@param name - the description,', '  continued'),
  },
  {
    name: 'bullets, tables, fenced code, `@example` and indented code are skipped',
    code: [
      '/**',
      '   * - a bullet  ',
      ' *  | a | table |',
      ' *',
      ' * ```',
      ' *   fenced  ',
      ' * ```',
      ' * @example',
      ' *    foo();  ',
      ' */',
      'export const x = 1;',
      '',
    ].join('\n'),
  },
  {
    name: 'the opening and closing lines are skipped',
    code: '/**  \n * Text.\n  */\nexport const x = 1;\n',
  },
  {
    name: 'comments that are not checked',
    code: [
      '/*  A plain block comment.  */',
      '//  A line comment.  ',
      '/** Text after the opener',
      ' *  on a multi-line block. */',
      'foo(/**  inline  */ 1);',
      '/**  Code after the block.  */ foo();',
      '',
    ].join('\n'),
  },
];

export const starInvalid = [
  {
    name: "a `*` that isn't under the `/**`",
    code: block('One.', '', 'Two.')
      .replace(' *\n', '   *\n')
      .replace(' * Two', '* Two'),
    output: block('One.', '', 'Two.'),
    errors: [
      { messageId: 'star', line: 3, column: 1, endLine: 3, endColumn: 5 },
      { messageId: 'star', line: 4, column: 1, endLine: 4, endColumn: 7 },
    ],
  },
  {
    name: "a tag's own line",
    code: block('@param a - b').replace(' * @param', '  * @param'),
    output: block('@param a - b'),
    errors: [{ messageId: 'star' }],
  },
  {
    name: 'nested indentation (a class member)',
    code: 'class A {\n  /**\n * Text.\n   */\n  x = 1;\n}\n',
    output: 'class A {\n  /**\n   * Text.\n   */\n  x = 1;\n}\n',
    errors: [{ messageId: 'star' }],
  },
];

export const leadingInvalid = [
  {
    name: "extra whitespace between a line's `*` and its text",
    code: block('Extra.', '@param a - b')
      .replace(' * ', ' *  ')
      .replace(' * @', ' *   @'),
    output: block('Extra.', '@param a - b'),
    errors: [
      { messageId: 'leading', line: 2, column: 2, endLine: 2, endColumn: 11 },
      { messageId: 'leading', line: 3, column: 2, endLine: 3, endColumn: 12 },
    ],
  },
  {
    name: "a one-liner's extra whitespace after the `/**`",
    code: '/**  One-liner. */\nexport const x = 1;\n',
    output: '/** One-liner. */\nexport const x = 1;\n',
    errors: [
      { messageId: 'leading', line: 1, column: 1, endLine: 1, endColumn: 16 },
    ],
  },
  {
    name: "a .gts class body is checked, and its <template>'s comments aren't",
    filename: 'x.gts',
    languageOptions: { parser: ember.parser },
    code: [
      "import Component from '@glimmer/component';",
      '',
      '/**  A component. */',
      'export default class Foo extends Component {',
      '  <template>',
      '    {{!-- /**  Not JSDoc. */ --}}',
      '    <p>/**  Not JSDoc. */</p>',
      '  </template>',
      '}',
      '',
    ].join('\n'),
    output: [
      "import Component from '@glimmer/component';",
      '',
      '/** A component. */',
      'export default class Foo extends Component {',
      '  <template>',
      '    {{!-- /**  Not JSDoc. */ --}}',
      '    <p>/**  Not JSDoc. */</p>',
      '  </template>',
      '}',
      '',
    ].join('\n'),
    errors: [{ messageId: 'leading' }],
  },
];

export const trailingInvalid = [
  {
    name: 'a tab or a no-break space after the text',
    code: block('Text.').replace('Text.', 'Text.\t\u00a0'),
    output: block('Text.'),
    errors: [
      { messageId: 'trailing', line: 2, column: 4, endLine: 2, endColumn: 11 },
    ],
  },
  {
    name: 'whitespace after the text, or on a blank line',
    code: block('Extra after.', '', 'More.')
      .replace('after.', 'after.  ')
      .replace(' *\n', ' *   \n'),
    output: block('Extra after.', '', 'More.'),
    errors: [
      { messageId: 'trailing', line: 2, column: 10, endLine: 2, endColumn: 18 },
      { messageId: 'trailing', line: 3, column: 2, endLine: 3, endColumn: 6 },
    ],
  },
  {
    name: "a tag's continuation line",
    code: block(
      '@param a - the description, which is long enough to wrap onto a',
      '           continuation line  ',
    ),
    output: block(
      '@param a - the description, which is long enough to wrap onto a',
      '           continuation line',
    ),
    errors: [
      { messageId: 'trailing', line: 3, column: 28, endLine: 3, endColumn: 34 },
    ],
  },
  {
    name: "a one-liner's extra whitespace before the `*/`",
    code: '/** One-liner.   */\nexport const x = 1;\n',
    output: '/** One-liner. */\nexport const x = 1;\n',
    errors: [
      { messageId: 'trailing', line: 1, column: 5, endLine: 1, endColumn: 20 },
    ],
  },
];

// A case with edges of every kind on one line and across lines, for the
// tests of all the rules together.
export const edgeMixed = [
  {
    name: 'edges of every kind',
    code: [
      '/**',
      '   *  Every kind.  ',
      ' *   ',
      ' * @param a - the description, which is long enough to wrap onto a',
      ' *            continuation line  ',
      ' */',
      'export const x = 1;',
      '',
      '/**  One-liner.   */',
      'export const y = 1;',
      '',
    ].join('\n'),
  },
];
