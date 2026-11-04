# eslint-plugin-jsdoc-flow

ESLint rules that flow the text of JSDoc comments, the way Prettier flows
code: consistent sentence spacing, line breaks that never strand a word,
tag descriptions that line up, and no single-line blocks. All rules
are autofixable, and they only change whitespace or line prefixes.

```js
// Before
/**
 *  Saves the note. Its title and body are written at once, so
 * a reader never sees
 * one without the  other. Returns a promise.
 *
 * It throws if :
 * -  the note has no ID, which a new note gets only once it's been
 * added to a notebook
 * - the store is read-only
 *
 * @param {Note} note -  the note to save
 * @param {SaveOptions} [options] - how long to wait: in milliseconds, or
 *   forever if it's unset
 * @returns {Promise<void>} resolves once both are written
 */

// After `eslint --fix`
/**
 * Saves the note.  Its title and body are written at once, so a reader
 * never sees one without the other.  Returns a promise.
 *
 * It throws if:
 * - the note has no ID, which a new note gets only once it's been
 *   added to a notebook
 * - the store is read-only
 *
 * @param {Note} note - the note to save
 * @param {SaveOptions} [options] - how long to wait:  in milliseconds,
 *                                  or forever if it's unset
 * @returns {Promise<void>} resolves once both are written
 */
```

## Install

```sh
npm install --save-dev eslint-plugin-jsdoc-flow
```

Requires ESLint 9 or later (flat config) and Node.js 20.19 or later.

## Usage

Use the `recommended` config, which turns on all fourteen rules as warnings:

```js
// eslint.config.js
import jsdocFlow from 'eslint-plugin-jsdoc-flow';

export default [
  // ...
  jsdocFlow.configs.recommended,
];
```

Run `eslint --fix` to format comments.

The rules check standalone `/** ... */` blocks in files ESLint can parse.
TypeScript and Ember `.gjs`/`.gts` files need their respective parsers;
comments inside Ember `<template>` blocks are left alone. Ordinary `/* */`
and `//` comments, and banners beginning with more than two stars such as
`/*** ... */`, are unaffected.

## Rules

| Rule                                    | Description                                            | Fixable |
| --------------------------------------- | ------------------------------------------------------ | ------- |
| `jsdoc-flow/reflow`                     | Flow JSDoc text with consistent line breaks            | ✓       |
| `jsdoc-flow/sentence-spacing`           | Sentence spacing (default: two spaces)                 | ✓       |
| `jsdoc-flow/colon-spacing`              | Colon spacing (default: two spaces)                    | ✓       |
| `jsdoc-flow/word-spacing`               | One space between other words                          | ✓       |
| `jsdoc-flow/no-extra-punctuation-space` | No space before `, . ; : ) ]` or after `( [`           | ✓       |
| `jsdoc-flow/tag-spacing`                | One space on either side of a tag's `-`                | ✓       |
| `jsdoc-flow/bullet-spacing`             | One space after a list item's marker                   | ✓       |
| `jsdoc-flow/no-exotic-whitespace`       | Plain spaces, not tabs or other Unicode spaces         | ✓       |
| `jsdoc-flow/star-align`                 | Put each line's `*` under the `/**`                    | ✓       |
| `jsdoc-flow/text-indent`                | One space between a line's `*` and its text            | ✓       |
| `jsdoc-flow/no-trailing-space`          | No whitespace after a line's text                      | ✓       |
| `jsdoc-flow/tag-align`                  | Start a tag's continuation lines under its description | ✓       |
| `jsdoc-flow/bullet-align`               | Start a list item's wrapped lines under its text       | ✓       |
| `jsdoc-flow/single-line`                | Spread a single-line JSDoc block over three lines      | ✓       |

## Configuration

Override or disable recommended rules after the preset, or register the plugin yourself
under `plugins: { 'jsdoc-flow': jsdocFlow }` to enable individual rules.

These settings apply across all rules, so they always agree. Set them under
`settings['jsdoc-flow']`, as below.

| Setting   | Default | Purpose                                                                                                 |
| --------- | ------- | ------------------------------------------------------------------------------------------------------- |
| `spaces`  | `2`     | Spaces after sentences and colons: `1` or `2`.                                                          |
| `width`   | `80`    | Target maximum line width, including indentation and the `*` prefix. Unbreakable content may exceed it. |
| `maxHead` | `0.55`  | Widest a tag's head may be and keep its description beside it, as a fraction of the width.              |

```js
import jsdocFlow from 'eslint-plugin-jsdoc-flow';

export default [
  jsdocFlow.configs.recommended,
  {
    files: ['src/**/*.{js,ts}'],
    settings: {
      'jsdoc-flow': { spaces: 1, width: 100 },
    },
    rules: {
      'jsdoc-flow/reflow': ['warn', { hang: false }],
      'jsdoc-flow/single-line': ['warn', { allowTags: ['type', 'typedef'] }],
    },
  },
];
```

`reflow` supports these options:

| Option       | Default                                         | Purpose                                                                                                 |
| ------------ | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `orphans`    | `{ sentence: true, clause: true, paren: true }` | Avoid isolated words at sentence, clause and parenthetical boundaries. Disable each limit individually. |
| `names`      | `true`                                          | Keep abbreviations with adjacent names, such as `Mr. Smith`.                                            |
| `shortWords` | `true`                                          | Keep articles and one-letter words with the following word.                                             |
| `hang`       | `true`                                          | Allow one closing punctuation character beyond the width.                                               |
| `widows`     | `0.15`                                          | Target minimum final-line length as a fraction of the width; `0` disables it.                           |

`single-line` accepts `allowTags` (default `[]`): tag names without `@` whose
blocks may stay on one line when they begin with that tag. Other rules still
apply, and `reflow` may expand a block that is too wide. One-line `@ts-*`
directives are always preserved.

## Preserved formatting

Prose and wrapped tag or list descriptions are reflowed. Markdown structures,
fenced and indented code, `@example` blocks, and multi-line types retain their
line structure. Spacing rules may still apply to some of these constructs.

Unfenced code and diagrams are also preserved when detected from their layout.
Detection is heuristic: use a code fence or an ignore marker when preserving
layout is essential. Set `settings['jsdoc-flow'].preformatted` to `false` to
disable this detection.

## Leaving a block alone

Put an ignore marker immediately above a block to make every rule skip it:

```js
// jsdoc-flow-ignore: preserve diagram layout
/**
 * client --> server
 */
```

`/* jsdoc-flow-ignore */` also works. The marker must occupy its own line,
with no blank line, code or other comment between it and the block.
`eslint-disable-next-line` is unsuitable because rules report on interior lines.

Blocks containing `@license`, `@preserve` or `@copyright` tag lines are skipped
by default. Customise the list in shared settings:

```js
settings: {
  'jsdoc-flow': {
    verbatimTags: ['license', 'preserve', 'copyright', 'diagram'],
  },
},
```

`verbatimTags` replaces the defaults; `[]` disables tag-based skipping. Names
omit `@` and are case-sensitive. Adding `example` skips the entire block,
rather than preserving only the example's lines.

## License

MIT
