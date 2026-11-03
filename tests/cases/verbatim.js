// The cases of the ignore comment and `verbatimTags`, which the tests of all
// the rules together check.  A case without an `output` is left as it is by
// every rule, and one with an `output` shows what doesn't protect a block.
import ts from 'typescript-eslint';

import { block } from '../helpers.js';

const tags = (...verbatimTags) => ({ 'jsdoc-flow': { verbatimTags } });

// Text that every fix below changes, and what it becomes.
const MESSY = 'One. Two.';
const TIDY = 'One.  Two.';
const after = '\nexport const x = 1;\n';
// A JSDoc block of the given text, then code, as `block` writes it.
const messy = block(MESSY);
const tidy = block(TIDY);
// A block's code declares a name, so a second block in a file needs another.
const next = (code) => code.replace('const x', 'const y');

const honoured = [
  ['a line comment', '// jsdoc-flow-ignore'],
  ['a block comment', '/* jsdoc-flow-ignore */'],
  ['a line comment without a space', '//jsdoc-flow-ignore'],
  ['a block comment without spaces', '/*jsdoc-flow-ignore*/'],
  ['a line comment with a reason', '// jsdoc-flow-ignore: ASCII diagram'],
  ['a block comment with a reason', '/* jsdoc-flow-ignore: a diagram */'],
  ['a reason after a space', '// jsdoc-flow-ignore ASCII diagram'],
  ['whitespace after the comment', '/* jsdoc-flow-ignore */  '],
  ['indentation before the comment', '    // jsdoc-flow-ignore'],
].map(([name, marker]) => ({
  name: `ignored by ${name}`,
  code: `${marker}\n${messy}`,
}));

const notHonoured = [
  ['a blank line', '// jsdoc-flow-ignore\n\n'],
  ['a line of whitespace', '// jsdoc-flow-ignore\n  \n'],
  ['code', '/* jsdoc-flow-ignore */\nfoo();\n'],
  ['another comment', '// jsdoc-flow-ignore\n// Another.\n'],
].map(([name, before]) => ({
  name: `not ignored:  ${name} between the comment and the block`,
  code: `${before}${messy}`,
  output: `${before}${tidy}`,
}));

const notMarkers = [
  ['code before the comment', 'foo(); // jsdoc-flow-ignore'],
  ['code after the comment', '/* jsdoc-flow-ignore */ foo();'],
  ['another comment after it', '/* jsdoc-flow-ignore */ // Why.'],
  ['a comment over several lines', '/* jsdoc-flow-ignore\n */'],
  ['a longer name', '// jsdoc-flow-ignored'],
  ['a longer name with a dash', '// jsdoc-flow-ignore-next'],
  ['another case', '// JSDOC-FLOW-IGNORE'],
  ['words before the marker', '// see jsdoc-flow-ignore'],
].map(([name, marker]) => ({
  name: `not ignored:  ${name}`,
  code: `${marker}\n${messy}`,
  output: `${marker}\n${tidy}`,
}));

const verbatim = ['license', 'preserve', 'copyright'].flatMap((tag) => [
  {
    name: `\`@${tag}\` at the top`,
    code: block(`@${tag}`, 'Copyright (c) Example.', MESSY),
  },
  {
    name: `\`@${tag}\` at the bottom, with text above it`,
    code: block(MESSY, '', 'More. Text.', '', `@${tag} MIT`),
  },
  {
    name: `\`@${tag}\` on one line`,
    code: `/** @${tag} ${MESSY} */${after}`,
  },
]);

const customs = [
  {
    name: 'a custom tag',
    code: block('@diagram', MESSY),
    settings: tags('diagram'),
  },
  {
    name: 'a default tag named in a custom list',
    code: block('@license', MESSY),
    settings: tags('license', 'diagram'),
  },
  {
    name: 'a custom list replaces the default',
    code: block('@license', MESSY),
    output: block(`@license ${TIDY}`),
    settings: tags('diagram'),
  },
  {
    name: 'a custom tag is not verbatim by default',
    code: block('@diagram', MESSY),
    output: block(`@diagram ${TIDY}`),
  },
  {
    name: 'an empty list opts out',
    code: block('@license', MESSY),
    output: block(`@license ${TIDY}`),
    settings: tags(),
  },
  {
    name: 'an empty list keeps the ignore comment working',
    code: `// jsdoc-flow-ignore\n${block('@license', MESSY)}`,
    settings: tags(),
  },
  {
    name: 'settings without `verbatimTags` keep the default',
    code: block('@license', MESSY),
    settings: { 'jsdoc-flow': {} },
  },
  {
    name: 'naming `@example` makes its whole block verbatim',
    code: block(MESSY, '', '@example', 'foo();'),
    settings: tags('example'),
  },
];

const notTags = [
  [
    'a tag with a longer name',
    block('@licenses', MESSY),
    block(`@licenses ${TIDY}`),
  ],
  [
    'a tag with a longer name after a dash',
    block('@license-url', MESSY),
    block(`@license-url ${TIDY}`),
  ],
  [
    'a tag in another case',
    block('@License', MESSY),
    block(`@License ${TIDY}`),
  ],
  ['a tag in a backtick fence', ['```', '@license', '```']],
  ['a tag in a tilde fence', ['~~~', '@license', '~~~']],
  ['a tag in a fence nothing closes', ['```', '@license']],
  ['a tag in `<pre>`', ['<pre>', '@license', '</pre>']],
  ['a tag in an HTML comment', ['<!--', '@license', '-->']],
  ['a tag in indented code', ['    @license']],
  ['a tag in a list item', ['- @license']],
  ['a tag in a blockquote', ['> @license']],
].map(([name, code, output]) =>
  Array.isArray(code)
    ? {
        name: `not verbatim:  ${name}`,
        code: block(MESSY, '', ...code),
        output: block(TIDY, '', ...code),
      }
    : { name: `not verbatim:  ${name}`, code, output },
);

