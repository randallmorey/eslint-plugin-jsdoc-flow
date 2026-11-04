// The `jsdoc-flow/tag-align` cases, shared by its own tests and the tests
// of all the rules together.  A tag's continuation lines start at its
// description's column, and the fix only re-indents them.
import ts from 'typescript-eslint';
import ember from 'eslint-plugin-ember/recommended';

import { block } from '../helpers.js';

const alignErrors = (n) => Array(n).fill({ messageId: 'align' });

export const alignValid = [
  {
    name: '`@param` with and without `{Type}`, aligned',
    code: block(
      '@param name - the description,',
      '              continued',
      '@param {string} name - the description,',
      '                       continued',
    ),
  },
  {
    name: '`@returns` with and without `{Type}`, aligned',
    code: block(
      '@returns the result,',
      '         continued',
      '@returns {string} the result,',
      '                  continued',
    ),
  },
  {
    name: 'a one-line block',
    code: '/** @param name - the description */\nexport const x = 1;\n',
  },
  {
    name: 'a wide head on one line with its description has nothing to align',
    code: block(
      '@param {string} abcdefghijklmnopqrstuvwxyzz - fits on one line',
    ),
  },
  {
    name: "a wide head's description lines are two spaces in",
    code: block(
      '@param {string} abcdefghijklmnopqrstuvwxyzz -',
      '  the description,',
      '  continued',
    ),
  },
  {
    // Reflow moves the description below the head; tag-align never does.
    name: "a wide head's description on its own line is left to reflow",
    code: block(
      '@param {string} abcdefghijklmnopqrstuvwxyzz - the description,',
      '  continued',
    ),
  },
  {
    name: "a paragraph's lines are not a tag's",
    code: block('Some text,', '    indented, but not a tag.'),
  },
  {
    name: "a tag line whose prefix isn't ` * ` is left to reflow",
    code: [
      '/**',
      ' *  @param name - the description,',
      ' *   continued',
      ' */',
      'export const x = 1;',
      '',
    ].join('\n'),
  },
  {
    name: '`@example`, fenced code, indented code and bullets are skipped',
    code: block(
      '    indented   code',
      '  more',
      '',
      '@param name - the options:',
      '- `a`, a bullet',
      '  continued',
      '',
      '```',
      '@param x - fenced',
      '  code',
      '```',
      '@example',
      'foo(',
      '  1,',
      ');',
    ),
  },
  {
    name: 'comments not alone on their lines, and odd forms, are skipped',
    code: [
      'foo(); /**',
      ' * @param name - the description,',
      ' *   continued',
      ' */',
      '/**',
      ' * @param name - the description,',
      ' *   continued */',
      '/** @param name - the description,',
      ' *   continued',
      ' */',
      '/* @param name - the description,',
      ' *   continued',
      ' */',
      '',
    ].join('\n'),
  },
  {
    name: "a .gts <template>'s comments are skipped",
    filename: 'x.gts',
    languageOptions: { parser: ember.parser },
    code: [
      "import Component from '@glimmer/component';",
      '',
      'export default class Foo extends Component {',
      '  <template>',
      '    {{!--',
      '      /**',
      '       * @param name - the description,',
      '       *   continued',
      '       */',
      '    --}}',
      '  </template>',
      '}',
      '',
    ].join('\n'),
  },
  {
    name: 'the lines of a multi-line `{Type}` are left as they are',
    code: block(
      '@param {{',
      '  a: string,',
      '      b: string',
      '}} name',
      '@returns {',
      'a',
      '} the result',
    ),
  },
  {
    name: 'the description after a multi-line `{Type}`, aligned',
    code: block(
      '@param {{',
      '  a: string',
      '}} name - the description,',
      '          continued',
    ),
  },
];

