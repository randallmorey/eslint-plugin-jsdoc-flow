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
    name: 'the prefixes of bullets and tables, and all of fenced code, `@example` and indented code, are skipped',
    code: [
      '/**',
      '   * - a bullet',
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
      '    on a multi-line block, with no star. */',
      'foo(/**  inline  */ 1);',
      '/**  Code after the block.  */ foo();',
      '',
    ].join('\n'),
  },
  {
    name: 'the lines of a multi-line `{Type}` are skipped, through its closing brace',
    code: [
      '/**',
      '   *    @param {{  ',
      '* a: string  ',
      '   *',
      ' *     b: string',
      '  *   }} name - the name',
      ' */',
      'export const x = 1;',
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
  {
    name: 'whitespace after the text that follows a multi-line `{Type}`',
    code: block(
      '@param {{',
      '  a: string',
      '}} name  ',
      '@typedef {',
      '  a',
      '}  ',
    ),
    output: block(
      '@param {{',
      '  a: string',
      '}} name',
      '@typedef {',
      '  a',
      '}',
    ),
    errors: [{ messageId: 'trailing' }, { messageId: 'trailing' }],
  },
  {
    name: 'whitespace after a bullet, a table row, or a heading',
    code: [
      '/**',
      ' * # Heading  ',
      ' *',
      ' * Setext heading\t',
      ' * ==============',
      ' *',
      ' * - a bullet  ',
      ' *   wrapped',
      ' * 1. a numbered one  ',
      ' *',
      ' * | a | b | ',
      ' * | - | - |',
      ' * | 1 | 2 | \t',
      ' *',
      ' * > A quote.  ',
      ' */',
      'export const x = 1;',
      '',
    ].join('\n'),
    output: [
      '/**',
      ' * # Heading',
      ' *',
      ' * Setext heading',
      ' * ==============',
      ' *',
      ' * - a bullet',
      ' *   wrapped',
      ' * 1. a numbered one',
      ' *',
      ' * | a | b |',
      ' * | - | - |',
      ' * | 1 | 2 |',
      ' *',
      ' * > A quote.',
      ' */',
      'export const x = 1;',
      '',
    ].join('\n'),
    errors: [
      { messageId: 'trailing', line: 2, column: 6, endLine: 2, endColumn: 15 },
      { messageId: 'trailing', line: 4, column: 11, endLine: 4, endColumn: 19 },
      { messageId: 'trailing', line: 7, column: 8, endLine: 7, endColumn: 16 },
      { messageId: 'trailing', line: 9, column: 18, endLine: 9, endColumn: 23 },
      {
        messageId: 'trailing',
        line: 11,
        column: 12,
        endLine: 11,
        endColumn: 14,
      },
      {
        messageId: 'trailing',
        line: 13,
        column: 12,
        endLine: 13,
        endColumn: 15,
      },
      {
        messageId: 'trailing',
        line: 15,
        column: 8,
        endLine: 15,
        endColumn: 16,
      },
    ],
  },
  {
    name: 'whitespace after a bullet in a block with text beside its `*/`',
    code: '/**\n * - a bullet  \n * - another */\nexport const x = 1;\n',
    output: '/**\n * - a bullet\n * - another */\nexport const x = 1;\n',
    errors: [
      { messageId: 'trailing', line: 2, column: 8, endLine: 2, endColumn: 16 },
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
