# eslint-plugin-jsdoc-flow

ESLint rules that flow the text of JSDoc comments, the way Prettier flows
code: consistent sentence spacing, line breaks that never strand a word,
tag descriptions that line up, and no single-line blocks. All rules
are autofixable, and they only change whitespace or line prefixes.

```js
// Before
/**
 * Saves the note. Its title and body are written at once, so a reader never
 * sees
 * one without the other.
 *
 * @param {Note} note - the note to save, which must already have an ID, or
 *   it throws
 */

// After `eslint --fix`
/**
 * Saves the note.  Its title and body are written at once, so a reader never
 * sees one without the other.
 *
 * @param {Note} note - the note to save, which must already have an ID,
 *                      or it throws
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

Or configure the rules yourself, for example to limit them to some files,
to change the line width, or to turn off some of the limits on line breaks:

```js
// eslint.config.js
import jsdocFlow from 'eslint-plugin-jsdoc-flow';

export default [
  {
    files: ['src/**/*.{js,ts}'],
    plugins: { 'jsdoc-flow': jsdocFlow },
    rules: {
      'jsdoc-flow/reflow': ['warn', { width: 80, orphans: { paren: false } }],
      'jsdoc-flow/sentence-spacing': 'warn',
      'jsdoc-flow/colon-spacing': 'warn',
      'jsdoc-flow/word-spacing': 'warn',
      'jsdoc-flow/no-extra-punctuation-space': 'warn',
      'jsdoc-flow/tag-spacing': 'warn',
      'jsdoc-flow/bullet-spacing': 'warn',
      'jsdoc-flow/no-exotic-whitespace': 'warn',
      'jsdoc-flow/star-align': 'warn',
      'jsdoc-flow/text-indent': 'warn',
      'jsdoc-flow/no-trailing-space': 'warn',
      'jsdoc-flow/tag-align': 'warn',
      'jsdoc-flow/bullet-align': 'warn',
      'jsdoc-flow/single-line': 'warn',
    },
  },
];
```

Then run `eslint --fix` to reflow, space and align every comment. With all
fourteen rules on, `--fix` settles on the same text whichever rule fixes first.

The rules check every `/** ... */` block that sits alone on its lines, in any
file ESLint can parse: JavaScript, TypeScript (with `typescript-eslint`'s
parser), and Ember `.gjs`/`.gts` files (with `eslint-plugin-ember`'s parser,
which leaves comments inside `<template>` alone). Ordinary `/* */` and `//`
comments aren't touched.

## Rules

| Rule                                    | Description                                            | Fixable |
| --------------------------------------- | ------------------------------------------------------ | ------- |
| `jsdoc-flow/reflow`                     | Flow JSDoc text with consistent line breaks            | ✓       |
| `jsdoc-flow/sentence-spacing`           | Two spaces after a sentence end                        | ✓       |
| `jsdoc-flow/colon-spacing`              | Two spaces after a colon                               | ✓       |
| `jsdoc-flow/word-spacing`               | One space between other words                          | ✓       |
| `jsdoc-flow/no-extra-punctuation-space` | No space before `, . ; : ) ]` or after `( [`           | ✓       |
| `jsdoc-flow/tag-spacing`                | One space on either side of a tag's `-`                | ✓       |
| `jsdoc-flow/bullet-spacing`             | One space after a list item's `-`, `*` or `1.`         | ✓       |
| `jsdoc-flow/no-exotic-whitespace`       | Plain spaces, not tabs or other Unicode spaces         | ✓       |
| `jsdoc-flow/star-align`                 | Put each line's `*` under the `/**`                    | ✓       |
| `jsdoc-flow/text-indent`                | One space between a line's `*` and its text            | ✓       |
| `jsdoc-flow/no-trailing-space`          | No whitespace after a line's text                      | ✓       |
| `jsdoc-flow/tag-align`                  | Start a tag's continuation lines under its description | ✓       |
| `jsdoc-flow/bullet-align`               | Start a list item's wrapped lines under its text       | ✓       |
| `jsdoc-flow/single-line`                | Spread a single-line JSDoc block over three lines      | ✓       |

### `jsdoc-flow/reflow`

Lays out the text of each JSDoc block again, and reports each place where
the block's line breaks differ from that layout, highlighting the two words
around it: a line should break between them, or they should be on one line.
A misplaced break moves the lines after it too, so only the first is
reported, until the block and its layout break a line at the same word
again. The fix reflows the whole block. Lines are filled as full as the
limits below allow, breaking earlier only where a break would break one of
them.

**Options:**

- `width`: the widest a line may be, its `*` prefix and indentation included.
  Defaults to `80`.
