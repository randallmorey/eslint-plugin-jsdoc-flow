# eslint-plugin-jsdoc-flow

ESLint rules that flow the text of JSDoc comments, the way Prettier flows
code: consistent sentence spacing, line breaks that never strand a word,
tag descriptions that line up, and no single-line blocks. All rules
are autofixable, and they only change whitespace or line prefixes. Sentences and
colons get two spaces after them by default, as below, or
[one with a setting](#one-space-or-two).

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
comments aren't touched, and neither are the blocks you've
[asked them to leave alone](#leaving-a-block-alone).

## Leaving a block alone

Some blocks shouldn't be flowed at all, such as a license header or an ASCII
diagram. An ignore comment or a verbatim tag makes all fourteen rules skip a
whole block, so none of them reports it and `--fix` doesn't change it. They all
skip the same blocks, so `--fix` still settles on the same text whichever rule
fixes first.

### Ignore comment

Put `// jsdoc-flow-ignore` or `/* jsdoc-flow-ignore */` on the line right above
a block. Text may follow the marker, such as the reason for it:

```js
// jsdoc-flow-ignore: ASCII diagram
/**
 * client --> server
 *   ^          |
 *   +----------+
 */
```

It works like `prettier-ignore`. Only the next block is skipped, and a blank
line, code or another comment between the marker and the block breaks the link.
The comment has to be on one line, with nothing else on that line, so
`foo(); // jsdoc-flow-ignore` doesn't count, and neither does a longer name such
as `jsdoc-flow-ignored`. A `/** jsdoc-flow-ignore */` is a JSDoc block, not a
marker.

`// eslint-disable-next-line` can't do this, since the rules report on a block's
interior lines. ESLint then flags the directive as unused, and `--fix` removes
it.

### `verbatimTags`

A block with a line that begins with one of these tags is left entirely alone.
That includes any text above the tag and a one-line form such as
`/** @license MIT */`, since license and preserve comments often have the tag at
the top or the bottom with the text around it. Set them in ESLint's shared
settings, which every rule reads:

```js
// eslint.config.js
import jsdocFlow from 'eslint-plugin-jsdoc-flow';

export default [
  jsdocFlow.configs.recommended,
  {
    settings: {
      'jsdoc-flow': {
        verbatimTags: ['license', 'preserve', 'copyright', 'diagram'],
      },
    },
  },
];
```

- It defaults to `['license', 'preserve', 'copyright']`.
- A value replaces the default rather than adding to it, so the list above names
  the defaults again, and `[]` opts out.
- Names have no `@`, and match whole and case-sensitively, as `allowTags` does:
  `license` matches neither `@licenses` nor `@License`.
- A value that isn't an array of unique, valid names throws an error, since
  ESLint doesn't validate `settings`.

Only a real tag line counts, as the rules read one elsewhere. A tag name inside
a fence or other code, in a list item, or later on a line doesn't make a block
verbatim, so neither does the `@license` of `/** See @license. */`. Nor does
wording such as `Copyright (c) Example.` without a tag, so such a block needs an
ignore comment. `@example` isn't on the list by default, and its usual handling
keeps only its own lines as they are, but naming it makes its whole block
verbatim like any other tag.

## Unfenced code and diagrams

Authors often write code and diagrams in a comment without a fence. So the rules
guess at those lines and keep them as they are, a run at a time, unlike the rest
of the block, which they fix as usual. Every rule reads a block the same way, so
none of them reports a kept line, nothing flows into one, and `--fix` still
settles on the same text whichever rule fixes first:

```js
/**
 * Flow:
 *   A --> B
 *   |     |
 *   v     v
 *   C --> D
 *
 * - `function foo() {}`
 *    ^^^^^^^^^^^^
 */
```

A run of kept lines starts at any of these:

- A line indented at least two more than the paragraph line above it. So a
  paragraph's first line never starts a run, since no line is above it:
  ` *  Saves the note.` is fixed as usual, and so are the lines of a paragraph
  indented alike. Neither does a line one space further in than the line above.
- A pointer line, which is only runs of `^` and `~` with whitespace between
  them, right under a line that isn't blank. Three or more `~` at its start open
  a fence, as in Markdown, and `^^^ insert` is an ordinary line, unless it's
  indented as above.
- A line after a short label, which is a line ending in `:` with at most 24
  characters other than whitespace, such as `Examples:`. It's enough for the
  line to be indented past the label at all. Otherwise, the lines from there to
  the end of the paragraph have to be line-oriented: two or more, each with at
  most 50 characters other than whitespace, and none ending in `.`, `!` or `?`.
  The label has to start its paragraph for those. So ordinary prose after a
  colon is still flowed, whether it's one line, a sentence or a full line wide.

A run ends at the first of these, and what ends it is read as usual:

- a blank line, so a diagram with blank lines in it is several runs, and each
  has to start as above. The line after a blank line has no line above it, so
  it's kept only if four spaces make it indented code;
- a tag line;
- a fence or verbatim HTML (`<pre>`, `<script>`, `<style>`, `<textarea>` or
  `<!--`), which is kept as that;
- a line no more indented than the paragraph line above the run, which starts a
  new paragraph. After a pointer line that started the run, it's a line less
  indented than the pointer, or a line that isn't indented at all. An indented
  list item, table row or the like stays in the run, as the `|` of the diagram
  above does, but one that isn't indented ends it;
- for line-oriented lines, the end of their paragraph.

A label that's the last line of a paragraph, right above a run, stays on a line
of its own, rather than joining the text above it. The label itself isn't kept,
so its spacing is still fixed.

A tag's continuation lines and a list item's wrapped lines are lines these rules
set the indentation of, so only a pointer line starts a run among them. That
includes the two-space form of a wide tag head's description, so `tag-align` and
`bullet-align` work as usual, and `reflow`'s output reads the same the next
time.

### `preformatted`

The guard is on by default. Turn it off in ESLint's shared settings, which every
rule reads, and those lines are flowed like any others:

```js
// eslint.config.js
import jsdocFlow from 'eslint-plugin-jsdoc-flow';

export default [
  jsdocFlow.configs.recommended,
  {
    settings: {
      'jsdoc-flow': {
        preformatted: false,
      },
    },
  },
];
```

A value that isn't a boolean throws an error, since ESLint doesn't validate
`settings`.

### Known limits

The guard goes by how lines are laid out, not by what they say, so it gets some
blocks wrong both ways.

It can miss code, which then flows as usual. Put that code in a fence, or use an
[ignore comment](#ignore-comment). It misses:

- code that isn't indented and has no label above it, or only one line of it, as
  in `Examples:` and then `const { a } = foo;`;
- code after a label and a blank line, or after a line that doesn't end in a
  colon, such as `e.g.`, unless it's indented;
- an indented line right after a blank line, with fewer than four spaces;
- indented code in a tag's description or among a list item's wrapped lines;
- short lines after a label that end in `.`, `!` or `?`.

A pointer line stays put, but the line it points at isn't kept unless it's in a
run itself, so spacing or flowing that line can still leave the pointer pointing
at the wrong column.

It can also stop some prose from flowing, and leave its spacing and indentation
as they are. To flow it again, remove the indentation:

- prose that hangs its later lines, as in `Returns the names` over
  `  that should be included`;
- short lines of prose after a label, with no sentence end among them;
- a line after a label that's indented by accident.

## One space or two

By default, two spaces follow a sentence end or a colon when more text follows
on the same line. To have one instead, set `spaces` in ESLint's shared settings,
which every rule reads:

```js
// eslint.config.js
import jsdocFlow from 'eslint-plugin-jsdoc-flow';

export default [
  jsdocFlow.configs.recommended,
  {
    settings: {
      'jsdoc-flow': {
        spaces: 1,
      },
    },
  },
];
```

```js
// With `spaces: 2`, or with it unset
/**
 * Saves the note.  It throws if:  the store is read-only.
 */

// With `spaces: 1`
/**
 * Saves the note. It throws if: the store is read-only.
 */
```

- It's `1` or `2`, and defaults to `2`. Any other value throws an error, since
  ESLint doesn't validate `settings`.
- `sentence-spacing` and `colon-spacing` report and fix toward it, and `reflow`
  writes it whenever it rewrites a paragraph. `tag-align` counts it too, since a
  gap in a tag's head moves the column of its description.
- It's a setting rather than a rule's option because these rules have to agree
  on every gap, or `--fix` would never settle.
- A line holds more with one space, so `reflow` may break lines elsewhere than
  it does with two. Either way, `--fix` settles on the same text whichever rule
  fixes first.

With one space, a gap's width no longer means anything. With two, two spaces
after an abbreviation show that a sentence ended there, as in `Elm St.  Then`.
That can't work with one, since the fix would erase the evidence. So whether a
gap follows a sentence end depends only on the words beside it. `Elm St.  Then`
isn't a sentence end then, and `word-spacing` narrows its gap, not
`sentence-spacing`. The same goes for `He met Paul.  St. Paul` and for two spaces
after an abbreviation before a lowercase word, such as `e.g.  this`.

So `In the U.S.  Then` and `no.  5` are `word-spacing`'s too, while
`Foo Inc.  Then` is `sentence-spacing`'s, since the capitalized word makes it a
sentence end either way.

A two-space gap after a sentence end or a colon is still `sentence-spacing`'s or
`colon-spacing`'s, so with those two off it stays, and `word-spacing` doesn't
report it, unless `reflow` rewrites its paragraph for some other reason.

The lines the rules keep as they are keep their gaps too, whichever you choose.
That includes a list item's own line, though not its wrapped lines, as well as
code and the [other lines left as they are](#jsdoc-flowreflow).

## Rules

| Rule                                    | Description                                            | Fixable |
| --------------------------------------- | ------------------------------------------------------ | ------- |
| `jsdoc-flow/reflow`                     | Flow JSDoc text with consistent line breaks            | ✓       |
| `jsdoc-flow/sentence-spacing`           | Two spaces, or `spaces`, after a sentence end          | ✓       |
| `jsdoc-flow/colon-spacing`              | Two spaces, or `spaces`, after a colon                 | ✓       |
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

- A word never moves to the start of a line where it would read as a tag or
  a Markdown block. That goes for a word starting with `@`, `*`, `|`, `>`,
  ` ``` `, `~~~`, `<!--`, an HTML block's tag such as `<pre>` or `</div>`, or a
  link reference's `[ref]:`, and for a word that's only up to six `#`, a list
  marker (`-`, `+`, or a number and `.` or `)`), a run of `=` or `_`, the `^`
  and `~` of a pointer line, or the `-`, `:` and `|` of a thematic break, an
  underline or a table's delimiter row, such as `---` or `--|--`. A description
  that starts with one of these stays on its tag's line, however wide the tag's
  head. The lines of a multi-line `{Type}` stay as they are, so a union's `|` may
  start one there.
- A word that would read as a thematic break, an underline, a link reference
  definition or a pointer line if a paragraph's first line ended there, as `---`
  would in `--- then more`, stays with the word after it.
- A word that ends in a hard break (`<br>` or a backslash) and isn't at the end
  of its line stays with the word after it, so wrapping never adds a hard break.
- Code spans, Markdown links, `{@link ...}`, `{Type}` and `[optional]` names
  never break, and the whitespace inside them is kept as it is (though
  `no-exotic-whitespace` still makes it plain spaces). A `{Type}` may nest
  braces to any depth.
- A line never breaks before `,`, `.`, `;`, `:`, `)` or `]`, or after `(` or
  `[`, and no space is put there either (see `no-extra-punctuation-space`).
- An abbreviation that two spaces make a sentence end (`Elm St.  Then`) stays
  with the next word, since a line break there would lose the two spaces. With
  [`spaces: 1`](#one-space-or-two), two spaces don't make one.

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

A `{Type}` right after a tag's name that spans several lines keeps its line
breaks. Its lines stay as they are through its closing brace, and the spacing
and edge rules leave them alone too. The name and description after that brace
are flowed as usual, with the head measured from the start of that line:

```js
/**
 * @param {{
 *   id: string,
 *   title?: string
 * }} note - the note to save, which is flowed and aligned as a description
 *           after any other head
 */
```

The `{` has to close before the next tag, or it's flowed as ordinary text, and
a `{@link ...}` isn't a type.

**Left as they are:** line breaks carry meaning in Markdown, so these keep
their lines, and nothing flows into them:

- bullets and numbered lists, with `-`, `*`, `+`, `1.` or `1)` as a marker
  (though a bullet's wrapped lines are flowed under its text, and
  `bullet-spacing` spaces its marker), a marker alone on its line, and a number
  with a space before its `.` or `)`, as in `1 ) one`;
- ATX headings, up to six `#` and then a space or nothing, so `#foo` isn't one;
- setext headings and thematic breaks: a line of `=` or of two or more `-`, the
  line above it, even a tag's, and `***`, `___` or a spaced `- - -`;
- blockquotes: every line starting with `>`, which Markdown doesn't require a
  space after, so each quoted line stays verbatim, and an unmarked line after
  one is flowed as a paragraph of its own;
- tables, whether or not they have edge pipes. A delimiter row such as
  `---|---` and the line above it are kept. Without a `|` at the start of the
  delimiter row, the lines below it are kept until a blank line or a tag;
- link reference definitions: `[ref]: url`, or `[ref] : url`, and perhaps a
  title, alone on a line. `[ref]: more than one word` is ordinary text;
- fenced code, opened by ` ``` ` or `~~~`. A `~~~` fence closes only on a `~~~`
  at least as long, alone on its line. Either kind runs to the end of the block
  if nothing closes it, across blank lines and tags;
- HTML blocks. `<pre>`, `<script>`, `<style>`, `<textarea>` and an `<!--` comment
  run through the line that closes them, across blank lines and tags, like a
  fence. If nothing closes them, they end at the next blank line or tag, so a
  stray `<pre>` can't freeze the rest of the block. Other block-level elements,
  such as `<div>`, `<table>`, `<ul>` or `<p>`, and any closing tag of these, run
  to the next blank line or tag, as in Markdown. Inline elements and tags with
  other names, such as `<code>` or `<T>`, are ordinary text;
- indented code, `@example` blocks, and multi-line `{Type}`s;
- what looks like [unfenced code or a diagram](#unfenced-code-and-diagrams), a
  guess you can turn off.

These apply in a tag's description too. A tag line ends each of them except a
fence and closed verbatim HTML, and the text after them starts a new paragraph,
so it no longer lines up as the tag's description.

Conservatism wins here, so prose that looks like a construct at the start of a
line, such as `> 5 is required` or `+ 1 more`, isn't flowed.

A hard break stays too. A paragraph's line that ends in `<br>`, `<br/>` or a
backslash keeps its break there, and the text on either side of it is flowed on
its own, with a tag's or a list item's hanging indent. Two spaces at the end of
a line aren't kept as a hard break, since `no-trailing-space` removes them.

A one-line block stays on one line if it fits, unless it's one of the
constructs above, and expands otherwise (turn on `jsdoc-flow/single-line` to
expand it even when it fits). A one-line `@ts-*` directive stays on one line
however wide it is, since it stops working when it's expanded.

A block is skipped if its form isn't one the rule handles: text after `/**`
on a line of its own, a body line without a leading `*`, or text before the
closing `*/`. If reflowing a block would change more than its whitespace, the
rule reports it without a fix.

### Spacing: `sentence-spacing`, `colon-spacing`, `word-spacing`, `no-extra-punctuation-space`, `tag-spacing` and `bullet-spacing`

Six rules check the gaps between words, each one kind of gap:

- `jsdoc-flow/sentence-spacing`: two spaces, or one with
  [`spaces: 1`](#one-space-or-two), follow a sentence-ending `.`, `!`, or `?`
  when more text follows on the same line. Not every period ends a sentence:
  see [what ends a sentence](#what-ends-a-sentence).
- `jsdoc-flow/colon-spacing`: two spaces, or one with `spaces: 1`, follow a
  colon when more text follows on the same line, including one inside closing
  emphasis or quotes, as in `**Note:** Then`.
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
  `*`, `+`, or a number and `.` or `)`), so `-   an item` becomes `- an item`.
  Only that gap is checked: the indentation before a nested item's marker is
  left as it is, and so is the rest of the item's line, which the other
  spacing rules skip (so the `.` of `1.` never counts as a sentence end).
  A marker with nothing after it doesn't start a list item.

They're independent: turn on any of them without the others, and each
reports and fixes only its own kind of gap. They check only how wide a gap
is, so a tab or a no-break space where one space belongs is left to
`no-exotic-whitespace`.

#### What ends a sentence

A word ending in `.`, `!` or `?` ends a sentence. Closing brackets, quotes
(straight or curly) and emphasis after that don't change it, so `"Done." Then`,
`“Done.” Then`, `(Done.) Then`, `**Note.** Then`, `*Done.* Then` and
`_Done._ Then` all get two spaces, and so does the colon of `**Note:** Then`.

Emphasis is read from the word alone, since `*` and `_` also appear in text that
has nothing to do with emphasis. A `*` or `_` closes emphasis only if the word
opens with the same marks (`*Done.*`), so `.eslintrc.* files`, `s3:* on`,
`foo._ Bar`, `foo_ Bar` and `2 * 3` keep one space. Only `**` may close what an
earlier word opened (`**Note this well.** Then`). A single `*` or `_` can't be
told from those others, so `_Only in browsers._ Then` keeps one space.

A period may also end an abbreviation. What a sentence does after one depends on
the abbreviation. Matching ignores case, except for dotted initialisms.

- `e.g.`, `i.e.`, `etc.`, `et al.`, `a.k.a.`, `w.r.t.`, `esp.`, `incl.`,
  `approx.`, `fig.`, `eq.`, `sec.`, `ch.`, `vol.`, `pp.`, `a.m.`, `p.m.`, `a.d.`,
  `b.c.`, `a.c.e.` and `b.c.e.` end a sentence only before a capitalized word
  (`etc. Then`). They don't before anything else, as in `approx. 5`.
- `Inc.`, `Ltd.`, `Corp.`, `Co.`, `Jr.` and `Sr.` work the same way, so
  `Foo Inc. in 2020` and `Foo Jr. said` keep one space, and `Foo Inc. Then` gets
  two. They close the name before them, so a capitalized word after one more
  likely starts a sentence. `Foo Inc. Board` gets two spaces as well, which is
  the cost of that.
- `no.` and `nos.` are words too, so they stay inside a sentence only before a
  number, as in `no. 5` or `Nos. 5-6`. `The answer is no. Then` ends one, and so
  does `no. then`.
- `St.` and dotted initialisms, which are two or more capitals each with a period
  (`U.S.`, `U.K.`, `U.N.`), stay inside a sentence before anything, as in
  `St. Paul` and `The U.S. Government`, since the capitalized word may go on with
  a name.
- `Dr.`, `Mr.`, `Mrs.`, `Ms.`, `Prof.`, `vs.` and `cf.` always stay inside a
  sentence, however many spaces follow them.

Except for that last group, two spaces after an abbreviation mark a sentence end
that the words can't show, and they're kept, as in `Elm St.  Then`,
`In the U.S.  Then we left` and `no.  5`. With one space, `The U.S. Government`
and `In the U.S. Then we left` look the same, so neither is widened. Two spaces
can't count with [`spaces: 1`](#one-space-or-two), where the words alone decide.

Because two spaces always count, a gap that an earlier version of these rules
widened, such as `Foo Inc.  in 2020` or `The U.S.  Government`, stays wide until
you narrow it by hand.

Why two spaces by default? Traditional typesetting set a wider space between
sentences than between words. Typewriters, limited to fixed-width characters,
copied the practice by typing two spaces, and the habit carries well into
monospaced text such as code comments. The wider gap also makes sentences easier
to scan, since each sentence start stands out from the words around it. Many
teams use one space all the same, which is what
[`spaces: 1`](#one-space-or-two) is for.

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
through its text, including list items, tables, code spans and multi-line
`{Type}`s. Left as they are:

- the indentation before each line's `*`, so a file indented with tabs keeps
  them;
- the whitespace after a line's text, which `no-trailing-space` removes;
- fenced code, HTML blocks, indented code, `@example` blocks and what looks like
  [unfenced code](#unfenced-code-and-diagrams), where a tab may belong;
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
Nested items, numbered items such as `10.` or `10)`, and items in a tag's
description each line up under their own text.

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
until a blank line, a tag, another list item, a table, code or another line
that's left as it is. So a paragraph after a list needs a blank line before it.
The item's own line is
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
one line long or ten.

A one-line `@ts-*` directive, such as `/** @ts-expect-error reason */`, is
always left on one line, whatever the options say. TypeScript reads
`@ts-expect-error` and `@ts-ignore` only from a block's last line, so spreading
one out would bring back the error it suppresses. The rule doesn't collapse
a directive that's already on lines of its own, where TypeScript ignores it.

**Options:**

- `allowTags`: an array of tag names, without the `@`, whose one-line blocks
  are left on one line. Defaults to `[]`.

```js
'jsdoc-flow/single-line': ['warn', { allowTags: ['type', 'typedef', 'deprecated'] }],
```

A block is exempt only if it begins with an allowed tag, so with these options
`/** Saves the note. */` and `/** Saves the note. @deprecated */` are still
spread out. A second tag on the line is read as the first tag's text, so only
the first tag counts: `/** @type {Note} @since 2 */` is exempt, and
`/** @since 2 @type {Note} */` isn't.

The other rules still fix an exempt block's whitespace, on its one line, but
`allowTags` turns off only this rule. `reflow` still expands a one-line block
that doesn't fit, or that it keeps as it is, such as `@example` or a heading,
and an expanded block stays expanded. A `@ts-*` directive is the only block
`reflow` keeps on one line however wide it is. To have every rule leave a block
alone, use [`verbatimTags`](#verbatimtags) instead.

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
  does, and `preformatted` and `spaces`.
- `fixSpacing(text, indent, options = {})` returns the block with the gaps
  between its words spaced.
- `fixEdges(text, indent, options = {})` returns the block with the whitespace
  at its lines' edges fixed.
- `alignTags(text, indent, options = {})` returns the block with its tag
  continuation lines aligned.

`text` is the block from its `/**` to its `*/`, and `indent` is the
whitespace before it on its line. `options` takes `preformatted`, which is `true`
unless it's set, and `spaces`, which is `2` unless it's set, as the settings of
those names do, so `fixSpacing('/** One.  Two. */', '', { spaces: 1 })` returns
`'/** One. Two. */'`. `fixEdges` spaces no such gap, so `spaces` makes no
difference to it. Unlike the settings, these options aren't validated.

These functions format whatever block they're given. They don't read ESLint's
settings, so `verbatimTags` and the ignore comment apply only to the rules, and
a caller that wants a block kept as it is shouldn't pass it to them. The guard on
[unfenced code](#unfenced-code-and-diagrams) is on unless `preformatted` is
`false`, and two spaces follow a sentence end or a colon unless `spaces` is `1`,
whatever the settings say.

## License

MIT
