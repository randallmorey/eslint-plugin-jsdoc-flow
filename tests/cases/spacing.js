// The cases of the spacing rules (`jsdoc-flow/sentence-spacing`,
// `colon-spacing`, `word-spacing`, `no-extra-punctuation-space`,
// `tag-spacing` and `bullet-spacing`), shared by their own tests and the
// tests of all the rules together.  Each gap that's off is reported on its
// own, from the word (or list marker) before it through the word after it,
// and the fix replaces only that gap.  The valid cases are valid for all six
// rules, and each invalid case has gaps of only one kind, so it's valid for
// the other five.
import ts from 'typescript-eslint';
import ember from 'eslint-plugin-ember/recommended';

import { block } from '../helpers.js';

export const spacingValid = [
  {
    name: 'two spaces after a sentence end and a colon, one between words',
    code: block(
      'One sentence!  Another?  Then a colon:  and more.',
      '',
      '@param {string} name - the description.  More of it:  this.',
    ),
  },
  {
    name: 'a sentence end or colon at the end of a line needs no space',
    code: block('A sentence ends here.', 'And a colon:', 'here.'),
  },
  {
    name: '`e.g.`, `i.e.` and `etc.` do not end a sentence',
    code: block('Use a token, e.g. this one, i.e. a word etc. and more.'),
  },
  {
    name: 'abbreviations in any case do not end a sentence',
    code: block(
      'E.g. this, VS. that, CF. the rest, Dr. Who, MRS. Hudson and ST. Paul.',
    ),
  },
  {
    name: '`a.m.`, `p.m.`, `a.d.`, `b.c.`, `a.c.e.` and `b.c.e.` in any case',
    code: block(
      'From 9 a.m. to 5 P.M. daily, in 300 b.c.e. or A.D. 1066, and 44 B.C.',
      'or 1 A.C.E. at most.',
    ),
  },
  {
    name: '`et al.`, `a.k.a.`, `w.r.t.`, `esp.` and `incl.` in any case',
    code: block(
      'Per Smith et al. and Jones ET AL. on maps, a.k.a. dicts, W.R.T. keys,',
      'esp. strings, Incl. symbols.',
    ),
  },
  {
    name: '`Fig.`, `Eq.`, `Sec.`, `Ch.`, `Vol.` and `pp.` before a number',
    code: block('See Fig. 2, Eq. 3, Sec. 4, Ch. 5, Vol. 6 and pp. 7-9.'),
  },
  {
    name: 'two spaces after a new abbreviation end a sentence, and are kept',
    code: block('Many keys, incl.  Then more.'),
  },
  {
    name: 'an abbreviation before code, a `{...}` or a digit does not end a sentence',
    code: block(
      'Some, e.g. `Map` or {@link Set}, etc. `WeakMap`, see fig. 5 in all.',
    ),
  },
  {
    name: '`Dr.`, `Mr.`, `Mrs.`, `Ms.` and `Prof.` before a name do not end a sentence',
    code: block('Ask Dr. Who, Mr. Smith, Mrs. Hudson, Ms. Marvel or Prof. X.'),
  },
  {
    name: '`St.` before a capitalized word does not end a sentence, as Saint or Street',
    code: block('Meet at St. Paul, or at Elm St. Station.'),
  },
  {
    name: 'one space after a period before `St.` does not end a sentence',
    code: block('He met Paul. St. Paul was there.'),
  },
  {
    name: 'two spaces after a period before `St.` end a sentence, and are kept',
    code: block('He met Paul.  St. Paul was there.'),
  },
  {
    name: 'two spaces after `St.` end a sentence, and are kept',
    code: block('He lives on Elm St.  Then more, at ST.  Then more.'),
  },
  {
    name: '`vs.` and `cf.` before a capitalized word do not end a sentence',
    code: block('Use Vue vs. React, cf. Foo and VS. Bar.'),
  },
  {
    name: 'two spaces after an abbreviation end a sentence, and are kept',
    code: block('A token, e.g.  this one, and so on, etc.  Then more.'),
  },
  {
    name: '`approx.` before a number does not end a sentence',
    code: block('It takes approx. 5 tries, or APPROX. 6 at most.'),
  },
  {
    name: '`no.` and `nos.` before a number do not end a sentence, in any case',
    code: block('See no. 5, No. 6, NO. 7, nos. 8 and Nos. 9-10, or (no. 11).'),
  },
  {
    name: '`Inc.`, `Ltd.`, `Corp.` and `Co.` before a lowercase word do not end a sentence',
    code: block(
      'Foo Inc. in 2020, Foo Ltd. in 2021, Foo Corp. or Foo Co. in 2022.',
    ),
  },
  {
    name: '`Jr.` and `Sr.` before a lowercase word do not end a sentence',
    code: block('Foo Jr. said so, and Foo Sr. did not.'),
  },
  {
    name: 'a dotted initialism before a capitalized word does not end a sentence',
    code: block(
      'The U.S. Government, the U.K. Parliament, a non-U.N. Agency, (U.S.A.) Team.',
    ),
  },
  {
    name: 'closing emphasis or a quote around a dotted initialism changes nothing',
    code: block('The **U.S.** Government, or the \u201cU.K.\u201d Parliament.'),
  },
  {
    name: 'two spaces after a dotted initialism end a sentence, and are kept',
    code: block('In the U.S.  Then we left, from the **U.K.**  Then we met.'),
  },
  {
    name: 'two spaces after the new abbreviations end a sentence, and are kept',
    code: block(
      'It was approx.  5 or no.  5, at Foo Inc.  in 2020 with Foo Jr.  said.',
    ),
  },
  {
    name: 'closing emphasis after a sentence end',
    code: block('**Note.**  Then *done!*  Then _done?_  Then more.'),
  },
  {
    name: 'a closing curly quote after a sentence end',
    code: block('\u201cDone.\u201d  Then \u2018done.\u2019  Then more.'),
  },
  {
    name: 'closing emphasis or a closing curly quote after a colon',
    code: block(
      '**Note:**  then *note:*  then _note:_  then \u201cnote:\u201d  then more.',
    ),
  },
  {
    name: 'a `*` or `_` that closes no emphasis shows no sentence end or colon',
    code: block(
      'A foo_ Bar, foo_bar_ Baz, 2 * 3 or 2 * Four, foo._ Bar, foo.__ Bar, the',
      '.eslintrc.* files, .* or *.* and _._ or *:* with s3:* on, foo:_ Bar and',
      "'.*' or a **.** Bar.",
    ),
  },
  {
    name: 'a single `*` or `_` that an earlier word opened shows no sentence end',
    code: block('_Only in browsers._ Then *all of it.* Then more.'),
  },
  {
    name: 'a closing bracket or quote after a sentence end',
    code: block('It ends (like this.)  Or "like this."  Then more.'),
  },
  {
    name: 'spaces inside code spans, links, `{...}` and `[...]` are kept',
    code: block(
      'Use `a.  b` or `c: d`, [a link.  Here](http://x),',
      '{@link Foo.  Bar} and `a span',
      'that.  crosses` lines.',
      '',
      '@param {{ a:  number }} [b.  c] - the description',
    ),
  },
  {
    name: 'spaces inside multi-backtick code spans are kept',
    code: block(
      'Use ``a.  b`` or ```c: d ` e```, {@link ``}``  Foo} and ``a span',
      'that.  crosses`` lines.',
    ),
  },
  {
    name: 'indentation and trailing whitespace are left to the other rules',
    code: [
      '/**',
      ' *  One sentence.  ',
      ' * @param name - the description,',
      ' *   continued',
      ' */',
      'export const x = 1;',
      '',
    ].join('\n'),
  },
  {
    name: 'bullets, tables, fenced code, `@example` and indented code are skipped',
    code: block(
      '    indented.   code',
      '',
      '- a bullet. With  spaces',
      '| a. | table |',
      '',
      '```',
      'fenced.  code. ok',
      '```',
      '@example',
      'foo(1,  2);',
    ),
  },
  {
    name: 'an ellipsis, a file extension, `:hover` and emoticons keep their spaces',
    code: block(
      'It loads a .js file, styles :hover, frowns :( and smiles :)',
      'and waits ...',
    ),
  },
  {
    name: 'spaces around punctuation inside code spans, links and `{...}` are kept',
    code: block(
      'Call `f( a , b )` or [see ( this )](http://x) or {@link Foo ( bar )}.',
    ),
  },
  {
    name: 'a line break before `, . ; : ) ]` or after `( [` is left to reflow',
    code: block('It takes a word (', 'or two) and more', ', then stops.'),
  },
  {
    name: 'bullets, tables and fenced code keep their spaces around punctuation',
    code: block(
      '- ( a bullet ) , here',
      '| a , | ( b ) |',
      '',
      '```',
      'f( a , b );',
      '```',
    ),
  },
  {
    name: "one space on either side of a tag's `-`, whatever is before it",
    code: block(
      '@param name - the name',
      '@param {string} [name = x] - the name',
      '@param - the unnamed one',
      '@returns {string} - the result',
      '@param name: - the name',
      '@param name. - the name',
    ),
  },
  {
    name: "a `-` glued to a tag's name or description is part of that word",
    code: block('@param name- the name', '@param count -1 or more'),
  },
  {
    name: "a wide tag head's `-` ends its line",
    code: block(
      '@returns {{ id: string, title: string, body: string }[]} -',
      '  the notes saved',
    ),
  },
  {
    name: "a `-` after a tag's head is a word like any other",
    code: block('@param name - one - two:  three', '@see foo - bar'),
  },
  {
    name: "one space after a list item's marker, however nested",
    code: block(
      '- a bullet',
      '  * a nested one',
      '* another',
      '1. a numbered one',
      '10. Then a sentence. And another',
      '   2. nested',
      '+ a plus. And another',
      '1) a parenthesized one.  And another',
      '   20) nested',
    ),
  },
  {
    name: "a marker with no text after it doesn't start a list item",
    code: block('A list:', '', '-', '', '1.', '', '+', '', '1)'),
  },
  {
    name: 'list markers in code and `@example` keep their spaces',
    code: block(
      '    -   indented code',
      '',
      '```',
      '-   fenced',
      '```',
      '@example',
      '1.  foo();',
    ),
  },
  {
    name: 'comments that are not checked',
    code: [
      '/* A plain.  block comment. Here */',
      '// A line.  comment. Here',
      '/** Text after the opener',
      ' * on a. multi-line block. */',
      'foo(/** inline. Too  much */ 1);',
      '/** Code after the block. Ignored */ foo();',
      '',
    ].join('\n'),
  },
  {
    name: 'the gaps inside a multi-line `{Type}` are kept',
    code: block(
      '@param {{  a:  string,',
      '  mergeSettings?: boolean,  b. c  d',
      '  ( e ) ,',
      '  -   f',
      '}} name - the name',
    ),
  },
  {
    name: 'the gaps inside a `{Type}` nested three levels deep are kept',
    code: block('@param {{ a: { b: { c: string } } }} name - the name'),
  },
];

