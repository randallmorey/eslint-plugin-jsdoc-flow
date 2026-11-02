// The Markdown block cases of `jsdoc-flow/reflow`, shared by its own tests and
// the tests of all the rules together.  Line breaks carry meaning in Markdown,
// so these constructs are kept as they are, and a wrap never creates one.
import { block } from '../helpers.js';

// A narrow width keeps the inputs short:  ` * ` leaves 37 columns of text.
const narrow = [{ width: 42 }];

const join = [{ messageId: 'join' }];

const breaks = [{ messageId: 'break' }];

// Blocks that every rule leaves as they are.
export const blockValid = [
  {
    name: 'an ATX heading of any level, with text right after it',
    code: block(
      '# Title',
      'Intro text.',
      '',
      '###### Six',
      'More text.',
      '#',
      'Text after an empty heading.',
    ),
  },
  {
    name: "a heading's line isn't spaced or wrapped",
    code: block(
      '#  Title  with: gaps',
      '## A heading that is much too wide for this line, which it keeps however wide',
    ),
  },
  {
    name: 'a setext heading, with text right after it',
    code: block(
      'Title',
      '=====',
      'Text under it.',
      '',
      'Subtitle',
      '---',
      'Text under it.',
      '',
      'Short',
      '=',
      'Text under it.',
    ),
  },
  {
    name: "the line above an underline isn't spaced or wrapped",
    code: block(
      'A title  with: gaps, and much too wide for this line, which it keeps however wide',
      '---',
    ),
  },
  {
    name: 'a blockquote keeps each line verbatim',
    code: block(
      '> one',
      '> two  with: gaps',
      '>three',
      '> > nested',
      '>',
      'Text after it.',
    ),
  },
  {
    name: 'thematic breaks of each kind',
    code: block(
      'above',
      '',
      '---',
      'below',
      '',
      '***',
      'below',
      '___',
      'below',
      '- - -',
      'below',
      '* * *',
      'below',
      '_ _ _',
      'below',
    ),
  },
  {
    name: 'a `~~~` fence',
    code: block(
      'Run:',
      '~~~js',
      'const a  = 1;',
      '',
      'if (a) {',
      '  go(\t);',
      '}',
      '@Component()',
      '~~~',
      'Text after it.',
    ),
  },
  {
    name: 'a `~~~` fence closes on a `~~~` at least as long, alone on its line',
    code: block(
      '~~~~',
      'a  b',
      '~~~',
      '```',
      '~~~~ c',
      'd  e',
      '~~~~~',
      'Text after it.',
    ),
  },
  {
    name: "a ``` fence isn't closed by a `~~~`",
    code: block('```', 'a  b', '~~~', 'c  d', '```', 'Text after it.'),
  },
  {
    name: '`<pre>` runs to its closing tag, across blank lines and tags',
    code: block(
      'Run:',
      '<pre>',
      'const a  = 1;',
      '',
      '  go(\t);',
      '@Component()',
      '</pre>',
      'Text after it.',
    ),
  },
  {
    name: 'verbatim HTML of each kind',
    code: block(
      '<PRE class="a">',
      'a  b',
      '</PRE>',
      '<script>',
      'a  b',
      '',
      '</script>',
      '<style>',
      'a  b',
      '</style>',
      '<textarea>',
      'a  b',
      '</textarea>',
      '<!-- a  b',
      '',
      'c  d -->',
      'Text after it.',
    ),
  },
  {
    name: 'verbatim HTML that closes on its own line',
    code: block('<pre>a  b</pre>', 'Text after it.', '<!-- a  b -->', 'More.'),
  },
  {
    name: 'other HTML blocks run to a blank line',
    code: block(
      '<div>',
      'a  b',
      '</div>',
      'still  in it',
      '',
      '<table>',
      '<tr><td>a  b</td></tr>',
      '</table>',
      '',
      '</ul>',
      'c  d',
      '',
      '<p>e  f',
      'g',
      '',
      '<div class="a">h  i',
      '',
      'Text after them.',
    ),
  },
  {
    name: 'other HTML blocks end at a tag',
    code: block('<div>', 'a  b', '@param name - the name'),
  },
  {
    name: 'tabs in HTML blocks are kept',
    code: block('<div>', 'a\tb', '', '<pre>a\tb</pre>'),
  },
  {
    name: 'a hard break keeps its line break',
    code: block(
      'Line one<br>',
      'line two<br/>',
      'line three<br />',
      'line four<BR>',
      'line five\\',
      'line six.',
    ),
  },
  {
    name: "a hard break in a tag's description keeps its lines aligned",
    code: block(
      '@param name - the name<br>',
      '              and more\\',
      '              and the rest',
      '@returns<br>',
      '             the result',
    ),
  },
  {
    name: "a hard break in a list item's wrapped lines keeps them under its text",
    code: block('- an item', '  and more<br>', '  and the rest'),
  },
  {
    name: 'a `<br>` inside a line is left there',
    code: block('Line one<br> line two.'),
  },
  {
    name: '`+` bullets and `1)` items, with hanging lines',
    code: block(
      '+ one',
      '+ two,',
      '  continued',
      '  + nested,',
      '    continued',
      '1) one',
      '2) two,',
      '   continued',
      '10) ten,',
      '    continued',
    ),
  },
  {
    name: 'a marker alone on its line stays there',
    code: block(
      '+',
      'one',
      '1)',
      'two',
      '-',
      'three',
      '*',
      'four',
      '1.',
      'five',
    ),
  },
  {
    name: 'a number spaced from its marker stays as it is',
    code: block('1 ) one', 'more', '2 . two', 'more'),
  },
  {
    name: 'a table with no edge pipes',
    code: block(
      'Files | Workers',
      '------|------',
      '0 | 0',
      '1  |  1',
      'a row with no pipe',
      '',
      'Text after it.',
    ),
  },
  {
    name: 'a table with no edge pipes and aligned columns ends at a tag',
    code: block(
      'Files | Workers',
      ':--- | ---:',
      '0 | 0',
      '@param {a | b} c - d',
    ),
  },
  {
    name: 'a table with a pipe only at the end of its rows',
    code: block('Files | Workers |', '--- | --- |', '0 | 0 |'),
  },
  {
    name: 'a link reference definition stays on its own line',
    code: block(
      'See [the docs][ref] for more.',
      '[ref]: https://example.com/a',
      '[Two Words]: https://example.com/b "A title"',
      "[three]:  https://example.com/c 'A title'",
      '[four]: https://example.com/d (A title)',
      '[five]:',
      'Text after them.',
    ),
  },
  {
    name: "a heading, a quote and a break in a tag's description",
    code: block(
      '@param name - the name',
      '# A heading',
      'text after it',
      '@param other - the other',
      '> a quote',
      'text after it',
      '@returns the result',
      '---',
      'text after it',
    ),
  },
  {
    name: "a table in a tag's description, and a tag line ends it",
    code: block(
      '@param name - the name',
      'Files | Workers',
      '---|---',
      '0 | 0',
      '@returns the result',
    ),
  },
  {
    name: 'a tag above an underline keeps its line, however wide',
    code: block(
      '@param name - the name, which is much too wide for this line, so it would wrap otherwise',
      '---',
      '@returns  the  result',
      '===',
    ),
  },
  {
    name: 'the line that closes a multi-line `{Type}` above an underline',
    code: block(
      '@param {{',
      '  a: string',
      '}} name - the name, which is much too wide for this line, so it would wrap otherwise',
      '---',
    ),
  },
];