- `orphans`: `{ sentence, clause, paren }`, each `true` by default. Set one
  to `false` to turn off that limit below.
- `names`: `true` by default. Set it to `false` to let a line break between
  an abbreviation and the name beside it.
- `shortWords`: `true` by default. Set it to `false` to let short words end
  lines.
- `hang`: `true` by default. Set it to `false` to keep closing punctuation
  within `width`.
- `widows`: `0.15` by default, the shortest a paragraph's last line may be,
  as a fraction of `width` from `0` to `1`. Set it to `0` to turn that limit
  off.

Its output is spaced as the spacing rules require, and edged as the edge
rules require, and the whitespace in the text it flows is plain spaces. But a
block whose only problems are its spacing, the whitespace at its lines' edges,
or tabs and other whitespace that isn't plain spaces is left to those rules,
since they point at each gap and each line.

**Line breaks.** These limits can each be turned off:

- `orphans.sentence`: no line starts a sentence with a lone word or ends one
  with a lone word, so a sentence's first two and last two words stay
  together.
- `orphans.clause`: a line may end with a comma, semicolon or colon, but not
  where one is followed by a single word, unless that word ends a sentence,
  or follows a comma and ends in a comma or semicolon itself, as in a list
  (`red, green,`). And the line after one may not be a single word.
- `orphans.paren`: inside a parenthetical, the first word after `(` stays
  with the next word, and the last word before `)` with the word before it.
- `names`: an abbreviation stays with the name beside it, as in `Mr. Smith`,
  `St. Paul`, `Elm St.` and `et al.`
- `shortWords`: `a`, `an`, `the` and any one-letter word, such as `I`, never
  end a line, but move to the next with the word after them, as some
  typesetters do, mostly in Central Europe. Case doesn't matter, so `The`
  counts too. A short word with punctuation after it, such as the `B` of
  `plan B.` or `plan B,`, may still end a line, and so may one in a code
  span. Like the other limits, it can make a line wider than `width` when the
  word after the short word is too long to share a line with anything else.
- `hang`: a line may be one column wider than `width` when its last character
  is closing punctuation, `.`, `,`, `;`, `:`, `!`, `?`, `)`, `]` or a closing
  quote (`'`, `"`, `’`, `”`), so the punctuation hangs past the margin, as
  it does in some typesetting. Only that one character hangs, so a line ending
  in `).` may be one column too wide, not two. A one-line block's `*/` still
  has to fit within `width`, since it comes after the punctuation.
- `widows`: a paragraph's last line has at least that fraction of `width` in
  text, not counting its `*` prefix and indentation, so with `0.15` and a
  `width` of 80, at least 12 characters. Words move down to it from the line
  before it, one at a time, until it does, but never so far that it ends
  right of the line before it, counting where each line ends on the page. If
  it can't get long enough, it gets as long as that allows. Only the last two
  lines change, and they keep the other limits and `width`. A tag's
  description and a list item's wrapped lines count as paragraphs too, and a
  one-line paragraph is left as it is.

These limits are always on, since breaking them would change what the text
means:

- A word starting with `@`, `*` or `|`, a lone `-`, or a number and `.` such
  as `2.` never moves to the start of a line, where it would read as a tag, a
  list item or a table row.
- Code spans, Markdown links, `{@link ...}`, `{Type}` and `[optional]` names
  never break, and the whitespace inside them is kept as it is (though
  `no-exotic-whitespace` still makes it plain spaces).
- A line never breaks before `,`, `.`, `;`, `:`, `)` or `]`, or after `(` or
  `[`, and no space is put there either (see `no-extra-punctuation-space`).
- An abbreviation that two spaces make a sentence end (`Elm St.  Then`) stays
  with the next word, since a line break there would lose the two spaces.

For example, on a block with ragged edges:

```js
// Before
/**
 * Lists the notes in a folder. Pinned notes come first: a note is pinned
 * when its front matter sets `pinned: true`.
 * Others follow newest first (by `updatedAt`, then by title), and every note that has been tagged @archive is left out unless asked for.
 *
 * @param {string} folder - the folder to list, which must already exist, or it
 *   throws
 */

// After `eslint --fix`
/**
 * Lists the notes in a folder.  Pinned notes come first:  a note is pinned
 * when its front matter sets `pinned: true`.  Others follow newest first
 * (by `updatedAt`, then by title), and every note that has been
 * tagged @archive is left out unless asked for.
 *
 * @param {string} folder - the folder to list, which must already exist,
 *                          or it throws
 */
```

