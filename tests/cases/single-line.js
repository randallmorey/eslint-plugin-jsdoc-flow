// The `jsdoc-flow/single-line` cases, shared by its own tests and
// the tests of all the rules together.  A one-line block is reported whole,
// and the fix spreads it over three lines, keeping its text as it is.
import ts from 'typescript-eslint';
import ember from 'eslint-plugin-ember/recommended';

import { block } from '../helpers.js';

const allow = (...allowTags) => [{ allowTags }];

// A `@ts-*` directive wider than the 80 columns `reflow` allows.
const wideDirective =
  '/** @ts-expect-error the upstream type is wrong here, and it stays wrong until the next major */';

// One-liners that `single-line` exempts, and the text that all the rules
// together settle on (`output`, if that isn't the `code`).
export const singleSettled = [
  ...['ts-expect-error', 'ts-ignore', 'ts-nocheck', 'ts-check', 'ts-other'].map(
    (tag) => ({
      name: `\`@${tag}\` stays on one line`,
      code: `/** @${tag} */\nexport const x = 1;\n`,
    }),
  ),
  {
    name: 'a directive above the error it suppresses, in a .ts file',
    filename: 'x.ts',
    languageOptions: { parser: ts.parser },
    code: '/** @ts-expect-error reason */\nexport const a: string = 1;\n',
  },
  {
    name: 'a directive with a reason',
    code: '/** @ts-expect-error the types are wrong */\nexport const x = 1;\n',
  },
  {
    name: 'a directive whatever `allowTags` says',
    code: '/** @ts-ignore a reason */\nexport const x = 1;\n',
    options: allow('type'),
  },
  {
    name: 'a directive too wide to fit',
    code: `${wideDirective}\nexport const x = 1;\n`,
  },
  {
    name: 'an indented directive too wide to fit',
    code: `class A {\n  ${wideDirective}\n  x = 1;\n}\n`,
  },
  {
    name: 'a directive too wide, with a wide head',
    code: '/** @ts-expect-error {import("./a/very/long/module/name/that/runs/on").AndOn} a b */\nexport const x = 1;\n',
  },
  {
    name: 'a directive too wide, with a `:` after its name',
    code: '/** @ts-ignore: the upstream type is wrong here, and it stays wrong until the next major */\nexport const x = 1;\n',
    output:
      '/** @ts-ignore:  the upstream type is wrong here, and it stays wrong until the next major */\nexport const x = 1;\n',
  },
  {
    name: "a directive's spacing is fixed on its line",
    code: `/**   @ts-ignore one. Two  three , four:  five  */\nexport const x = 1;\n`,
    output:
      '/** @ts-ignore one.  Two three, four:  five */\nexport const x = 1;\n',
  },
  {
    name: "a wide directive's spacing is fixed on its line",
    code: '/** @ts-expect-error the upstream type is wrong. It  stays wrong until the next major one */\nexport const x = 1;\n',
    output:
      '/** @ts-expect-error the upstream type is wrong.  It stays wrong until the next major one */\nexport const x = 1;\n',
  },
  {
    name: 'a directive against the delimiters',
    code: '/**@ts-ignore*/\nexport const x = 1;\n',
  },
  {
    name: 'a directive after enough spaces to look like indented code',
    code: '/**     @ts-ignore a reason */\nexport const x = 1;\n',
    output: '/** @ts-ignore a reason */\nexport const x = 1;\n',
  },
  {
    name: 'a directive after a tab',
    code: '/**\t@ts-ignore a\treason */\nexport const x = 1;\n',
    output: '/** @ts-ignore a reason */\nexport const x = 1;\n',
  },
  {
    name: 'a directive on three lines, which TypeScript ignores, is not collapsed',
    code: block('@ts-expect-error a reason'),
  },
  {
    name: 'a directive on the last line of a longer block is left as it is',
    code: '/**\n * Some text.\n * @ts-ignore a reason */\nexport const x = 1;\n',
  },
  {
    name: 'an allowed tag',
    code: '/** @type {Foo} */\nexport const x = 1;\n',
    options: allow('type', 'typedef', 'deprecated'),
  },
  {
    name: 'an allowed tag with text',
    code: '/** @deprecated Use `y`, which is faster. */\nexport const x = 1;\n',
    options: allow('type', 'typedef', 'deprecated'),
  },
  {
    name: 'an allowed tag with its type against its name',
    code: '/** @type{Foo} */\nexport const x = 1;\n',
    options: allow('type'),
  },
  {
    name: "an allowed tag's spacing is fixed on its line",
    code: '/**  @deprecated Use y. It  is faster.  */\nexport const x = 1;\n',
    output: '/** @deprecated Use y.  It is faster. */\nexport const x = 1;\n',
    options: allow('deprecated'),
  },
  {
    name: 'an allowed tag after enough spaces to look like indented code',
    code: '/**     @type {Foo} */\nexport const x = 1;\n',
    output: '/** @type {Foo} */\nexport const x = 1;\n',
    options: allow('type'),
  },
  {
    name: "a second tag on the line is the first tag's text, so the first counts",
    code: '/** @type {Foo} @since 2 */\nexport const x = 1;\n',
    options: allow('type'),
  },
  {
    name: 'an allowed tag too wide to fit is left to `reflow`, which expands it',
    code: "/** @typedef {import('./a/very/long/module/name/that/runs/on').AndOnAndOn} AndOn */\nexport const x = 1;\n",
    output: block(
      "@typedef {import('./a/very/long/module/name/that/runs/on').AndOnAndOn} AndOn",
    ),
    options: allow('typedef'),
  },
  {
    name: 'an allowed tag that `reflow` keeps as code is expanded by `reflow`',
    code: '/** @example foo() */\nexport const x = 1;\n',
    output: block('@example foo()'),
    options: allow('example'),
  },
];