// Text around the constructs that's still flowed.
export const blockInvalid = [
  {
    name: 'paragraph text after a heading is flowed, and stays out of it',
    errors: join,
    code: block('# Title', 'Intro', 'text.'),
    output: block('# Title', 'Intro text.'),
  },
  {
    name: 'paragraph text before a heading stays out of it',
    errors: join,
    code: block('Some', 'text.', '# Title'),
    output: block('Some text.', '# Title'),
  },
  {
    name: 'only the line above an underline is kept out of the text before it',
    errors: join,
    code: block('Some', 'text.', 'Title', '==='),
    output: block('Some text.', 'Title', '==='),
  },
  {
    name: 'an unmarked line after a blockquote is flowed',
    errors: join,
    code: block('> one', 'two', 'three'),
    output: block('> one', 'two three'),
  },
  {
    name: 'text around a thematic break is flowed',
    errors: [...join, ...join],
    code: block('a', 'b', '', '***', 'c', 'd'),
    output: block('a b', '', '***', 'c d'),
  },
  {
    name: 'an unclosed `<pre>` ends at a blank line',
    errors: join,
    code: block('<pre>', 'a  b', '', 'text', 'after it.'),
    output: block('<pre>', 'a  b', '', 'text after it.'),
  },
  {
    name: 'an unclosed `<pre>` ends at a tag',
    errors: join,
    code: block('<pre>', 'a  b', '@returns the', '  result'),
    output: block('<pre>', 'a  b', '@returns the result'),
  },
  {
    name: 'text after a closed `<pre>` is flowed',
    errors: join,
    code: block('<pre>', 'a  b', '</pre>', 'text', 'after it.'),
    output: block('<pre>', 'a  b', '</pre>', 'text after it.'),
  },
  {
    name: 'text after a verbatim element closed on its own line is flowed',
    errors: join,
    code: block('<pre>a  b</pre>', 'text', 'after it.'),
    output: block('<pre>a  b</pre>', 'text after it.'),
  },
  {
    name: 'an unclosed `<div>` ends at a blank line',
    errors: join,
    code: block('<div>', 'a  b', '', 'text', 'after it.'),
    output: block('<div>', 'a  b', '', 'text after it.'),
  },
  {
    name: 'an unclosed `<div>` ends at a tag',
    errors: join,
    code: block('<div>', 'a  b', '@returns the', '  result'),
    output: block('<div>', 'a  b', '@returns the result'),
  },
  {
    name: 'text after a closed `~~~` fence is flowed',
    errors: join,
    code: block('~~~', 'a  b', '~~~', 'text', 'after it.'),
    output: block('~~~', 'a  b', '~~~', 'text after it.'),
  },
  {
    name: 'a table ends at a blank line',
    errors: join,
    code: block('a | b', '--|--', '0 | 0', '', 'text', 'after it.'),
    output: block('a | b', '--|--', '0 | 0', '', 'text after it.'),
  },
  {
    name: 'a tag after a table with no edge pipes is flowed',
    errors: join,
    code: block('a | b', '--|--', '0 | 0', '@returns the', '  result'),
    output: block('a | b', '--|--', '0 | 0', '@returns the result'),
  },
  {
    name: 'text after a table with edge pipes is flowed, as it always was',
    errors: join,
    code: block('| a | b |', '|---|---|', '| 0 | 0 |', 'text', 'after it.'),
    output: block('| a | b |', '|---|---|', '| 0 | 0 |', 'text after it.'),
  },
  {
    name: 'text around a link reference definition is flowed',
    errors: [...join, ...join],
    code: block('a', 'b', '[ref]: https://example.com', 'c', 'd'),
    output: block('a b', '[ref]: https://example.com', 'c d'),
  },
  {
    name: 'a hard break keeps its line, and the text either side is flowed',
    errors: [...join, ...join],
    code: block('a', 'b<br>', 'c', 'd.'),
    output: block('a b<br>', 'c d.'),
  },
  {
    name: 'text before a hard break wraps, and the break stays at its end',
    errors: breaks,
    options: narrow,
    code: block('aaaa bbbb cccc dddd eeee ffff gggg hhhh iiii.<br>', 'jjjj.'),
    output: block(
      'aaaa bbbb cccc dddd eeee ffff gggg',
      'hhhh iiii.<br>',
      'jjjj.',
    ),
  },
  {
    name: 'a backslash ends a line as a `<br>` does',
    errors: join,
    code: block('a', 'b\\', 'c'),
    output: block('a b\\', 'c'),
  },
  {
    name: 'a hard break after a tag hangs the text below it',
    errors: [{ messageId: 'join' }],
    code: block('@param a - b<br>', 'c', 'd'),
    output: block('@param a - b<br>', '           c d'),
  },
  {
    name: 'a hard break after a wide head hangs the text two spaces in',
    errors: [{ messageId: 'join' }],
    code: block(
      '@param {{ aaaaaaaaaaaaaaaaaaaaaaaa: number, b: string }} name - c<br>',
      'd',
      'e',
    ),
    output: block(
      '@param {{ aaaaaaaaaaaaaaaaaaaaaaaa: number, b: string }} name - c<br>',
      '  d e',
    ),
  },
  {
    name: "a hard break in a wide head's description below it",
    errors: breaks,
    options: narrow,
    code: block(
      '@param {{ aaaaaaaaaaaaaaaaaaaaaaaaaaa: number }} name - c d<br>',
      'e',
    ),
    output: block(
      '@param {{ aaaaaaaaaaaaaaaaaaaaaaaaaaa: number }} name -',
      '  c d<br>',
      '  e',
    ),
  },
  {
    name: "a list item's hard break keeps the text after it under its text",
    errors: join,
    code: block('- a', '  b<br>', '  c', '  d'),
    output: block('- a', '  b<br>', '  c d'),
  },
  {
    name: 'two trailing spaces are no hard break, since `no-trailing-space` removes them',
    errors: join,
    code: block('Line one  ', 'line two'),
    output: block('Line one line two'),
  },
  {
    name: "a backslash inside a code span that goes on to the next line isn't a break",
    errors: join,
    code: block('a `b\\', 'c` d'),
    output: block('a `b\\ c` d'),
  },
  {
    name: "`#foo`, `+1`, `1)x` and seven `#` aren't constructs",
    errors: [...join, ...join, ...join, ...join],
    code: block(
      '#foo bar',
      'baz.',
      '',
      '+1 is enough',
      'here.',
      '',
      '1)x is enough',
      'here.',
      '',
      '####### seven',
      'here.',
    ),
    output: block(
      '#foo bar baz.',
      '',
      '+1 is enough here.',
      '',
      '1)x is enough here.',
      '',
      '####### seven here.',
    ),
  },
  {
    name: "a `[ref]:` with more than a URL and a title after it isn't a definition",
    errors: join,
    code: block('[ref]:  more than one word', 'here.'),
    output: block('[ref]:  more than one word here.'),
  },
  {
    name: "inline HTML and other tags aren't HTML blocks",
    errors: [...join, ...join],
    code: block('<code>a</code> and', 'more.', '', '<T> and', 'more.'),
    output: block('<code>a</code> and more.', '', '<T> and more.'),
  },
  {
    name: "a `---` with text after it isn't a thematic break",
    errors: join,
    code: block('--- then', 'more.'),
    output: block('--- then more.'),
  },
  {
    name: 'a one-line heading expands, as a one-line list item does',
    errors: [{ messageId: 'break' }],
    code: '/** # Title */\nexport const x = 1;\n',
    output: block('# Title'),
  },
  {
    name: 'a one-line `<pre>` expands',
    errors: [{ messageId: 'break' }],
    code: '/** <pre>a</pre> */\nexport const x = 1;\n',
    output: block('<pre>a</pre>'),
  },
  {
    name: 'a wrap keeps a `<br>` from ending a line it was inside of',
    errors: breaks,
    options: narrow,
    code: block('aaaa bbbb cccc dddd eeee ffff gggg<br> hhhh iiii.'),
    output: block('aaaa bbbb cccc dddd eeee ffff', 'gggg<br> hhhh iiii.'),
  },
  {
    name: 'a wrap keeps a backslash from ending a line it was inside of',
    errors: breaks,
    options: narrow,
    code: block('aaaa bbbb cccc dddd eeee ffff gggg\\ hhhh iiii.'),
    output: block('aaaa bbbb cccc dddd eeee ffff', 'gggg\\ hhhh iiii.'),
  },
  {
    name: "a wrap keeps a paragraph's first line from reading as a thematic break",
    options: [{ width: 12, orphans: { sentence: false }, shortWords: false }],
    errors: breaks,
    code: block('--- aaaa bbbb.'),
    output: block('--- aaaa', 'bbbb.'),
  },
  {
    name: "a wrap keeps a paragraph's first line from reading as a definition",
    options: [{ width: 42, orphans: { sentence: false } }],
    errors: breaks,
    code: block('[ref]: https://example.com/aaaaaaaa bbbb cccc.'),
    output: block('[ref]:  https://example.com/aaaaaaaa bbbb', 'cccc.'),
  },
  {
    name: 'a description that would read as a construct stays on a wide head',
    errors: breaks,
    options: narrow,
    code: block(
      '@param {{ aaaaaaaaaaaaaaaaaaaaaaaaaaa: number }} name - > five is the limit',
    ),
    output: block(
      '@param {{ aaaaaaaaaaaaaaaaaaaaaaaaaaa: number }} name - > five',
      '  is the limit',
    ),
  },
];

