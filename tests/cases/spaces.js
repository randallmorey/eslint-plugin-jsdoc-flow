// The cases of the `spaces` setting at `1`, shared by its own tests and the
// tests of all the rules together.  As in `cases/spacing.js`, each invalid case
// has gaps of only one kind, so it's valid for the other rules.
import { block } from '../helpers.js';

export const oneSpace = { 'jsdoc-flow': { spaces: 1 } };

const errors = (...ids) => ids.map((messageId) => ({ messageId }));
const withSetting = (c) => ({ ...c, settings: oneSpace });

export const oneSpaceValid = [
  {
    name: 'one space after a sentence end and a colon, one between words',
    code: block(
      'One sentence! Another? Then a colon: and more.',
      '',
      '@param {string} name - the description. More of it: this.',
    ),
  },
  {
    name: 'a sentence end or colon at the end of a line needs no space',
    code: block('A sentence ends here.', 'And a colon:', 'here.'),
  },
  {
    name: 'one space after an abbreviation, whatever it may be',
    code: block(
      'Use e.g. this, etc. Then Elm St. Station, Mr. Smith, or He met Paul. St. Paul.',
    ),
  },
  {
    name: 'spaces inside code spans, links, `{...}` and `[...]` are kept',
    code: block(
      'Use `a.  b` or `c:  d`, [a link.  Here](http://x),',
      '{@link Foo.  Bar} and `a span',
      'that.  crosses` lines.',
      '',
      '@param {{ a:  number }} [b.  c] - the description',
    ),
  },
  {
    name: 'the lines that are kept as they are keep their gaps',
    code: block(
      '    indented.  code:  here',
      '',
      '- a bullet.  With:  spaces',
      '| a.  b | c:  d |',
      '',
      '```',
      'fenced.  code:  here',
      '```',
      '@example',
      'foo.  bar:  baz',
    ),
  },
  {
    name: 'the gaps inside a multi-line `{Type}` are kept',
    code: block('@param {{', '  a:  string.  b', '}} name - One. Two: three.'),
  },
  {
    name: "one space on either side of a tag's `-`, whatever is before it",
    code: block('@param name: - the name', '@param name. - the name'),
  },
].map(withSetting);

export const oneSpaceSentenceInvalid = [
  {
    name: 'two spaces after a sentence end',
    code: block('One sentence.  Another!  Then?  More.'),
    output: block('One sentence. Another! Then? More.'),
    errors: errors('sentence', 'sentence', 'sentence'),
  },
  {
    name: 'more than two spaces after a sentence end',
    code: block('One sentence.   Then more.    Then more.'),
    output: block('One sentence. Then more. Then more.'),
    errors: errors('sentence', 'sentence'),
  },
  {
    name: 'an abbreviation before a capitalized word still ends a sentence',
    code: block('It stops at 5 p.m.  Then more, and so on, etc.  (Foo, say.)'),
    output: block('It stops at 5 p.m. Then more, and so on, etc. (Foo, say.)'),
    errors: errors('sentence', 'sentence'),
  },
  {
    name: 'a closing bracket or quote after a sentence end',
    code: block('It ends (like this.)  Or "like this."  Then more.'),
    output: block('It ends (like this.) Or "like this." Then more.'),
    errors: errors('sentence', 'sentence'),
  },
  {
    name: 'the words around the gap are reported, at their line and columns',
    code: block('Fine. Fine.', 'Here.  And here.'),
    output: block('Fine. Fine.', 'Here. And here.'),
    errors: [
      { messageId: 'sentence', line: 3, column: 4, endLine: 3, endColumn: 14 },
    ],
  },
  {
    name: "a tag's description",
    code: block('@param {string} name - the description.  More.'),
    output: block('@param {string} name - the description. More.'),
    errors: errors('sentence'),
  },
  {
    name: "a bullet's wrapped lines",
    code: block('- a bullet', 'continued.  Here'),
    output: block('- a bullet', 'continued. Here'),
    errors: errors('sentence'),
  },
  {
    name: 'a one-liner, nested',
    code: 'class A {\n  /** Short text.  More text. */\n  x = 1;\n}\n',
    output: 'class A {\n  /** Short text. More text. */\n  x = 1;\n}\n',
    errors: errors('sentence'),
  },
  {
    name: 'the description after a multi-line `{Type}`',
    code: block('@param {{', '  a: string', '}} name - One.  Two.'),
    output: block('@param {{', '  a: string', '}} name - One. Two.'),
    errors: errors('sentence'),
  },
].map(withSetting);