const errors = (...ids) => ids.map((messageId) => ({ messageId }));

export const sentenceInvalid = [
  {
    name: 'one space after a sentence end',
    code: block('One sentence. Another! Then? More.'),
    output: block('One sentence.  Another!  Then?  More.'),
    errors: errors('sentence', 'sentence', 'sentence'),
  },
  {
    name: 'too many spaces after a sentence end',
    code: block('One sentence.   Then more.    Then more.'),
    output: block('One sentence.  Then more.  Then more.'),
    errors: errors('sentence', 'sentence'),
  },
  {
    name: 'one space after an abbreviation before a capitalized word',
    code: block('It stops at 5 p.m. Then more, and so on, etc. (Foo, say.)'),
    output: block(
      'It stops at 5 p.m.  Then more, and so on, etc.  (Foo, say.)',
    ),
    errors: errors('sentence', 'sentence'),
  },
  {
    name: 'three spaces after an abbreviation end a sentence, too',
    code: block('A token, e.g.   this one.'),
    output: block('A token, e.g.  this one.'),
    errors: errors('sentence'),
  },
  {
    name: 'a word that ends in the letters of an abbreviation is not one',
    code: block('Do this first. Then that.'),
    output: block('Do this first.  Then that.'),
    errors: errors('sentence'),
  },
  {
    name: 'a word that ends in `al`, `ch` or `pp` is not an abbreviation',
    code: block('A deal. Then speech. Then an app. Then more.'),
    output: block('A deal.  Then speech.  Then an app.  Then more.'),
    errors: errors('sentence', 'sentence', 'sentence'),
  },
  {
    name: 'one space after a new abbreviation before a capitalized word',
    code: block('Many keys, incl. Then more, and so on et al. Then more.'),
    output: block('Many keys, incl.  Then more, and so on et al.  Then more.'),
    errors: errors('sentence', 'sentence'),
  },
  {
    name: '`no.` and `nos.` before anything but a number end a sentence',
    code: block(
      'The answer is no. Then No. then no. `x`, or nos. Then (no. Then) more.',
    ),
    output: block(
      'The answer is no.  Then No.  then no.  `x`, or nos.  Then (no.  Then) more.',
    ),
    errors: errors('sentence', 'sentence', 'sentence', 'sentence', 'sentence'),
  },
  {
    name: 'a word that ends in the letters of `no.` is not one, before a number',
    code: block('On the piano. 5 more, at the casino. 6 more.'),
    output: block('On the piano.  5 more, at the casino.  6 more.'),
    errors: errors('sentence', 'sentence'),
  },
  {
    name: '`approx.`, `Inc.`, `Ltd.`, `Corp.`, `Co.`, `Jr.` and `Sr.` before a capitalized word',
    code: block(
      'It was approx. Then Foo Inc. Then Foo Ltd. Then Foo Corp. Then Foo Co.',
      'Then Foo Jr. Then Foo Sr. Then more.',
    ),
    output: block(
      'It was approx.  Then Foo Inc.  Then Foo Ltd.  Then Foo Corp.  Then Foo Co.',
      'Then Foo Jr.  Then Foo Sr.  Then more.',
    ),
    errors: errors(
      'sentence',
      'sentence',
      'sentence',
      'sentence',
      'sentence',
      'sentence',
    ),
  },
  {
    name: 'three spaces after a dotted initialism end a sentence, too',
    code: block('In the U.S.   Then we left.'),
    output: block('In the U.S.  Then we left.'),
    errors: errors('sentence'),
  },
  {
    name: 'what looks like a dotted initialism but is not one ends a sentence',
    code: block('In u.s. Then plan B. Then Foo.A.B. Then Ph.D. in more.'),
    output: block('In u.s.  Then plan B.  Then Foo.A.B.  Then Ph.D.  in more.'),
    errors: errors('sentence', 'sentence', 'sentence', 'sentence'),
  },
  {
    name: 'closing emphasis after a sentence end',
    code: block(
      '**Note.** Then *Done.* Then _Done._ Then __Done!__ Then ***Done?*** Then.',
    ),
    output: block(
      '**Note.**  Then *Done.*  Then _Done._  Then __Done!__  Then ***Done?***  Then.',
    ),
    errors: errors('sentence', 'sentence', 'sentence', 'sentence', 'sentence'),
  },
  {
    name: 'a closing curly quote after a sentence end',
    code: block('\u201cDone.\u201d Then \u2018Done.\u2019 Then more.'),
    output: block('\u201cDone.\u201d  Then \u2018Done.\u2019  Then more.'),
    errors: errors('sentence', 'sentence'),
  },
  {
    name: 'closing emphasis with brackets and quotes after a sentence end',
    code: block(
      '_**Done.**_ Then (**Done.**) Then \u201c*Done.*\u201d Then **"Done."** Then.',
    ),
    output: block(
      '_**Done.**_  Then (**Done.**)  Then \u201c*Done.*\u201d  Then **"Done."**  Then.',
    ),
    errors: errors('sentence', 'sentence', 'sentence', 'sentence'),
  },
  {
    name: '`**` closes what an earlier word opened, after a sentence end',
    code: block('**Note this well.** Then **and this (too).** Then more.'),
    output: block('**Note this well.**  Then **and this (too).**  Then more.'),
    errors: errors('sentence', 'sentence'),
  },
  {
    name: 'snake_case before a sentence end',
    code: block('Call foo_bar. Then _private. Then foo_. Then more.'),
    output: block('Call foo_bar.  Then _private.  Then foo_.  Then more.'),
    errors: errors('sentence', 'sentence', 'sentence'),
  },
  {
    name: 'the words around the gap are reported, at their line and columns',
    code: block('Fine.  Fine.', 'Here. And here.'),
    output: block('Fine.  Fine.', 'Here.  And here.'),
    errors: [
      { messageId: 'sentence', line: 3, column: 4, endLine: 3, endColumn: 13 },
    ],
  },
  {
    name: 'a code span around the gap is reported whole',
    code: block('Set `a: b`.  Then `c d`. Here'),
    output: block('Set `a: b`.  Then `c d`.  Here'),
    errors: [{ messageId: 'sentence', column: 22, endColumn: 33 }],
  },
  {
    name: 'after a code span holding a backtick',
    code: block(
      'Or backtick ``` ` ``` needs one. This opening one is at `Foo`, or `Bar`.',
    ),
    output: block(
      'Or backtick ``` ` ``` needs one.  This opening one is at `Foo`, or `Bar`.',
    ),
    errors: errors('sentence'),
  },
  {
    name: 'after a run of backticks that nothing closes',
    code: block('A stray ``` here. Then `one`. Then more.'),
    output: block('A stray ``` here.  Then `one`.  Then more.'),
    errors: errors('sentence', 'sentence'),
  },
  {
    name: 'after a multi-backtick code span, but not inside it',
    code: block('Set ``a. b``. Then ```c. d```. Here'),
    output: block('Set ``a. b``.  Then ```c. d```.  Here'),
    errors: errors('sentence', 'sentence'),
  },
  {
    name: 'on a line starting with an inline ``` span, and in the tag below it',
    code: block(
      '```foo``` inline. Then more.',
      '@param {string} name - the description. More.',
    ),
    output: block(
      '```foo``` inline.  Then more.',
      '@param {string} name - the description.  More.',
    ),
    errors: errors('sentence', 'sentence'),
  },
  {
    name: "a tag's description",
    code: block('@param {string} name - the description. More.'),
    output: block('@param {string} name - the description.  More.'),
    errors: errors('sentence'),
  },
  {
    name: "a bullet's wrapped lines are checked",
    code: block('- a bullet', 'continued. Here'),
    output: block('- a bullet', 'continued.  Here'),
    errors: errors('sentence'),
  },
  {
    name: 'a one-liner, nested',
    code: 'class A {\n  /** Short text. More text. */\n  x = 1;\n}\n',
    output: 'class A {\n  /** Short text.  More text. */\n  x = 1;\n}\n',
    errors: errors('sentence'),
  },
  {
    name: 'a .ts file',
    filename: 'x.ts',
    languageOptions: { parser: ts.parser },
    code: block('@returns {Promise<void>} once it is done. Or not.'),
    output: block('@returns {Promise<void>} once it is done.  Or not.'),
    errors: errors('sentence'),
  },
  {
    name: "a .gts class body is checked, and its <template>'s comments aren't",
    filename: 'x.gts',
    languageOptions: { parser: ember.parser },
    code: [
      "import Component from '@glimmer/component';",
      '',
      '/** A component. It renders. */',
      'export default class Foo extends Component {',
      '  <template>',
      '    {{!-- /** Not. JSDoc. */ --}}',
      '    <p>/** Not. JSDoc. */</p>',
      '  </template>',
      '}',
      '',
    ].join('\n'),
    output: [
      "import Component from '@glimmer/component';",
      '',
      '/** A component.  It renders. */',
      'export default class Foo extends Component {',
      '  <template>',
      '    {{!-- /** Not. JSDoc. */ --}}',
      '    <p>/** Not. JSDoc. */</p>',
      '  </template>',
      '}',
      '',
    ].join('\n'),
    errors: errors('sentence'),
  },
  {
    name: 'the description after a multi-line `{Type}`',
    code: block('@param {{', '  a: string', '}} name - One. Two.'),
    output: block('@param {{', '  a: string', '}} name - One.  Two.'),
    errors: errors('sentence'),
  },
];

