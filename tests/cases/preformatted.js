// The cases of the guard that keeps unfenced code and diagrams as they are,
// which the tests of all the rules together check.  A case without an `output`
// is left as it is by every rule, and one with an `output` shows what `--fix`
// with all of them makes of it.  Its `flowed` is what it makes of the block
// with the guard off, if the case keeps something the guard is there to keep.
import { block } from '../helpers.js';

const signals = [
  {
    name: 'a line indented two more than the paragraph line above it',
    code: block('Some text,', '  kept   as  it is.  ', 'Back.'),
    flowed: block('Some text, kept as it is.  Back.'),
  },
  {
    name: 'a line indented four more than the paragraph line above it',
    code: block('Some text,', '    indented, but not a tag.'),
    flowed: block('Some text, indented, but not a tag.'),
  },
  {
    name: 'a line indented two more than an indented line above it',
    code: block(' Some text,', '   kept   as  it is.'),
    output: block('Some text,', '   kept   as  it is.'),
    flowed: block('Some text, kept as it is.'),
  },
  {
    name: 'a line indented one more than the paragraph line above it',
    code: block('Some text,', ' flowed.'),
    output: block('Some text, flowed.'),
  },
  {
    name: 'a line indented one more than an indented line above it',
    code: block(' Some text,', '  flowed.'),
    output: block('Some text, flowed.'),
  },
  {
    name: 'a pointer line of `^`',
    code: block('foo(bar)', '^^^', 'More.'),
    flowed: block('foo(bar) ^^^ More.'),
  },
  {
    name: 'a pointer line of `~`, with runs',
    code: block('foo(bar)', '~~ ~', 'More.'),
    flowed: block('foo(bar) ~~ ~ More.'),
  },
  {
    name: 'a pointer line of runs of both',
    code: block('foo(bar)', '^~~ ^^', 'More.'),
    flowed: block('foo(bar) ^~~ ^^ More.'),
  },
  {
    name: 'an indented pointer line, spaced as it was',
    code: block('foo(bar)', ' ^^^   ^^^  '),
    flowed: block('foo(bar) ^^^ ^^^'),
  },
  {
    name: 'a pointer line under a list item',
    code: block('- `foo`', ' ^^^^', '- `bar`', ' ^^^^'),
    flowed: block('- `foo`', '  ^^^^', '- `bar`', '  ^^^^'),
  },
  {
    name: "a pointer line among a list item's wrapped lines",
    code: block('- `foo`', '  and `bar`', '       ^^^^^'),
    flowed: block('- `foo`', '  and `bar` ^^^^^'),
  },
  {
    name: "a pointer line in a tag's description",
    code: block('@param name - a `foo`', '                ^^^^^'),
    flowed: block('@param name - a `foo` ^^^^^'),
  },
  {
    name: 'a pointer line ends a paragraph, and a blank line its run',
    code: block('foo', '^^^', '', 'Text  here.'),
    output: block('foo', '^^^', '', 'Text here.'),
  },
  {
    name: 'a pointer with text after it is an ordinary line',
    code: block('foo', '^^^ points at foo.'),
    output: block('foo ^^^ points at foo.'),
  },
  {
    name: 'a word in a line that starts with `^` or `~` is ordinary text',
    code: block('The operator', '^ is xor, and', '~ is not.'),
    output: block('The operator ^ is xor, and ~ is not.'),
  },
  {
    name: 'a pointer line with nothing above it points at nothing',
    code: block('^^^', 'More.', '', '^^^', 'Most.'),
    output: block('^^^ More.', '', '^^^ Most.'),
  },
  {
    name: 'three `~` open a fence, not a pointer line',
    code: block('foo', '~~~', 'a  b', '~~~', 'Text  here.'),
    output: block('foo', '~~~', 'a  b', '~~~', 'Text here.'),
  },
  {
    name: 'one space past a label is indented',
    code: block('Example:', ' foo(  bar  );', ' baz(   );'),
    flowed: block('Example:  foo(bar); baz();'),
  },
  {
    name: 'a label with a space before its colon',
    code: block('Example :', ' foo(  bar  );'),
    output: block('Example:', ' foo(  bar  );'),
    flowed: block('Example:  foo(bar);'),
  },
  {
    name: 'one space past a line that is not a label is not',
    code: block('Some text,', ' flowed.', 'As usual.'),
    output: block('Some text, flowed.  As usual.'),
  },
  {
    name: 'lines after a label, each too short to be wrapped prose',
    code: block('Examples:', 'x -> x', 'x() -> x', 'x.y  ->  x.y'),
    flowed: block('Examples:  x -> x x() -> x x.y -> x.y'),
  },
  {
    name: 'line-oriented lines end at the end of their paragraph',
    code: block('Examples:', 'x -> x', 'y -> y', '', 'Text  here.'),
    output: block('Examples:', 'x -> x', 'y -> y', '', 'Text here.'),
  },
  {
    name: 'line-oriented lines end at a line kept for another reason',
    code: block('Examples:', 'x -> x', 'y -> y', '-  an item', '   wrapped'),
    output: block('Examples:', 'x -> x', 'y -> y', '- an item', '  wrapped'),
  },
  {
    name: 'one line after a label is prose',
    code: block('Note:', 'the store is read-only'),
    output: block('Note:  the store is read-only'),
  },
  {
    name: 'prose after a label, whose last line ends a sentence',
    code: block('Note:', 'the store is read-only,', 'so a save throws.'),
    output: block('Note:  the store is read-only, so a save throws.'),
  },
  {
    name: 'prose after a label, wrapped too wide to be line-oriented',
    code: block(
      'Note:',
      'the store is read-only when the note was opened from a snapshot',
      'and a save throws there',
    ),
    output: block(
      'Note:  the store is read-only when the note was opened from a snapshot and',
      'a save throws there',
    ),
  },
  {
    name: 'a line ending in a colon too long to be a label',
    code: block(
      'The ways that a note can be saved to it:',
      'first the title',
      'then the body',
    ),
    output: block(
      'The ways that a note can be saved to it:  first the title then the body',
    ),
  },
  {
    name: 'a label that does not start its paragraph has no line-oriented lines',
    code: block('Some text.', 'Examples:', 'x -> x', 'y -> y'),
    output: block('Some text.  Examples:  x -> x y -> y'),
  },
];