With the `recommended` config, the block before the fix has five warnings.
`reflow` reports two places, highlighting ``true`.`` and `Others` on lines 3
and 4, and `exist, or` on line 6. `sentence-spacing` and `colon-spacing`
report `folder. Pinned` and `first: a` on line 2, and `tag-align` reports
`throws` on line 7:

```text
2:25  warning  Two spaces should follow a sentence end                                            jsdoc-flow/sentence-spacing
2:51  warning  Two spaces should follow a colon                                                   jsdoc-flow/colon-spacing
3:40  warning  JSDoc text isn't flowed:  these words should be on one line                        jsdoc-flow/reflow
6:68  warning  JSDoc text isn't flowed:  the line should break between these words                jsdoc-flow/reflow
7:6   warning  A JSDoc tag's continuation lines should start under its description, at column 29  jsdoc-flow/tag-align
```

**Tags.**

A tag's head (`@param name -`, `@param {Type} name -`, `@returns
{Type}`) stays on its first line with the start of its description, and its
continuation lines start at the description's column. A head wider than 45
columns stays on one line with its description when the whole tag fits;
otherwise it takes a line of its own, and the whole description starts on the
next line, two spaces in:

```js
/**
 * @param {{ id: string, title: string, body: string }[]} notes -
 *   the notes to save, in the order they should be listed
 */
