// The `jsdoc-flow/delimiter-lines` cases, shared by its own tests and the
// tests of all the rules together.  Text on a multi-line block's `/**` line or
// `*/` line is reported, and the fix moves it onto a line of its own.
import { block } from '../helpers.js';

const code = (...lines) => `${lines.join('\n')}\nexport const x = 1;\n`;

// An error on a delimiter line's text, from its first column to its last.
const opening = (column, endColumn, line = 1) => ({
  messageId: 'opening',
  line,
  column,
  endLine: line,
  endColumn,
});
const closing = (line, column, endColumn) => ({
  messageId: 'closing',
  line,
  column,
  endLine: line,
  endColumn,
});

export const delimiterValid = [
  {
    name: 'delimiters on lines of their own',
    code: block('Saves it.', '@returns z'),
  },
  {
    name: 'a one-line block, which is left to `single-line`',
    code: code('/** Saves it. */'),
  },
  {
    name: 'an empty block',
    code: code('/**', ' */'),
  },
  {
    name: 'whitespace after the `/**` and before the `*/`',
    code: code('/**  ', ' * Saves it.', ' *  */'),
  },
  {
    name: 'a `@ts-expect-error` on the `*/` line, which TypeScript reads there',
    code: code('/** Saves it.', ' * @ts-expect-error */'),
  },
  {
    name: 'a `@ts-ignore` on the `*/` line',
    code: code('/**', ' * @ts-ignore */'),
  },
  {
    name: 'closing text that ends in a `*`, which may be the `*/`’s',
    code: code('/** Saves it.', ' * Then returns **/'),
  },
  {
    name: 'closing text that ends in a `*` before a space',
    code: code('/**', ' * Then returns * */'),
  },
  {
    name: 'a verbatim tag on the `/**` line',
    code: code('/** @license MIT', ' * Copyright. One. Two.', ' */'),
  },
  {
    name: 'a verbatim tag on the `*/` line',
    code: code('/** Copyright.', ' * One. Two.', ' * @preserve */'),
  },
  {
    name: 'a block below an ignore comment',
    code: code('// jsdoc-flow-ignore', '/** Saves it.', ' * Then returns. */'),
  },
];