const prose = [
  {
    name: 'not verbatim:  a tag later in a paragraph',
    code: block('See the @license tag. Two.'),
    output: block('See the @license tag.  Two.'),
  },
  {
    name: 'not verbatim:  a tag later in another tag',
    code: block('@since 2 @license. Two.'),
    output: block('@since 2 @license.  Two.'),
  },
  {
    name: 'not verbatim:  a tag later on one line',
    code: `/** See @license. Two. */${after}`,
    output: block('See @license.  Two.'),
  },
  {
    name: 'not verbatim:  wording without a tag',
    code: block('Copyright (c) Example. License: MIT.'),
    output: block('Copyright (c) Example.  License:  MIT.'),
  },
  {
    name: 'not verbatim:  `@example` keeps its own lines only',
    code: block(MESSY, '', '@example', 'One. Two.'),
    output: block(TIDY, '', '@example', 'One. Two.'),
  },
];

const forms = [
  {
    name: 'a tag after a fence, which has closed',
    code: block('```', 'foo();', '```', '@license', MESSY),
  },
  {
    name: 'a tag after a line starting with an inline ``` span',
    code: block('```foo``` text', '@license', MESSY),
  },
  {
    name: 'a tag after `@example`, which it ends',
    code: block('@example', 'foo();', '@license', MESSY),
  },
  {
    name: 'a tag with a multi-line `{Type}`',
    code: block('@license {{', '  a: b', '}}', MESSY),
  },
  {
    name: 'a tag above an underline',
    code: block('@license MIT', '---', MESSY),
  },
  {
    name: 'a tag whose line is indented, inside a paragraph',
    code: block(MESSY, '     @license', MESSY),
  },
  {
    name: 'a tag after a zero-width space, as `no-exotic-whitespace` reads it',
    code: block(MESSY, '\u200b@license', MESSY),
  },
  {
    name: 'a tag after a zero-width space on one line',
    code: `/** \u200b@license ${MESSY} */${after}`,
  },
  {
    name: 'one line with no space after its `/**`, which only `single-line` checks',
    code: `/**@license MIT*/${after}`,
  },
  {
    name: 'one line too wide to fit',
    code: `/** @license ${'word '.repeat(20)}*/${after}`,
  },
  {
    name: 'an indented block',
    code: `class A {\n  /**\n   * @license\n   * ${MESSY}\n   */\n  b;\n}\n`,
  },
  {
    name: 'in a .ts file',
    filename: 'x.ts',
    languageOptions: { parser: ts.parser },
    code: `// jsdoc-flow-ignore\n/**\n * ${MESSY}\n */\nexport const a: string = '';\n${block('@license', MESSY)}`,
  },
];

const neighbours = [
  {
    name: 'only the next block is ignored',
    code: `// jsdoc-flow-ignore\n${messy}${next(messy)}`,
    output: `// jsdoc-flow-ignore\n${messy}${next(tidy)}`,
  },
  {
    name: 'a block right after the ignored block, with no code between',
    code: `// jsdoc-flow-ignore\n/**\n * ${MESSY}\n */\n/**\n * ${MESSY}\n */\n`,
    output: `// jsdoc-flow-ignore\n/**\n * ${MESSY}\n */\n/**\n * ${TIDY}\n */\n`,
  },
  {
    name: 'a block above the comment',
    code: `${messy}// jsdoc-flow-ignore\n${next(messy)}`,
    output: `${tidy}// jsdoc-flow-ignore\n${next(messy)}`,
  },
  {
    name: 'a one-line block above the comment, which a fix spreads out',
    code: `/** ${MESSY} */\n// jsdoc-flow-ignore\n${messy}`,
    output: `/**\n * ${TIDY}\n */\n// jsdoc-flow-ignore\n${messy}`,
  },
  {
    name: 'only the block with the tag is verbatim',
    code: `${block('@license', MESSY)}${next(messy)}`,
    output: `${block('@license', MESSY)}${next(tidy)}`,
  },
  {
    name: 'a JSDoc block that reads like the comment is no marker',
    code: `/**\n * jsdoc-flow-ignore\n */\n${messy}`,
    output: `/**\n * jsdoc-flow-ignore\n */\n${tidy}`,
  },
];

export const verbatimCases = [
  ...honoured,
  ...notHonoured,
  ...notMarkers,
  ...verbatim,
  ...customs,
  ...notTags,
  ...prose,
  ...forms,
  ...neighbours,
];

// Blocks that, between them, every rule reports, each with a `@license` line
// that makes it verbatim by default.
export const messyBlocks = [
  block(
    '@license',
    '@param name  -  one. Two:  a  b.',
    '  three',
    '',
    'Four',
    'five.',
  ),
  next(block('@license', 'One: two.')),
  '/** @license Six , then. */\nexport const t = 2;\n',
  '/**\n   *  Seven.  \n *\n * @license\n */\nexport const z = 3;\n',
  '/**\n * @license\n * -  Eight.\n */\nexport const w = 4;\n',
  '/**\n * @license\n * Nine\tten.\n */\nexport const v = 5;\n',
  '/**\n * @license\n * - Eleven,\n * twelve.\n */\nexport const u = 6;\n',
];
