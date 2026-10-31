// The `jsdoc-flow/single-line` cases, shared by its own tests and
// the tests of all the rules together.  A one-line block is reported whole,
// and the fix spreads it over three lines, keeping its text as it is.
import ts from 'typescript-eslint';
import ember from 'eslint-plugin-ember/recommended';

import { block } from '../helpers.js';

export const singleValid = [
  {
    name: 'a block on three lines',
    code: block('A block on three lines.'),
  },
  {
    name: 'a longer block',
    code: block('Some text.', '', '@param name - the description'),
  },
  {
    name: 'comments that are not checked',
    code: [
      '/* A plain block comment. */',
      '// A line comment.',
      '/**/',
      '/** */',
      '/***/',
      '/**   */',
      'foo(/** @type {Foo} */ (bar));',
      '/** Code after the block. */ foo();',
      '',
    ].join('\n'),
  },
];

export const singleInvalid = [
  {
    name: 'a one-liner is spread over three lines',
    code: '/** Short text. */\nexport const x = 1;\n',
    output: block('Short text.'),
  },
  {
    name: 'a tag on one line',
    code: '/** @type {Foo} */\nexport const x = 1;\n',
    output: block('@type {Foo}'),
  },
  {
    name: 'the whitespace around the text is dropped, and inside it kept',
    code: '/**  Short text. More  text.   */\nexport const x = 1;\n',
    output: block('Short text. More  text.'),
  },
  {
    name: 'text against the delimiters',
    code: '/**Text against them.*/\nexport const x = 1;\n',
    output: block('Text against them.'),
  },
  {
    name: "an indented one-liner's lines are indented as it was",
    code: 'class A {\n  /** Short text. */\n  x = 1;\n}\n',
    output: 'class A {\n  /**\n   * Short text.\n   */\n  x = 1;\n}\n',
  },
  {
    name: 'each one-liner is reported, with its whole block highlighted',
    code: '/** One. */\n\n  /** Two. */\nexport const x = 1;\n',
    output:
      '/**\n * One.\n */\n\n  /**\n   * Two.\n   */\nexport const x = 1;\n',
    errors: [
      { messageId: 'single', line: 1, column: 1, endLine: 1, endColumn: 12 },
      { messageId: 'single', line: 3, column: 3, endLine: 3, endColumn: 14 },
    ],
  },
  {
    name: 'a file with CRLF line endings keeps them',
    code: '/** Short text. */\r\nexport const x = 1;\r\n',
    output: '/**\r\n * Short text.\r\n */\r\nexport const x = 1;\r\n',
  },
  {
    name: 'a .ts file',
    filename: 'x.ts',
    languageOptions: { parser: ts.parser },
    code: '/** @returns {Promise<void>} once done. */\nexport const x = 1;\n',
    output: block('@returns {Promise<void>} once done.'),
  },
  {
    name: "a .gts class body is checked, and its <template>'s comments aren't",
    filename: 'x.gts',
    languageOptions: { parser: ember.parser },
    code: [
      "import Component from '@glimmer/component';",
      '',
      'export default class Foo extends Component {',
      '  /** A field. */',
      '  x = 1;',
      '',
      '  <template>',
      '    {{!-- /** Not JSDoc. */ --}}',
      '    <!-- /** Not JSDoc. */ -->',
      '  </template>',
      '}',
      '',
    ].join('\n'),
    output: [
      "import Component from '@glimmer/component';",
      '',
      'export default class Foo extends Component {',
      '  /**',
      '   * A field.',
      '   */',
      '  x = 1;',
      '',
      '  <template>',
      '    {{!-- /** Not JSDoc. */ --}}',
      '    <!-- /** Not JSDoc. */ -->',
      '  </template>',
      '}',
      '',
    ].join('\n'),
  },
].map((c) => ({ errors: [{ messageId: 'single' }], ...c }));