// A token glued to the one before it, explicitly at one width, as the sweeps
// below do at others.
const glueInvalid = [
  ...['#', '>', '+', '1)'].map((token) => [token, false]),
  ...[
    '######',
    '>foo',
    '---',
    '===',
    '***',
    '___',
    '```',
    '~~~',
    '```js',
    '~~~js',
    '<pre>',
    '</pre>',
    '<div>',
    '<!--',
    '---|---',
  ].map((token) => [token, true]),
].map(([token, down]) => ({
  name: `glue:  \`${token}\` with the token before it`,
  options: narrow,
  errors: breaks,
  code: block(`aaaa bbbb cccc dddd eeee ffff gggg ${token} hhhh iiii.`),
  output: down
    ? block('aaaa bbbb cccc dddd eeee ffff', `gggg ${token} hhhh iiii.`)
    : block(`aaaa bbbb cccc dddd eeee ffff gggg ${token}`, 'hhhh iiii.'),
}));
blockInvalid.push(...glueInvalid, {
  name: 'glue:  `[ref]:` with the token before it',
  options: narrow,
  errors: breaks,
  code: block('aaaa bbbb cccc dddd eeee ffff gggg [ref]: hhhh iiii.'),
  output: block('aaaa bbbb cccc dddd eeee ffff', 'gggg [ref]:  hhhh iiii.'),
});