const runs = [
  {
    name: 'a blank line ends a run',
    code: block('Flow:', '  a -> b', '', '  Text  here.'),
    output: block('Flow:', '  a -> b', '', 'Text here.'),
  },
  {
    name: 'a tag ends a run, and starts a tag as usual',
    code: block('Flow:', '  a -> b', '@param a - b,', 'c'),
    output: block('Flow:', '  a -> b', '@param a - b, c'),
  },
  {
    name: 'an indented tag ends a run too',
    code: block('Flow:', '  a -> b', '  @returns  c'),
    output: block('Flow:', '  a -> b', '@returns c'),
  },
  {
    name: "a line back at the paragraph's indent ends a run",
    code: block(
      'Flow:',
      '  a -> b',
      'and more text that goes on for a while.',
      'And  on.',
    ),
    output: block(
      'Flow:',
      '  a -> b',
      'and more text that goes on for a while.  And on.',
    ),
  },
  {
    name: "a line left of the paragraph's indent ends a run",
    code: block(
      '  Some text,',
      '    a -> b',
      ' and more text that goes on for a while.',
    ),
    output: block(
      'Some text,',
      '    a -> b',
      'and more text that goes on for a while.',
    ),
  },
  {
    name: "an indented paragraph's lines at its indent end a run",
    code: block(
      '  Some text,',
      '  more text,',
      '    a -> b',
      '  and more text that goes on for a while.',
    ),
    output: block(
      'Some text, more text,',
      '    a -> b',
      'and more text that goes on for a while.',
    ),
  },
  {
    name: "any line past the paragraph's indent stays in the run",
    code: block('Some text,', '    a  ->  b', ' c  ->  d', '  e  ->  f'),
  },
  {
    name: 'a fence ends a run, so its lines are kept as a fence',
    code: block('Flow:', '  a -> b', '```', 'c  d', '', 'e  f', '```'),
  },
  {
    name: 'verbatim HTML ends a run',
    code: block('Flow:', '  a -> b', '  <pre>', 'c  d', '', '</pre>'),
  },
  {
    name: 'a list item back at the indent ends a run',
    code: block('Flow:', '  a -> b', '-  an item', '   wrapped'),
    output: block('Flow:', '  a -> b', '- an item', '  wrapped'),
  },
  {
    name: 'a list item past the indent stays in the run',
    code: block('Flow:', '  a -> b', '  -   c', '      d'),
  },
  {
    name: "a list item at an indented paragraph's indent stays in the run",
    code: block('  Some text,', '      a -> b', '  -   an item', '  wrapped'),
    output: block('Some text,', '      a -> b', '  -   an item', 'wrapped'),
  },
  {
    name: 'a list item right after a paragraph starts no run',
    code: block('Options:', '  -  a', '     wrapped'),
    output: block('Options:', '  - a', '    wrapped'),
  },
  {
    name: 'a run starts afresh in the paragraph after one',
    code: block('Flow:', '  a -> b', 'Then', '  c -> d', 'End  of it.'),
    output: block('Flow:', '  a -> b', 'Then', '  c -> d', 'End of it.'),
  },
  {
    name: 'a line after a pointer line stays in its run if as far in',
    code: block('foo', ' ^^^', ' a  b', '  c  d', 'Text  here.'),
    output: block('foo', ' ^^^', ' a  b', '  c  d', 'Text here.'),
  },
  {
    name: 'a line left of a pointer line ends its run',
    code: block('foo', '   ^^^', '  Text  here.'),
    output: block('foo', '   ^^^', 'Text here.'),
  },
  {
    name: "a label in a paragraph's middle stays on its line above a run",
    code: block(
      'Finds a word in some text that goes on until the line is full.',
      'Examples:',
      '  find("a")',
      'Done  here.',
    ),
    output: block(
      'Finds a word in some text that goes on until the line is full.',
      'Examples:',
      '  find("a")',
      'Done here.',
    ),
  },
];