```

**Left as they are:** bullets and numbered lists (though a bullet's wrapped
lines are flowed under its text, and `bullet-spacing` spaces its marker),
tables, fenced code, indented code, and `@example` blocks.
A one-line block stays on one line if it fits, and expands otherwise (turn
on `jsdoc-flow/single-line` to always expand it).

A block is skipped if its form isn't one the rule handles: text after `/**`
on a line of its own, a body line without a leading `*`, or text before the
closing `*/`. If reflowing a block would change more than its whitespace, the
rule reports it without a fix.

### Spacing: `sentence-spacing`, `colon-spacing`, `word-spacing`, `no-extra-punctuation-space`, `tag-spacing` and `bullet-spacing`

Six rules check the gaps between words, each one kind of gap:

- `jsdoc-flow/sentence-spacing`: two spaces follow a sentence-ending `.`,
  `!`, or `?` when more text follows on the same line. Note that `e.g.`,
  `i.e.`, and `etc.` don't end a sentence.
- `jsdoc-flow/colon-spacing`: two spaces follow a colon when more text
  follows on the same line.
- `jsdoc-flow/word-spacing`: one space separates any other two words.
- `jsdoc-flow/no-extra-punctuation-space`: no space comes before `,`, `.`,
  `;`, `:`, `)` or `]`, or after `(` or `[`, so `( see above ) ,` becomes
  `(see above),`. An ellipsis (`...`), a word such as `.js` or `:hover`, and
  an emoticon such as `:)` keep their spaces. A line break before or after
  that punctuation is left to `reflow`, which joins the two words.
- `jsdoc-flow/tag-spacing`: one space goes on either side of the `-` that
  ends a tag's head, so `@param name  -  the name` becomes
  `@param name - the name`, even after a name that ends in `.` or `:`.
  A `-` glued to a word (`name- the name`, `count -1 or more`) is part of
  that word, and a `-` later in the description is left to `word-spacing`.
  When a wide head ends its line with the `-`, only the space before it is
  checked.
- `jsdoc-flow/bullet-spacing`: one space follows a list item's marker (`-`,
  `*`, or a number and `.`), so `-   an item` becomes `- an item`. Only
  that gap is checked: the indentation before a nested item's marker is
  left as it is, and so is the rest of the item's line, which the other
  spacing rules skip (so the `.` of `1.` never counts as a sentence end).
  A marker with nothing after it doesn't start a list item.

They're independent: turn on any of them without the others, and each
reports and fixes only its own kind of gap. They check only how wide a gap
is, so a tab or a no-break space where one space belongs is left to
`no-exotic-whitespace`.

Why two spaces? Traditional typesetting set a wider space between sentences
than between words. Typewriters, limited to fixed-width characters, copied the
practice by typing two spaces, and the habit carries well into monospaced
text such as code comments. The wider gap also makes sentences easier to
scan, since each sentence start stands out from the words around it.

### Edges: `star-align`, `text-indent` and `no-trailing-space`

Three rules check the whitespace at the edges of each line:

- `jsdoc-flow/star-align`: each line's `*` is under the `*` of the `/**`.
- `jsdoc-flow/text-indent`: one space separates a line's `*` from its text.
  On a one-line block, one space separates the `/**` from the text.
- `jsdoc-flow/no-trailing-space`: no whitespace follows a line's text. On a
  one-line block, one space separates the text from the `*/`.

Like the spacing rules, they're independent: each fixes a different part of
a line, so turn on any of them without the others. Each line that's off is
reported on its own, highlighting the whitespace with the word beside it,
and fixed by changing only that whitespace. Like the spacing rules, they
check only how wide it is, except that `no-trailing-space` removes any
whitespace after a line's text, whatever it's made of:

```js
/**
 *  Saves the note.  
 */
```

```text
2:1   warning  This line's `*` should be under the `/**`               jsdoc-flow/star-align
2:4   warning  Remove extraneous whitespace at the start of this line  jsdoc-flow/text-indent
2:17  warning  Remove extraneous whitespace at the end of this line    jsdoc-flow/no-trailing-space
```

### `jsdoc-flow/no-exotic-whitespace`

Reports each run of whitespace in a block's text that has a character in it
other than a plain space: a tab, a no-break space (U+00A0), another of
Unicode's spaces (U+1680, U+2000 to U+200A, U+202F, U+205F, U+3000), or a
zero-width space (U+200B, or a byte order mark, U+FEFF). The fix makes each
of those characters one plain space, so it never changes how wide a gap is,
and the spacing and edge rules then fix any gap that's too wide. A
zero-width space inside a word splits the word in two, at the place it
marked as one where the word could break.

```js
// Before (→ is a tab, · a no-break space)
/**
 * Saves→the·note.
 */

// After `eslint --fix`
/**
 * Saves the note.
 */
```

A line is checked from just after its `*` (or a one-line block's `/**`)
through its text, including list items, tables and code spans. Left as they
are:

- the indentation before each line's `*`, so a file indented with tabs keeps
  them;
- the whitespace after a line's text, which `no-trailing-space` removes;
- fenced code, indented code and `@example` blocks, where a tab may belong;
- joiners such as U+200C, U+200D and U+2060, which aren't spaces.

ESLint's own `no-irregular-whitespace` reports some of these characters in
comments too, but doesn't fix them, and doesn't report tabs.

### `jsdoc-flow/tag-align`

Reports each tag continuation line that doesn't start at its tag's
description column, and fixes it by changing its indentation.

```js
// Before
/**
 * @param update - an extra DOM update to run inside the view transition,
 *   just before navigating
 */

// After
/**
 * @param update - an extra DOM update to run inside the view transition,
 *                 just before navigating
 */
```

### `jsdoc-flow/bullet-align`

Reports each wrapped line of a list item that doesn't start under the item's
text, one space after its marker, and fixes it by changing its indentation.
Nested items, numbered items such as `10.`, and items in a tag's description
each line up under their own text.

```js
// Before
/**
 * - `pinned`, whether the note is listed first, before the notes that
 * aren't pinned
 */

// After
/**
 * - `pinned`, whether the note is listed first, before the notes that
 *   aren't pinned
 */
```

As in Markdown, the lines right after a list item are its wrapped lines,
until a blank line, a tag, another list item, a table or code. So a
paragraph after a list needs a blank line before it. The item's own line is
left as it is, so its marker's column is the author's, and the text column is
measured as `bullet-spacing` would space the marker.

### `jsdoc-flow/single-line`

Reports each JSDoc block that's on a single line, and fixes it by spreading
it over three: the `/**`, the text, and the `*/`, each on a line of its own.
The text is kept as it is, except the whitespace around it, and a line that
ends up too wide is left to `reflow`.

```js
// Before
/** Saves the note. */

// After
/**
 * Saves the note.
 */
```

Why? A block's text is easier to scan when every block has the same shape:
its text always starts on the line after the `/**`, under a `*`, whether it's
one line long or ten. That includes tag-only blocks such as
`/** @type {Note} */`.

## API

The text engine is exported too, for use outside ESLint:

```js
import {
  reflowComment,
  fixSpacing,
  fixEdges,
  alignTags,
} from 'eslint-plugin-jsdoc-flow';

reflowComment('/** One. Two. */', ''); // '/** One.  Two. */'
fixSpacing('/** One. Two  three. */', ''); // '/** One.  Two three. */'
fixEdges('/**  One.   */', ''); // '/** One. */'
```

- `reflowComment(text, indent, width = 80, options = {})` returns the
  reflowed block, or `null` if its form isn't one it handles. `options` takes
  `orphans`, `names`, `shortWords`, `hang` and `widows`, as the `reflow` rule
  does.
- `fixSpacing(text, indent)` returns the block with the gaps between its
  words spaced.
- `fixEdges(text, indent)` returns the block with the whitespace at its
  lines' edges fixed.
- `alignTags(text, indent)` returns the block with its tag continuation lines
  aligned.

`text` is the block from its `/**` to its `*/`, and `indent` is the
whitespace before it on its line.

## License

MIT