export const oneSpaceColonInvalid = [
  {
    name: 'two spaces after a colon',
    code: block('A colon:  then more.'),
    output: block('A colon: then more.'),
    errors: errors('colon'),
  },
  {
    name: 'more than two spaces after a colon',
    code: block('A colon:   then more, a colon:    then more.'),
    output: block('A colon: then more, a colon: then more.'),
    errors: errors('colon', 'colon'),
  },
  {
    name: 'a closing bracket or quote after a colon',
    code: block('It has (a colon:)  then "another:"  then more.'),
    output: block('It has (a colon:) then "another:" then more.'),
    errors: errors('colon', 'colon'),
  },
  {
    name: "a tag's description",
    code: block('@param {string} name - the description:  more.'),
    output: block('@param {string} name - the description: more.'),
    errors: errors('colon'),
  },
].map(withSetting);

// Two spaces can't show that a sentence ended, so these are `word` gaps here,
// where with two spaces they're kept as sentence ends.
export const oneSpaceWordInvalid = [
  {
    name: 'too many spaces between words',
    code: block('One sentence. Then  more,   and more.'),
    output: block('One sentence. Then more, and more.'),
    errors: errors('word', 'word'),
  },
  {
    name: 'two spaces after `St.` are not a sentence end',
    code: block('He lives on Elm St.  Then more.'),
    output: block('He lives on Elm St. Then more.'),
    errors: errors('word'),
  },
  {
    name: 'two spaces before `St.` are not a sentence end',
    code: block('He met Paul.  St. Paul was there.'),
    output: block('He met Paul. St. Paul was there.'),
    errors: errors('word'),
  },
  {
    name: 'two spaces after an abbreviation before a lowercase word',
    code: block('A token, e.g.  this one, and keys, incl.  these.'),
    output: block('A token, e.g. this one, and keys, incl. these.'),
    errors: errors('word', 'word'),
  },
  {
    name: 'two spaces after `Mr.` or `vs.`, as with two spaces',
    code: block('Ask Mr.  Smith. Then Vue vs.  React.'),
    output: block('Ask Mr. Smith. Then Vue vs. React.'),
    errors: errors('word', 'word'),
  },
].map(withSetting);

export const oneSpaceReflowValid = [
  {
    name: 'a block with one space that needs no reflow',
    code: block('One sentence. Another: here.'),
  },
  {
    name: 'a block whose only problem is its spacing is left to the spacing rules',
    code: block('One.  Two:  yes.'),
  },
  {
    name: 'an abbreviation with two spaces is left to `word-spacing`',
    code: block('He lives on Elm St.  Then more.'),
  },
].map(withSetting);

export const oneSpaceReflowInvalid = [
  {
    name: 'a block that needs a reflow gets one space',
    code: block('One sentence. Another: here.', 'And more.'),
    output: block('One sentence. Another: here. And more.'),
    errors: errors('join'),
  },
  {
    name: 'two spaces are narrowed along with the reflow',
    code: block('One.  Two:  yes.', 'Three.'),
    output: block('One. Two: yes. Three.'),
    errors: errors('join'),
  },
  {
    name: 'a word joins a line that only has room for it with one-space gaps',
    code: block(
      'Aaaa bbbb cccc dddd.  Eeee ffff gggg hhhh:  iiii jjjj kkkk llll mmmm',
      'nnnn oo.  Qqqq rrrr ssss tttt.',
    ),
    output: block(
      'Aaaa bbbb cccc dddd. Eeee ffff gggg hhhh: iiii jjjj kkkk llll mmmm nnnn oo.',
      'Qqqq rrrr ssss tttt.',
    ),
    errors: errors('join'),
  },
  {
    name: "a tag's description hangs at its one-space column",
    code: block(
      '@param name: the description, which goes on for long enough that it has to wrap',
      'onto another line',
    ),
    output: block(
      '@param name: the description, which goes on for long enough that it has to',
      '             wrap onto another line',
    ),
    errors: errors('break'),
  },
  {
    name: 'an abbreviation with two spaces is not glued as a sentence end',
    code: block('On Elm St.  Then', 'more.'),
    output: block('On Elm St. Then more.'),
    errors: errors('join'),
  },
].map(withSetting);

// A case with gaps of every kind, for the tests of all the rules together.
export const spacesMixed = [
  {
    name: 'gaps of every kind',
    code: block(
      'One sentence.  Then  a colon:  and ( more ) .  On Elm St.  Then more.',
      '',
      '@param  name:  the description.   More:   this, which goes on for a while,',
      '  and on',
      '@returns  {string}  -  the result:  a word',
      '-  a bullet.  Then  more',
      '1.   a numbered one',
    ),
    settings: oneSpace,
  },
];