export const alignInvalid = [
  {
    // Text that starts before its column is highlighted from its start.
    name: '`@param name -`',
    errors: [
      { messageId: 'align', line: 3, column: 6, endLine: 3, endColumn: 28 },
    ],
    code: block(
      '@param update - an extra DOM update to run inside the view transition,',
      '  just before navigating',
    ),
    output: block(
      '@param update - an extra DOM update to run inside the view transition,',
      '                just before navigating',
    ),
  },
  {
    name: '`@param {Type} name -`',
    code: block('@param {string} name - the description,', '  continued'),
    output: block(
      '@param {string} name - the description,',
      '                       continued',
    ),
  },
  {
    name: '`@returns`',
    code: block('@returns the result,', '  continued'),
    output: block('@returns the result,', '         continued'),
  },
  {
    // Text that starts after its column is highlighted from its column, so
    // the whitespace it should lose is highlighted too.
    name: '`@returns {Type}`, indented too far',
    errors: [
      { messageId: 'align', line: 3, column: 22, endLine: 3, endColumn: 35 },
    ],
    code: block(
      '@returns {string} the result,',
      '                      continued',
    ),
    output: block(
      '@returns {string} the result,',
      '                  continued',
    ),
  },
  {
    name: 'a named tag without `-`, and an unnamed one',
    code: block(
      '@template T the type,',
      '  continued',
      '@deprecated use another one,',
      '  continued',
    ),
    output: block(
      '@template T the type,',
      '            continued',
      '@deprecated use another one,',
      '            continued',
    ),
    errors: alignErrors(2),
  },
  {
    name: 'each continuation line is reported, and only those that are off',
    code: block(
      '@param name - one,',
      '  two,',
      '              three,',
      '    four',
    ),
    output: block(
      '@param name - one,',
      '              two,',
      '              three,',
      '              four',
    ),
    errors: alignErrors(2),
  },
  {
    name: 'several tags, each with its own column',
    code: block(
      'Does a thing.',
      '',
      '@param a - first,',
      '  continued',
      '@param {number} bb - second,',
      '  continued',
      '@returns third,',
      '  continued',
    ),
    output: block(
      'Does a thing.',
      '',
      '@param a - first,',
      '           continued',
      '@param {number} bb - second,',
      '                     continued',
      '@returns third,',
      '         continued',
    ),
    errors: alignErrors(3),
  },
  {
    name: 'a head of 44 columns sets the column, and a wider one two spaces',
    code: block(
      '@param {string} abcdefghijklmnopqrstuvwxy - the description,',
      '  continued',
      '@param {string} abcdefghijklmnopqrstuvwxyz -',
      '                                             the description,',
      '                                             continued',
      '@param {string} abcdefghijklmnopqrstuvwxyz - the description,',
      '                                             continued',
    ),
    output: block(
      '@param {string} abcdefghijklmnopqrstuvwxy - the description,',
      '                                            continued',
      '@param {string} abcdefghijklmnopqrstuvwxyz -',
      '  the description,',
      '  continued',
      '@param {string} abcdefghijklmnopqrstuvwxyz - the description,',
      '  continued',
    ),
    errors: alignErrors(4),
  },
  {
    // The limit is 0.55 of 100, or 55.
    name: "a head's limit scales with `width`",
    settings: { 'jsdoc-flow': { width: 100 } },
    code: block(
      `@param {string} ${'n'.repeat(36)} - the description,`,
      '  continued',
      `@param {string} ${'n'.repeat(37)} -`,
      `${' '.repeat(56)}the description,`,
    ),
    output: block(
      `@param {string} ${'n'.repeat(36)} - the description,`,
      `${' '.repeat(55)}continued`,
      `@param {string} ${'n'.repeat(37)} -`,
      '  the description,',
    ),
    errors: alignErrors(2),
  },
  {
    // The limit is 0.25 of 80, or 20.
    name: "a head's limit follows `maxHead`",
    settings: { 'jsdoc-flow': { maxHead: 0.25 } },
    code: block(
      '@param {string} name -',
      '                       the description,',
      '@param name - the description,',
      '  continued',
    ),
    output: block(
      '@param {string} name -',
      '  the description,',
      '@param name - the description,',
      '              continued',
    ),
    errors: alignErrors(2),
  },
  {
    name: 'a head that ends its line sets the column after itself',
    code: block('@param name -', 'the description'),
    output: block('@param name -', '              the description'),
  },
  {
    // So the fix doesn't depend on whether `word-spacing` fixes the head
    // first.
    name: 'the head is measured as `word-spacing` spaces it, not as it is',
    code: block('@param  name -  the description,', '  continued'),
    output: block(
      '@param  name -  the description,',
      '              continued',
    ),
  },
  {
    name: "`{...}` in the head is one token, and a line's own star is re-indented",
    errors: [
      { messageId: 'align', line: 3, column: 5, endLine: 3, endColumn: 14 },
    ],
    code: [
      '/**',
      ' * @param {{ a: number }} b - the description,',
      '*   continued',
      ' */',
      'export const x = 1;',
      '',
    ].join('\n'),
    output: block(
      '@param {{ a: number }} b - the description,',
      '                           continued',
    ),
  },
  {
    name: 'nested indentation (a class member)',
    code: [
      'class A {',
      '  /**',
      '   * @param name - the description,',
      '   *   continued',
      '   * @returns {string} the result,',
      '   *   continued',
      '   */',
      '  m() {}',
      '}',
      '',
    ].join('\n'),
    output: [
      'class A {',
      '  /**',
      '   * @param name - the description,',
      '   *               continued',
      '   * @returns {string} the result,',
      '   *                   continued',
      '   */',
      '  m() {}',
      '}',
      '',
    ].join('\n'),
    errors: alignErrors(2),
  },
  {
    name: "a line's trailing whitespace isn't highlighted",
    code: block('@returns the result,', '  continued  '),
    output: block('@returns the result,', '         continued  '),
    errors: [
      { messageId: 'align', line: 3, column: 6, endLine: 3, endColumn: 15 },
    ],
  },
  {
    name: 'a .ts file',
    filename: 'x.ts',
    languageOptions: { parser: ts.parser },
    code: block('@returns {Promise<void>} once it is done,', '  or not'),
    output: block(
      '@returns {Promise<void>} once it is done,',
      '                         or not',
    ),
  },
  {
    name: 'the description after a multi-line `{Type}`',
    code: block(
      '@param {{',
      '  a: string',
      '}} name - the description,',
      '  continued',
      '@returns {{',
      '  a: string',
      '}} the result,',
      '  continued',
    ),
    output: block(
      '@param {{',
      '  a: string',
      '}} name - the description,',
      '          continued',
      '@returns {{',
      '  a: string',
      '}} the result,',
      '   continued',
    ),
    errors: alignErrors(2),
  },
  {
    name: 'a closing line indented under a multi-line `{Type}`',
    code: block('@param {{', '  a: string', '  }} name - one,', '  two'),
    output: block(
      '@param {{',
      '  a: string',
      '  }} name - one,',
      '            two',
    ),
  },
  {
    name: 'a wide head after a multi-line `{Type}` hangs its description two in',
    code: block(
      '@param {{',
      '  a: string',
      '}[] | null} aVeryLongNameThatGoesOnAndOnAndOnAndOn -',
      '     the name',
    ),
    output: block(
      '@param {{',
      '  a: string',
      '}[] | null} aVeryLongNameThatGoesOnAndOnAndOnAndOn -',
      '  the name',
    ),
  },
].map((c) => ({ errors: alignErrors(1), ...c }));