// Comments that open with more than two stars, which aren't JSDoc blocks, so
// every rule leaves them as they are, on one line or several.
export const extraStars = [
  ['one line', '/*** Saves */'],
  ['one line with messy spacing', '/***  Saves. Two  words  */'],
  ['one line with a tag', '/*** @param  name - the name */'],
  ['a one-line banner', '/***** Banner *****/'],
  ['no text', '/*** */'],
  ['only stars', '/****/'],
  ['several lines', '/***\n * Saves. Two  words  \n *   @param  x - y\n */'],
  ['several lines with text after the stars', '/*** Saves. Two\n * words\n */'],
  ['a banner on several lines', '/*****\n * Banner. Two  words\n *****/'],
  ['nested in a class', 'class A {\n  /*** Saves */\n  x = 1;\n}'],
].map(([name, comment]) => ({
  name: `more than two stars:  ${name}`,
  code: `${comment}\nexport const x = 1;\n`,
}));

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
      '/*** */',
      '/****/',
      '/*****/',
      'foo(/** @type {Foo} */ (bar));',
      '/** Code after the block. */ foo();',
      '',
    ].join('\n'),
  },
  ...extraStars,
  ...singleSettled.map(
    ({ name, code, options, filename, languageOptions }) => ({
      name,
      code,
      ...(options && { options }),
      ...(filename && { filename }),
      ...(languageOptions && { languageOptions }),
    }),
  ),
];

export const singleInvalid = [
  {
    name: 'a one-liner is spread over three lines',
    code: '/** Short text. */\nexport const x = 1;\n',
    output: block('Short text.'),
  },
  {
    name: 'a one-liner starting with an inline ``` span',
    code: '/** ```foo``` inline text. */\nexport const x = 1;\n',
    output: block('```foo``` inline text.'),
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
  {
    name: 'a description, with tags allowed',
    code: '/** Saves the note. */\nexport const x = 1;\n',
    output: block('Saves the note.'),
    options: allow('type', 'deprecated'),
  },
  {
    name: 'a description before an allowed tag',
    code: '/** Saves the note. @deprecated */\nexport const x = 1;\n',
    output: block('Saves the note. @deprecated'),
    options: allow('deprecated'),
  },
  {
    name: 'a tag that is not allowed',
    code: '/** @param name */\nexport const x = 1;\n',
    output: block('@param name'),
    options: allow('type'),
  },
  {
    name: 'an allowed tag is matched by its whole name',
    code: '/** @typedef {Foo} Bar */\nexport const x = 1;\n',
    output: block('@typedef {Foo} Bar'),
    options: allow('type'),
  },
  {
    name: 'an allowed tag after a tag that is not allowed',
    code: '/** @since 2 @type {Foo} */\nexport const x = 1;\n',
    output: block('@since 2 @type {Foo}'),
    options: allow('type'),
  },
  {
    name: 'an allowed tag whose case differs',
    code: '/** @Type {Foo} */\nexport const x = 1;\n',
    output: block('@Type {Foo}'),
    options: allow('type'),
  },
  {
    name: 'a description before a directive, which TypeScript ignores',
    code: '/** A reason. @ts-ignore */\nexport const x = 1;\n',
    output: block('A reason. @ts-ignore'),
  },
  {
    name: 'a tag that only starts like a directive',
    code: '/** @tsconfig a.json */\nexport const x = 1;\n',
    output: block('@tsconfig a.json'),
  },
].map((c) => ({ errors: [{ messageId: 'single' }], ...c }));