export const colonInvalid = [
  {
    name: 'one space after a colon',
    code: block('A colon: then more.'),
    output: block('A colon:  then more.'),
    errors: errors('colon'),
  },
  {
    name: 'too many spaces after a colon',
    code: block('A colon:   then more, a colon:    then more.'),
    output: block('A colon:  then more, a colon:  then more.'),
    errors: errors('colon', 'colon'),
  },
  {
    name: 'a closing bracket or quote after a colon',
    code: block('It has (a colon:) then "another:" then more.'),
    output: block('It has (a colon:)  then "another:"  then more.'),
    errors: errors('colon', 'colon'),
  },
  {
    name: 'the words around the gap are reported, at their line and columns',
    code: block('Fine:  fine.', 'Here: and here.'),
    output: block('Fine:  fine.', 'Here:  and here.'),
    errors: [
      { messageId: 'colon', line: 3, column: 4, endLine: 3, endColumn: 13 },
    ],
  },
  {
    name: 'closing emphasis after a colon',
    code: block(
      '**Note:** Then *note:* then _note:_ then **note this:** then.',
    ),
    output: block(
      '**Note:**  Then *note:*  then _note:_  then **note this:**  then.',
    ),
    errors: errors('colon', 'colon', 'colon', 'colon'),
  },
  {
    name: 'a closing curly quote after a colon',
    code: block('\u201cNote:\u201d Then \u2018note:\u2019 then more.'),
    output: block('\u201cNote:\u201d  Then \u2018note:\u2019  then more.'),
    errors: errors('colon', 'colon'),
  },
  {
    name: "a tag's description",
    code: block('@param {string} name - the description: more.'),
    output: block('@param {string} name - the description:  more.'),
    errors: errors('colon'),
  },
  {
    name: 'a one-liner, nested',
    code: 'class A {\n  /** Short text: more text. */\n  x = 1;\n}\n',
    output: 'class A {\n  /** Short text:  more text. */\n  x = 1;\n}\n',
    errors: errors('colon'),
  },
  {
    name: 'the description after a multi-line `{Type}`, but not inside it',
    code: block('@param {{', '  a: string', '}} name - one: two'),
    output: block('@param {{', '  a: string', '}} name - one:  two'),
    errors: errors('colon'),
  },
];