const examples = [
  {
    name: 'code after a label in the middle of a paragraph',
    code: [
      '/**',
      ' * Gets flags of a regular expression created by the given `RegExp()` or',
      ' * `new RegExp()` call.',
      ' * Examples:',
      ' *     new RegExp(".")         // => ""',
      ' *     new RegExp(".", "gu")   // => "gu"',
      ' *     new RegExp(".", flags)  // => null',
      ' * @param {ASTNode} node `CallExpression` or `NewExpression` node',
      ' */',
      'export const x = 1;',
      '',
    ].join('\n'),
    flowed: [
      '/**',
      ' * Gets flags of a regular expression created by the given `RegExp()` or',
      ' * `new RegExp()` call.  Examples:  new RegExp(".")  // => "" new',
      ' * RegExp(".", "gu") // => "gu" new RegExp(".", flags) // => null',
      ' * @param {ASTNode} node `CallExpression` or `NewExpression` node',
      ' */',
      'export const x = 1;',
      '',
    ].join('\n'),
  },
  {
    name: 'carets under a list item, which stay where they point',
    code: [
      '/**',
      ' * Gets the location of the given function node for reporting.',
      ' *',
      ' * - `function foo() {}`',
      ' *    ^^^^^^^^^^^^',
      ' * - `(function foo() {})`',
      ' *     ^^^^^^^^^^^^',
      ' */',
      'export const x = 1;',
      '',
    ].join('\n'),
    flowed: [
      '/**',
      ' * Gets the location of the given function node for reporting.',
      ' *',
      ' * - `function foo() {}`',
      ' *   ^^^^^^^^^^^^',
      ' * - `(function foo() {})`',
      ' *   ^^^^^^^^^^^^',
      ' */',
      'export const x = 1;',
      '',
    ].join('\n'),
  },
  {
    name: 'an unfenced diagram',
    code: block('Flow:', '  A --> B', '  |     |', '  v     v', '  C --> D'),
    flowed: block('Flow:  A --> B', '  |     |', 'v v C --> D'),
  },
  {
    name: 'a diagram with `|` of its own, which would read as a table row',
    code: block('- an item', '', 'Then:', '  +---+', '  | a |', '  +---+'),
  },
];