export const delimiterInvalid = [
  {
    name: 'text on both delimiter lines of a two-line block',
    code: code('/** Saves it.', ' * Then returns. */'),
    output: block('Saves it.', 'Then returns.'),
    errors: [opening(5, 14), closing(2, 4, 17)],
  },
  {
    name: 'text on the `/**` line',
    code: code('/** Saves it.', ' * Then returns.', ' */'),
    output: block('Saves it.', 'Then returns.'),
    errors: [opening(5, 14)],
  },
  {
    name: 'text on the `*/` line',
    code: code('/**', ' * Saves it.', ' * Then returns. */'),
    output: block('Saves it.', 'Then returns.'),
    errors: [closing(3, 4, 17)],
  },
  {
    name: 'text on the `/**` line of a two-line block',
    code: code('/** Saves it.', ' */'),
    output: block('Saves it.'),
    errors: [opening(5, 14)],
  },
  {
    name: 'an indented block',
    code: [
      'class A {',
      '  /** Saves it.',
      '   * Then returns. */',
      '  x = 1;',
      '}',
      '',
    ].join('\n'),
    output: [
      'class A {',
      '  /**',
      '   * Saves it.',
      '   * Then returns.',
      '   */',
      '  x = 1;',
      '}',
      '',
    ].join('\n'),
    errors: [opening(7, 16, 2), closing(3, 6, 19)],
  },
  {
    name: 'no space after the `/**`',
    code: code('/**Saves it.', ' */'),
    output: block('Saves it.'),
    errors: [opening(4, 13)],
  },
  {
    name: 'whitespace around the text, kept but before the `*/`',
    code: code('/**  Saves it.  ', ' * Then returns.  */'),
    output: code('/**', ' *  Saves it.  ', ' * Then returns.', ' */'),
    errors: [opening(6, 15), closing(2, 4, 17)],
  },
  {
    name: 'a tab before the text, which is the one space after the `*`',
    code: code('/**\tSaves it.', ' */'),
    output: code('/**', ' *\tSaves it.', ' */'),
    errors: [opening(5, 14)],
  },
  {
    name: 'opening text indented as code, which stays code',
    code: code('/**     a();', ' * Then returns.', ' */'),
    output: block('    a();', 'Then returns.'),
    errors: [opening(9, 13)],
  },
  {
    name: 'opening text indented less than code, which stays prose',
    code: code('/**    Saves it.', ' */'),
    output: code('/**', ' *    Saves it.', ' */'),
    errors: [opening(8, 17)],
  },
  {
    name: 'a closing line with its own prefix, which it keeps',
    code: code('/**', ' * Saves it.', '   *  Then returns. */'),
    output: code('/**', ' * Saves it.', '   *  Then returns.', ' */'),
    errors: [closing(3, 7, 20)],
  },
  {
    name: 'a fence that ends on the `*/` line',
    code: code('/** Saves it:', ' * ```js', ' * a();', ' * ``` */'),
    output: block('Saves it:', '```js', 'a();', '```'),
    errors: [opening(5, 14), closing(4, 4, 7)],
  },
  {
    name: 'a tag on the `/**` line',
    code: code('/** @param x - y', ' * @returns z */'),
    output: block('@param x - y', '@returns z'),
    errors: [opening(5, 17), closing(2, 4, 14)],
  },
  {
    name: 'a `@ts-expect-error` on the `/**` line, which TypeScript ignores',
    code: code('/** @ts-expect-error', ' */'),
    output: block('@ts-expect-error'),
    errors: [opening(5, 21)],
  },
  {
    name: 'a tag that `verbatimTags` no longer names',
    settings: { 'jsdoc-flow': { verbatimTags: ['diagram'] } },
    code: code('/** @license MIT', ' * Copyright. */'),
    output: block('@license MIT', 'Copyright.'),
    errors: [opening(5, 17), closing(2, 4, 14)],
  },
];

// Blocks that still aren't ones the rules read once spread, since a line has
// no `*`, which only `jsdoc/require-asterisk-prefix` adds, so every rule
// skips them.
export const delimiterUnhandled = [
  {
    name: 'a middle line without a `*`',
    code: code('/** Saves it.', '  Then returns.', ' */'),
  },
  {
    name: 'a closing line without a `*`',
    code: code('/**', ' * Saves it.', '   Then returns. */'),
  },
  {
    name: 'a closing line whose `*` has no space after it',
    code: code('/**', ' *Then returns. */'),
  },
];

// What all the rules together make of a block once its delimiters are
// spread:  the other rules format it as they would any other.
export const delimiterSettled = [
  {
    name: 'text on both delimiter lines, joined and spaced',
    code: code('/** Saves it.', ' * Then returns. */'),
    output: block('Saves it.  Then returns.'),
  },
  {
    name: 'an indented block, aligned and spaced',
    code: [
      'class A {',
      '  /**   Saves it. Then',
      '       * returns.',
      '   *    @param x  -  y */',
      '  m(x) {}',
      '}',
      '',
    ].join('\n'),
    output: [
      'class A {',
      '  /**',
      '   * Saves it.  Then returns.',
      '   * @param x - y',
      '   */',
      '  m(x) {}',
      '}',
      '',
    ].join('\n'),
  },
  {
    name: 'a wide line on the `/**` line, wrapped',
    code: code(
      '/** Saves it, and then it returns what it saved to whoever asked for it in',
      ' * the first place. */',
    ),
    output: block(
      'Saves it, and then it returns what it saved to whoever asked for it in',
      'the first place.',
    ),
  },
];