export const wordInvalid = [
  {
    name: 'too many spaces between words',
    code: block('One sentence.  Then  more,   and more.'),
    output: block('One sentence.  Then more, and more.'),
    errors: errors('word', 'word'),
  },
  {
    name: 'two spaces after `Mr.` or `vs.` become one, as they never end a sentence',
    code: block('Ask Mr.  Smith.  Then Vue vs.  React.'),
    output: block('Ask Mr. Smith.  Then Vue vs. React.'),
    errors: errors('word', 'word'),
  },
  {
    name: 'the words around the gap are reported, at their line and columns',
    code: block('Fine.  Fine.', 'Here and  here.'),
    output: block('Fine.  Fine.', 'Here and here.'),
    errors: [
      { messageId: 'word', line: 3, column: 9, endLine: 3, endColumn: 19 },
    ],
  },
  {
    name: 'a `*` or `_` that closes no emphasis is a word',
    code: block('A foo_  Bar, 2  *  3, foo.*  Bar, s3:*  on and foo._  Bar.'),
    output: block('A foo_ Bar, 2 * 3, foo.* Bar, s3:* on and foo._ Bar.'),
    errors: errors('word', 'word', 'word', 'word', 'word', 'word'),
  },
  {
    name: "a tag's head and description",
    code: block('@param  {string}  name - the  description.'),
    output: block('@param {string} name - the description.'),
    errors: errors('word', 'word', 'word'),
  },
  {
    name: "a `-` in a tag's description, or after a tag with no name",
    code: block('@param name - one  -  two', '@see foo  -  bar'),
    output: block('@param name - one - two', '@see foo - bar'),
    errors: errors('word', 'word', 'word', 'word'),
  },
  {
    name: 'a one-liner, nested',
    code: 'class A {\n  /** Short  text. */\n  x = 1;\n}\n',
    output: 'class A {\n  /** Short text. */\n  x = 1;\n}\n',
    errors: errors('word'),
  },
  {
    name: 'the gap after a multi-line `{Type}`, and the text after it',
    code: block('@typedef {{', '  a:  string', '}}  Name  and  more'),
    output: block('@typedef {{', '  a:  string', '}} Name and more'),
    errors: errors('word', 'word', 'word'),
  },
];