const notTriggered = [
  {
    name: "the README's opening example",
    code: [
      '/**',
      ' *  Saves the note. Its title and body are written at once, so',
      ' * a reader never sees',
      ' * one without the  other. Returns a promise.',
      ' *',
      ' * It throws if :',
      ' * -  the note has no ID, which a new note gets only once it has been',
      ' * added to a notebook',
      ' * - the store is read-only',
      ' *',
      ' * @param {Note} note -  the note to save',
      ' * @param {SaveOptions} [options] - how long to wait: in milliseconds, or',
      " *   forever if it's unset",
      ' * @returns {Promise<void>} resolves once both are written',
      ' */',
      'export const x = 1;',
      '',
    ].join('\n'),
    output: [
      '/**',
      ' * Saves the note.  Its title and body are written at once, so a reader never',
      ' * sees one without the other.  Returns a promise.',
      ' *',
      ' * It throws if:',
      ' * - the note has no ID, which a new note gets only once it has been',
      ' *   added to a notebook',
      ' * - the store is read-only',
      ' *',
      ' * @param {Note} note - the note to save',
      ' * @param {SaveOptions} [options] - how long to wait:  in milliseconds,',
      " *                                  or forever if it's unset",
      ' * @returns {Promise<void>} resolves once both are written',
      ' */',
      'export const x = 1;',
      '',
    ].join('\n'),
  },
  {
    name: "a block's indented first line has no paragraph above it",
    code: block('  Saves the note.', 'Then more.'),
    output: block('Saves the note.  Then more.'),
  },
  {
    name: "a paragraph's indented first line has no paragraph above it",
    code: block('Some text.', '', '  Saves the note.', 'Then more.'),
    output: block('Some text.', '', 'Saves the note.  Then more.'),
  },
  {
    name: "a paragraph's lines indented alike",
    code: block('  Saves the note.', '  Then more.', '  And more.'),
    output: block('Saves the note.  Then more.  And more.'),
  },
  {
    name: 'a line indented less than the line above it',
    code: block('    Saves the note.', '  Then more.', 'And more.'),
    output: block('    Saves the note.', 'Then more.  And more.'),
  },
  {
    name: "a tag's two-space continuation line",
    code: block('@param name - the name,', '  which is flowed'),
    output: block('@param name - the name, which is flowed'),
  },
  {
    name: "a tag's continuation lines, indented deeper and deeper",
    code: block('@returns one of:', '  foo', '    bar', '      baz'),
    output: block('@returns one of:  foo bar baz'),
  },
  {
    name: "a tag's description after a head that ends in a colon",
    code: block('@see', '  a', '  b'),
    output: block('@see a b'),
  },
  {
    name: "a wide tag head's two-space hanging form",
    code: block(
      '@param {{ id: string, title: string, body: string }[]} notes -',
      '  the notes to save, in the order they should be listed in a',
      '  folder of notes',
    ),
    output: block(
      '@param {{ id: string, title: string, body: string }[]} notes -',
      '  the notes to save, in the order they should be listed in',
      '  a folder of notes',
    ),
  },
  {
    name: "a tag's line under a multi-line `{Type}`",
    code: block('@param {{', '  a: string', '}} note - the note,', '  flowed'),
    output: block('@param {{', '  a: string', '}} note - the note, flowed'),
  },
  {
    name: "a list item's wrapped lines, indented deeper and deeper",
    code: block('- an item', '    wrapped', '      and more'),
    output: block('- an item', '  wrapped and more'),
  },
  {
    name: "a nested list item's wrapped line",
    code: block('- an item', '  - nested', '      wrapped'),
    output: block('- an item', '  - nested', '    wrapped'),
  },
];

export const preformattedCases = [
  ...signals,
  ...runs,
  ...examples,
  ...notTriggered,
];

// The same blocks with the guard off, which all flow, as each case's `flowed`
// shows.
export const unguardedCases = preformattedCases
  .filter((c) => c.flowed)
  .map(({ name, code, flowed }) => ({
    name: `with the guard off:  ${name}`,
    code,
    output: flowed,
    settings: { 'jsdoc-flow': { preformatted: false } },
  }));

// Blocks that, between them, every rule but `single-line` and `tag-spacing`
// reports with the guard off.  Every line of a block but its first and its last
// is a line the guard keeps.  `single-line` looks at no line of a block, and
// `tag-spacing` only at a tag's own line, which the guard never keeps.
export const messyGuarded = [
  block(
    'Example:',
    '  one. Two: a  b ( c ) , d.   ',
    '  next   line',
    '\tkept\tline',
    'Text.',
  ),
  '/**\n * Example:\n *   a\n   *   b\n */\nexport const a = 1;\n',
  '/**\n * Example:\n *   a\n *    -   b\n *        c\n */\nexport const b = 1;\n',
  '/**\n * @param a - a\n *  ^^^\n *  b\n */\nexport const c = 1;\n',
  '/**\n * - a\n *  ^^^\n *  b\n */\nexport const d = 1;\n',
];