// The tokens a wrap must never put at the start of a line, in order of the
// constructs they'd start.
export const noStart = [
  '#',
  '###',
  '######',
  '>',
  '>foo',
  '>=',
  '+',
  '1)',
  '23)',
  '2.',
  '-',
  '*',
  '*em*',
  '---',
  '-----',
  '--',
  '===',
  '=',
  '___',
  '_',
  '***',
  '```',
  '```js',
  '~~~',
  '~~~js',
  '<pre>',
  '</pre>',
  '<pre',
  '<script>',
  '<div>',
  '</div>',
  '<div',
  '<!--',
  '[ref]:',
  '[a b]:',
  '---|---',
  ':--|--:',
  '|',
  '@foo',
];

// The tokens that may start a line, which only look like a construct.
export const mayStart = ['#foo', '+1', '1)x', '=foo', '<code>', '[ref]'];

// A token that ends in a hard break, which a wrap must never leave at the end of
// a line.
export const noEnd = ['aa<br>', 'aa<br/>', 'aa\\', '\\'];

// The widths a token is wrapped at, so it lands at each place on a line.
export const guardWidths = [16, 22, 28, 34, 40, 46, 52, 58, 64, 70, 76, 82];

// Fewer widths for the tests of all the rules together, which run them all.
export const convergeWidths = [22, 40, 58, 76];

// The ways a token's paragraph may be laid out, each `options` of `reflow`.
export const guardLimits = [
  {},
  {
    orphans: { sentence: false, clause: false, paren: false },
    names: false,
    shortWords: false,
    hang: false,
    widows: 0,
  },
];

// The block a token is wrapped in:  a paragraph, a tag's description, and
// a list item's wrapped lines, with the token at some place in its words.
export const guardBlocks = (token) => {
  const before = 'aaaa bbbb cccc dddd eeee ffff gggg hhhh iiii jjjj';
  const after = 'kkkk llll mmmm nnnn oooo pppp qqqq rrrr ssss tttt';
  const text = `${before} ${token} ${after}`;
  return [
    block(text),
    block(`Some text ${text}`),
    block(`@param name - ${text}`),
    block('- an item', text),
    block(`${before} ${token}`),
  ];
};