export const punctuationInvalid = [
  {
    name: 'a space before `, . ; :`',
    code: block('One , two ; three :  four .'),
    output: block('One, two; three:  four.'),
    errors: errors('punctuation', 'punctuation', 'punctuation', 'punctuation'),
  },
  {
    name: 'a space after `( [` and before `) ]`',
    code: block('The range ( 0, 1 ] or [ 2, 3 ) is half open.'),
    output: block('The range (0, 1] or [2, 3) is half open.'),
    errors: errors('punctuation', 'punctuation', 'punctuation', 'punctuation'),
  },
  {
    name: 'more than one space',
    code: block('Wait  , then (  go ).'),
    output: block('Wait, then (go).'),
    errors: errors('punctuation', 'punctuation', 'punctuation'),
  },
  {
    name: 'closing brackets with punctuation after them, and after a code span',
    code: block('A call ( with `args` ) , then more ).'),
    output: block('A call (with `args`), then more).'),
    errors: errors('punctuation', 'punctuation', 'punctuation', 'punctuation'),
  },
  {
    name: 'the words around the gap are reported, at their line and columns',
    code: block('Fine, fine.', 'Here , and here.'),
    output: block('Fine, fine.', 'Here, and here.'),
    errors: [
      {
        messageId: 'punctuation',
        line: 3,
        column: 4,
        endLine: 3,
        endColumn: 10,
      },
    ],
  },
  {
    name: "a tag's description",
    code: block('@param {string} name - the name ( or ID ) , trimmed.'),
    output: block('@param {string} name - the name (or ID), trimmed.'),
    errors: errors('punctuation', 'punctuation', 'punctuation'),
  },
  {
    name: "a bullet's wrapped lines are checked",
    code: block('- a bullet', 'continued , here'),
    output: block('- a bullet', 'continued, here'),
    errors: errors('punctuation'),
  },
  {
    name: 'a one-liner, nested',
    code: 'class A {\n  /** Short text . */\n  x = 1;\n}\n',
    output: 'class A {\n  /** Short text. */\n  x = 1;\n}\n',
    errors: errors('punctuation'),
  },
  {
    name: 'the text after a multi-line `{Type}`, but not inside it',
    code: block('@param {{', '  ( a )', '}} name - one , two'),
    output: block('@param {{', '  ( a )', '}} name - one, two'),
    errors: errors('punctuation'),
  },
];

export const tagInvalid = [
  {
    name: "more than one space on either side of a tag's `-`",
    code: block(
      '@param name  -  the name',
      '@param {string} [name = x]   -   the name',
      '@returns {string}   - the result',
    ),
    output: block(
      '@param name - the name',
      '@param {string} [name = x] - the name',
      '@returns {string} - the result',
    ),
    errors: errors('tag', 'tag', 'tag', 'tag', 'tag'),
  },
  {
    name: 'one space after a colon or a sentence end before the `-`',
    code: block('@param name:  - the name', '@param name.   -  the name'),
    output: block('@param name: - the name', '@param name. - the name'),
    errors: errors('tag', 'tag', 'tag'),
  },
  {
    name: 'the words around the gap are reported, at their line and columns',
    code: block('@param name -  the name'),
    output: block('@param name - the name'),
    errors: [
      { messageId: 'tag', line: 2, column: 16, endLine: 2, endColumn: 22 },
    ],
  },
  {
    name: 'continuation lines already aligned to the spaced description',
    code: block('@param name  -  the name,', '              continued'),
    output: block('@param name - the name,', '              continued'),
    errors: errors('tag', 'tag'),
  },
  {
    name: "a wide tag head's `-` at the end of its line",
    code: block(
      '@param {{ id: string, title: string, body: string }[]} notes  -',
      '  the notes to save',
    ),
    output: block(
      '@param {{ id: string, title: string, body: string }[]} notes -',
      '  the notes to save',
    ),
    errors: errors('tag'),
  },
  {
    name: 'a one-liner, nested',
    code: 'class A {\n  /** @param a  -  the a */\n  x = 1;\n}\n',
    output: 'class A {\n  /** @param a - the a */\n  x = 1;\n}\n',
    errors: errors('tag', 'tag'),
  },
  {
    name: 'the `-` after a multi-line `{Type}`',
    code: block(
      '@param {{',
      '  a: string',
      '}} name  -  the name',
      '@returns {{',
      '  a - b',
      '}}  - the result',
    ),
    output: block(
      '@param {{',
      '  a: string',
      '}} name - the name',
      '@returns {{',
      '  a - b',
      '}} - the result',
    ),
    errors: errors('tag', 'tag', 'tag'),
  },
];

export const bulletInvalid = [
  {
    name: 'more than one space after a `+` or a `1)`',
    code: block('+  a bullet', '  +   a nested one', '1)   one', '10)  ten'),
    output: block('+ a bullet', '  + a nested one', '1) one', '10) ten'),
    errors: errors('bullet', 'bullet', 'bullet', 'bullet'),
  },
  {
    name: "more than one space after a list item's marker",
    code: block(
      '-  a bullet',
      '  *   a nested one',
      '1.    a numbered one',
      '10.   ten.  Then more',
    ),
    output: block(
      '- a bullet',
      '  * a nested one',
      '1. a numbered one',
      '10. ten.  Then more',
    ),
    errors: errors('bullet', 'bullet', 'bullet', 'bullet'),
  },
  {
    name: 'the marker and the word after it are reported, at their line and columns',
    code: block('Text:', '', '  -   item'),
    output: block('Text:', '', '  - item'),
    errors: [
      { messageId: 'bullet', line: 4, column: 6, endLine: 4, endColumn: 14 },
    ],
  },
  {
    name: "a bullet in a tag's description, with its wrapped lines",
    code: block(
      '@param opts - the options:',
      '-  `a`, the first,',
      'continued',
    ),
    output: block(
      '@param opts - the options:',
      '- `a`, the first,',
      'continued',
    ),
    errors: errors('bullet'),
  },
  {
    name: 'a one-liner, nested',
    code: 'class A {\n  /** -  an item */\n  x = 1;\n}\n',
    output: 'class A {\n  /** - an item */\n  x = 1;\n}\n',
    errors: errors('bullet'),
  },
];

// A case with gaps of every kind, for the tests of all the rules together.
export const spacingMixed = [
  {
    name: 'gaps of every kind',
    code: block(
      'One sentence. Then  a colon: and ( more ) .',
      '',
      '@param  name  -  the description.   More:   this.',
      '-  a bullet. Then  more',
      '1.   a numbered one',
    ),
  },
];
