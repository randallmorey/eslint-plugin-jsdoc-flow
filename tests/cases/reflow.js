// The `jsdoc-flow/reflow` cases, shared by its own tests and the tests of
// all the rules together.
import ts from 'typescript-eslint';
import ember from 'eslint-plugin-ember/recommended';

import { block } from '../helpers.js';

// A narrow width keeps the inputs short:  ` * ` leaves 37 columns of text.
const narrow = [{ width: 40 }];

const errors = [{ messageId: 'break' }];

export const valid = [
  {
    name: "a code span's spaces are kept as they are",
    code: block('Matches `-  x` and `a   b`, but not `c d`.'),
  },
  {
    name: 'an already flowed block',
    code: block(
      'Reflows a paragraph.  Two spaces follow a sentence end and',
      'a colon:  like this.',
      '',
      '@param name - the description, which is long enough to wrap onto one',
      '              continuation line',
      '@returns the result',
    ),
  },
  {
    name: 'a block whose only problem is tag alignment is left to tag-align',
    code: block(
      'Reflows a paragraph.',
      '',
      '@param name - the description, which is long enough to wrap onto one',
      '  continuation line',
      '@returns {string} the result, which is also long enough to wrap onto one',
      '        continuation line',
    ),
  },
  {
    name: 'a wide head stays on one line with its description when it fits',
    code: block(
      '@param {string} abcdefghijklmnopqrstuvwxyzz - aaaaaaaaa bbbbbbbbb ccccccccc',
      "@returns {import('eslint').Rule.RuleListener} the listeners",
    ),
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
    name: 'a line may break around `St.` between lowercase words',
    options: narrow,
    code: block('aaaa bbbb cccc dddd eeee ff on St.', 'and so on.'),
  },
  {
    name: 'with `shortWords` off, `a` may end a line',
    options: [{ width: 40, shortWords: false }],
    code: block('aaaa bbbb cccc dddd eeee ffff gggg a', 'note and more.'),
  },
  {
    name: 'with `shortWords` on, a short word with punctuation may end a line',
    options: narrow,
    code: block('aaaa bbbb cccc dddd eeee ff plan B,', 'gggg hhhh iiii.'),
  },
  {
    name: 'with `shortWords` on, a short word in a code span may end a line',
    options: narrow,
    code: block('aaaa bbbb cccc dddd eeee ffff gg `a`', 'hhhh iiii jjjj.'),
  },
  {
    name: 'with `hang` off, a comma may not hang past the width',
    options: [{ width: 40, hang: false }],
    code: block('aaaa bbbb cccc dddd eeee ffff gggg', 'hh, iiii jjjj kkkk.'),
  },
  {
    name: 'with `hang` on, a closing quote hangs one column past the width',
    options: narrow,
    code: block(
      'aaaa bbbb cccc dddd eeee ffff gggg \u201ch\u201d',
      'iiii jjjj kkkk.',
    ),
  },
  {
    name: 'with `hang` on, a letter may not hang past the width',
    options: narrow,
    code: block('aaaa bbbb cccc dddd eeee ffff gggg', 'hhh iiii jjjj kkkk.'),
  },
  {
    name: 'with `hang` on, only one column may hang past the width',
    options: narrow,
    code: block('aaaa bbbb cccc dddd eeee ffff gggg', 'hhh, iiii jjjj kkkk.'),
  },
  {
    name: 'with `widows` off, a short last line may stay',
    options: [{ width: 40, widows: 0 }],
    code: block('aaaa bbbb cccc dddd eeee ffff gggg', 'hh i.'),
  },
  {
    name: 'with `widows` on, a last line that is long enough stays',
    options: [{ width: 40, widows: 0.25 }],
    code: block('aaaa bbbb cccc dddd eeee ffff gggg', 'hhhh iiii.'),
  },
  {
    name: 'with `widows` on, a one-line paragraph stays',
    options: [{ width: 40, widows: 1 }],
    code: block('Short one.'),
  },
  {
    name: "with `widows` on, a tag's last line may not end right of the line before it",
    options: [{ width: 40, widows: 0.5 }],
    code: block(
      '@param name - aaaa bbbb cccc dddd',
      '              eeee ffff.',
    ),
  },
  {
    name: 'indented code is kept as it is',
    options: narrow,
    code: block(
      'Usage:',
      '',
      '    <input {{autofocus this.note.id when=this.isUntitled}} />',
      '',
      'or',
      '',
      '    <input {{autofocus}} />',
    ),
  },
  {
    name: 'a one-liner stays on one line when it fits',
    code: 'class A {\n  /** Short text.  More text. */\n  x = 1;\n}\n',
  },
  {
    name: "a block whose only problems are its lines' edges is left to the edge rules",
    code: [
      '/**',
      ' *  Extra before.',
      ' *   ',
      ' * Extra after.  ',
      ' *',
      '   * Star off.',
      ' */',
      'export const x = 1;',
      '',
      '/**  One-liner.   */',
      'export const y = 1;',
      '',
    ].join('\n'),
  },
  {
    name: 'a block whose only problem is spacing is left to the spacing rules',
    code: block(
      'One sentence. Then a colon: and more,  with an extra space.',
      '',
      '@param  name - the description, which is long enough to wrap onto one',
      '  continuation line',
    ),
  },
  {
    name: 'a block whose only problems are spaces around punctuation is left to no-extra-punctuation-space',
    code: block('One , two ( three ) .'),
  },
  {
    name: 'a one-liner that fits',
    code: '/** Short text.  More text. */\nexport const x = 1;\n',
  },
  {
    name: 'comments that are not flowed',
    code: [
      '/* A plain  block comment.  */',
      '// A line  comment.',
      '/**/',
      '/** */',
      '/** Text after the opener',
      ' * on a  multi-line block. */',
      'foo(/** inline.  Too  much */ 1);',
      '/** Code after the block. Ignored */ foo();',
      '',
    ].join('\n'),
  },
];

export const invalid = [
  {
    name: 'a bracket in a code span never pairs with a bracket outside it',
    options: narrow,
    code: block('aaaa `[` bbbb cccc dddd eeee ffff gggg hhhh `]` iiii.'),
    output: block('aaaa `[` bbbb cccc dddd eeee ffff', 'gggg hhhh `]` iiii.'),
  },
  {
    name: 'a bracket in a code span never closes the `[...]` around it',
    options: narrow,
    code: block('aaaa bbbb cccc dddd [see `]` here and there] eeee.'),
    output: block('aaaa bbbb cccc dddd', '[see `]` here and there] eeee.'),
  },
  {
    name: "a code span's spaces are kept when its paragraph is reflowed",
    errors: [{ messageId: 'join' }],
    options: narrow,
    code: block('aaaa `x  y`', 'bbbb cccc.'),
    output: block('aaaa `x  y` bbbb cccc.'),
  },
  {
    name: "a code span's tab is kept when its paragraph is reflowed",
    errors: [{ messageId: 'join' }],
    options: narrow,
    code: block('aaaa `x\ty`', 'bbbb cccc.'),
    output: block('aaaa `x\ty` bbbb cccc.'),
  },
  {
    name: 'a number and `.` never moves to the start of a line, where it would read as a list item',
    options: [{ width: 40, orphans: { sentence: false }, widows: 0 }],
    code: block('aaaa bbbb cccc dddd eeee ffff since 2022.  Then more.'),
    output: block('aaaa bbbb cccc dddd eeee ffff', 'since 2022.  Then more.'),
  },
  {
    name: 'a word starting with `|` never moves to the start of a line, where it would read as a table row',
    options: [{ width: 40, orphans: { sentence: false }, widows: 0 }],
    code: block('aaaa bbbb cccc dddd eeee ffff ggggg || hhhh.'),
    output: block('aaaa bbbb cccc dddd eeee ffff', 'ggggg || hhhh.'),
  },
  {
    name: 'a line is at most 78 columns',
    errors: [
      { messageId: 'break', line: 2, column: 68, endLine: 2, endColumn: 79 },
    ],
    code: block(
      'This paragraph is long enough that it has to wrap onto a second line, since a line may be at most 78 columns.',
    ),
    output: block(
      'This paragraph is long enough that it has to wrap onto a second line,',
      'since a line may be at most 78 columns.',
    ),
  },
  {
    name: 'lines are filled greedily',
    errors: [{ messageId: 'join' }],
    options: narrow,
    code: block('aaaa', 'bbbb cccc', 'dddd.'),
    output: block('aaaa bbbb cccc dddd.'),
  },
  {
    name: 'glue:  the first two words of a sentence',
    options: narrow,
    code: block('aaaa bbbb cccc dddd eeee fff. Gg hhhh iiii jjjj.'),
    output: block('aaaa bbbb cccc dddd eeee fff.', 'Gg hhhh iiii jjjj.'),
  },
  {
    name: 'glue:  the last two words of a sentence',
    options: narrow,
    code: block('aaaa bbbb cccc dddd eeee ffff gggg hhhh.'),
    output: block('aaaa bbbb cccc dddd eeee ffff', 'gggg hhhh.'),
  },
  {
    // The head and the first two words overflow together.
    name: 'glue:  a tag head with the start of its description',
    errors: [{ messageId: 'join' }],
    options: narrow,
    code: block('@param name -', 'xxxxxxxxxxxxxxxxxxxx yyyy zzzz wwww.'),
    output: block(
      '@param name - xxxxxxxxxxxxxxxxxxxx yyyy',
      '              zzzz wwww.',
    ),
  },
  {
    name: 'glue:  the first word inside `(` with the next',
    options: narrow,
    code: block('aaaa bbbb cccc dddd eeee ffff (gggg hhhh iiii) jjjj kkkk.'),
    output: block(
      'aaaa bbbb cccc dddd eeee ffff',
      '(gggg hhhh iiii) jjjj kkkk.',
    ),
  },
  {
    name: 'glue:  the last word before `)` with the one before it',
    options: narrow,
    code: block('aaaa bbbb (cccc dddd eeee ffff gggg hhhh) iiii jjjj.'),
    output: block('aaaa bbbb (cccc dddd eeee ffff', 'gggg hhhh) iiii jjjj.'),
  },
  {
    name: 'glue:  the word after a comma with the next',
    options: narrow,
    code: block('aaaa bbbb cccc dddd eeee ffff, gggg hhhh iiii jjjj.'),
    output: block('aaaa bbbb cccc dddd eeee ffff,', 'gggg hhhh iiii jjjj.'),
  },
  {
    name: 'no glue:  a word after a comma that ends in a comma or semicolon',
    options: narrow,
    code: block(
      'aaaa bbbb cccc dddd eeee ffff, gggg, hhhh iiii.',
      '',
      'aaaa bbbb cccc dddd eeee ffff, gggg; hhhh iiii.',
    ),
    output: block(
      'aaaa bbbb cccc dddd eeee ffff, gggg,',
      'hhhh iiii.',
      '',
      'aaaa bbbb cccc dddd eeee ffff, gggg;',
      'hhhh iiii.',
    ),
    errors: [{ messageId: 'break' }, { messageId: 'break' }],
  },
  {
    name: 'glue:  a word ending in a comma, after a semicolon or colon',
    options: narrow,
    code: block(
      'aaaa bbbb cccc dddd eeee ffff; gggg, hhhh iiii.',
      '',
      'aaaa bbbb cccc dddd eeee ffff: gggg, hhhh iiii.',
    ),
    output: block(
      'aaaa bbbb cccc dddd eeee ffff;',
      'gggg, hhhh iiii.',
      '',
      'aaaa bbbb cccc dddd eeee ffff:',
      'gggg, hhhh iiii.',
    ),
    errors: [{ messageId: 'break' }, { messageId: 'break' }],
  },
  {
    name: 'glue:  a token starting with `@` with the one before it',
    options: narrow,
    code: block('aaaa bbbb cccc dddd eeee ffff gggg @foo hhhh iiii.'),
    output: block('aaaa bbbb cccc dddd eeee ffff', 'gggg @foo hhhh iiii.'),
  },
  {
    name: 'glue:  a token starting with `*` with the one before it',
    options: narrow,
    code: block('aaaa bbbb cccc dddd eeee ffff gggg *em* hhhh iiii.'),
    output: block('aaaa bbbb cccc dddd eeee ffff', 'gggg *em* hhhh iiii.'),
  },
  {
    name: 'glue:  a lone `-` with the token before it',
    options: narrow,
    code: block('aaaa bbbb cccc dddd eeee ffff gggg - hhhh iiii.'),
    output: block('aaaa bbbb cccc dddd eeee ffff gggg -', 'hhhh iiii.'),
  },
  {
    name: 'a line break before `, . ; : ) ]` or after `( [` is joined',
    errors: [{ messageId: 'reflow' }],
    code: block('aaaa (', 'bbbb) cccc', ', dddd.'),
    output: block('aaaa (bbbb) cccc, dddd.'),
  },
  {
    name: 'words with no space between them are measured and kept as one',
    options: narrow,
    code: block('aaaa bbbb cccc dddd eeee ffff ( gg ) hh ii.'),
    output: block('aaaa bbbb cccc dddd eeee ffff (gg)', 'hh ii.'),
  },
  {
    name: 'no glue across a sentence end',
    options: [{ width: 40, widows: 0 }],
    code: block('aaaa bbbb cccc dddd eeee ffff gggg. Ok.'),
    output: block('aaaa bbbb cccc dddd eeee ffff gggg.', 'Ok.'),
  },
  {
    name: 'glue:  an abbreviation that two spaces make a sentence end, with the next word',
    options: narrow,
    code: block('aaaa bbbb cccc dddd eeee ffff e.g.  gg hh.'),
    output: block('aaaa bbbb cccc dddd eeee', 'ffff e.g.  gg hh.'),
  },
  {
    name: 'glue:  an abbreviation beside a name, with the next word',
    options: narrow,
    code: block('aaaa bbbb cccc dddd eeee ffff gg Mr. Smith hh.'),
    output: block('aaaa bbbb cccc dddd eeee ffff gg', 'Mr. Smith hh.'),
  },
  {
    name: 'glue:  `St.` with a capitalized word before it',
    options: narrow,
    code: block('aaaa bbbb cccc dddd eeee ffff gg Elm St. and more words.'),
    output: block(
      'aaaa bbbb cccc dddd eeee ffff gg',
      'Elm St. and more words.',
    ),
  },
  {
    name: 'glue:  `St.` with a capitalized word after it',
    options: narrow,
    code: block('aaaa bbbb cccc dddd eeee ffff gg St. Paul hh.'),
    output: block('aaaa bbbb cccc dddd eeee ffff gg', 'St. Paul hh.'),
  },
  {
    name: 'glue:  the `et` and `al.` of `et al.`',
    options: narrow,
    code: block('aaaa bbbb cccc dddd eeee ffff gg et al. and hh.'),
    output: block('aaaa bbbb cccc dddd eeee ffff gg', 'et al. and hh.'),
  },
  {
    name: 'glue:  a period that one space and `St.` follow, with `St.`',
    options: narrow,
    code: block('aaaa bbbb cccc dddd eeee ffff Paul. St. Paul is here.'),
    output: block('aaaa bbbb cccc dddd eeee ffff', 'Paul. St. Paul is here.'),
  },
  {
    name: 'glue:  a period that two spaces and `St.` follow, with `St.`',
    options: narrow,
    code: block('aaaa bbbb cccc dddd eeee Paul.  St. Paul here.'),
    output: block('aaaa bbbb cccc dddd', 'eeee Paul.  St. Paul here.'),
  },
  {
    name: 'with `orphans.sentence` off, no glue keeps a sentence end together',
    errors: [{ messageId: 'join' }],
    options: [{ width: 40, orphans: { sentence: false }, widows: 0 }],
    code: block('aaaa bbbb cccc dddd eeee ffff', 'gggg hhhh.'),
    output: block('aaaa bbbb cccc dddd eeee ffff gggg', 'hhhh.'),
  },
  {
    name: 'with `orphans.clause` off, a single word may follow a comma',
    errors: [{ messageId: 'join' }],
    options: [{ width: 40, orphans: { clause: false } }],
    code: block('aaaa bbbb cccc dddd eeee ffff,', 'gggg hhhh iiii jjjj.'),
    output: block('aaaa bbbb cccc dddd eeee ffff, gggg', 'hhhh iiii jjjj.'),
  },
  {
    name: 'with `orphans.paren` off, the first word inside `(` may end a line',
    errors: [{ messageId: 'join' }],
    options: [{ width: 40, orphans: { paren: false } }],
    code: block('aaaa bbbb cccc dddd eeee ffff', '(gggg hhhh iiii) jjjj kkkk.'),
    output: block(
      'aaaa bbbb cccc dddd eeee ffff (gggg',
      'hhhh iiii) jjjj kkkk.',
    ),
  },
  {
    name: 'with `names` off, a line may break between `Mr.` and a name',
    errors: [{ messageId: 'join' }],
    options: [{ width: 40, names: false }],
    code: block('aaaa bbbb cccc dddd eeee ffff gg', 'Mr. Smith hh.'),
    output: block('aaaa bbbb cccc dddd eeee ffff gg Mr.', 'Smith hh.'),
  },
  {
    name: 'with `shortWords` on, `a` moves to the next line with its word',
    options: narrow,
    code: block('aaaa bbbb cccc dddd eeee ffff gggg a', 'note and more.'),
    output: block('aaaa bbbb cccc dddd eeee ffff gggg', 'a note and more.'),
  },
  {
    name: 'with `shortWords` on, `an` and `I` never end a line',
    options: narrow,
    code: block(
      'aaaa bbbb cccc dddd eeee ffff gg an ox, hhhh iiii jjjj kkkk llll I',
      'said mmmm nnnn.',
    ),
    output: block(
      'aaaa bbbb cccc dddd eeee ffff gg',
      'an ox, hhhh iiii jjjj kkkk llll',
      'I said mmmm nnnn.',
    ),
  },
  {
    name: 'with `shortWords` on, a run of short words stays with the next word',
    options: narrow,
    code: block('aaaa bbbb cccc dddd eeee ffff gg x a b note.'),
    output: block('aaaa bbbb cccc dddd eeee ffff gg', 'x a b note.'),
  },
  {
    name: 'with `shortWords` on, a short word with a long word after it overflows',
    options: narrow,
    code: block(
      'aaaa bbbb a',
      'cccccccccccccccccccccccccccccccccccccc dddd eeee ffff.',
    ),
    output: block(
      'aaaa bbbb',
      'a cccccccccccccccccccccccccccccccccccccc',
      'dddd eeee ffff.',
    ),
  },
  {
    name: "with `shortWords` on, a tag's wrapped lines keep short words with the next word",
    options: narrow,
    code: block(
      '@param name - aaaa bbbb cccc dddd the',
      '              eeee ffff.',
    ),
    output: block(
      '@param name - aaaa bbbb cccc dddd',
      '              the eeee ffff.',
    ),
  },
  {
    name: 'with `hang` on, a word ending in a comma moves up to hang past the width',
    options: narrow,
    errors: [{ messageId: 'join' }],
    code: block('aaaa bbbb cccc dddd eeee ffff gggg', 'hh, iiii jjjj kkkk.'),
    output: block('aaaa bbbb cccc dddd eeee ffff gggg hh,', 'iiii jjjj kkkk.'),
  },
  {
    name: "with `hang` on, a tag's description may hang past the width",
    options: narrow,
    errors: [{ messageId: 'join' }],
    code: block(
      '@param name - aaaa bbbb cccc dddd',
      '              eee, ffff gggg.',
    ),
    output: block(
      '@param name - aaaa bbbb cccc dddd eee,',
      '              ffff gggg.',
    ),
  },
  {
    name: "with `hang` on, a list item's wrapped lines may hang past the width",
    options: narrow,
    errors: [{ messageId: 'join' }],
    code: block(
      'Text:',
      '',
      '- aaaa',
      '  bbbb cccc dddd eeee ffff gggg',
      '  hhhhh, iiii jjjj.',
    ),
    output: block(
      'Text:',
      '',
      '- aaaa',
      '  bbbb cccc dddd eeee ffff gggg hhhhh,',
      '  iiii jjjj.',
    ),
  },
  {
    name: 'with `hang` on, a one-liner still expands when its `*/` is past the width',
    options: narrow,
    code: '/** aaaa bbbb cccc dddd eeee ffff ggg. */\nexport const x = 1;\n',
    output: block('aaaa bbbb cccc dddd eeee ffff ggg.'),
  },
  {
    name: 'with `widows` on, words move down until the last line is long enough',
    options: [{ width: 40, widows: 0.5 }],
    errors,
    code: block('aaaa bbbb cccc dddd eeee ffff gggg', 'hhhh iiii.'),
    output: block('aaaa bbbb cccc dddd eeee', 'ffff gggg hhhh iiii.'),
  },
  {
    name: 'with `widows` on, the last line may not end right of the line before it',
    options: [{ width: 40, widows: 1 }],
    errors,
    code: block('aaaa bbbb cccc dddd eeee ffff gggg', 'hhhh iiii.'),
    output: block('aaaa bbbb cccc dddd eeee', 'ffff gggg hhhh iiii.'),
  },
  {
    name: 'with `widows` on, only the last two lines change',
    options: [{ width: 40, widows: 0.5 }],
    errors,
    code: block(
      'aaaa bbbb cccc dddd eeee ffff gggg',
      'hhhh iiii jjjj kkkk llll mmmm nnnn',
      'oo pp.',
    ),
    output: block(
      'aaaa bbbb cccc dddd eeee ffff gggg',
      'hhhh iiii jjjj kkkk llll',
      'mmmm nnnn oo pp.',
    ),
  },
  {
    name: "with `widows` on, a list item's last wrapped line is long enough",
    options: [{ width: 40, widows: 0.5 }],
    errors,
    code: block(
      'Text:',
      '',
      '- aaaa',
      '  bbbb cccc dddd eeee ffff gggg',
      '  hhhh ii.',
    ),
    output: block(
      'Text:',
      '',
      '- aaaa',
      '  bbbb cccc dddd eeee',
      '  ffff gggg hhhh ii.',
    ),
  },
  {
    name: 'two spaces after an abbreviation are kept, except beside a name other than `St.`',
    errors: [{ messageId: 'join' }],
    code: block(
      'Ask Mr.  Smith, e.g.  this one.  He lives on Elm',
      'St.  Then more.',
    ),
    output: block(
      'Ask Mr. Smith, e.g.  this one.  He lives on Elm St.  Then more.',
    ),
  },
  {
    name: 'a line break after an abbreviation counts as one space',
    errors: [{ messageId: 'join' }],
    code: block('Ask Mr.', 'Smith, e.g.', 'this one, at 5 p.m.', 'Then more.'),
    output: block('Ask Mr. Smith, e.g. this one, at 5 p.m.  Then more.'),
  },
  {
    name: 'C2:  no single word on the line after a comma',
    options: narrow,
    code: block('aaaa bbbb cccc dddd eeee ffff gggg, hhhh.'),
    output: block('aaaa bbbb cccc dddd eeee ffff', 'gggg, hhhh.'),
  },
  {
    // The code span can't share a line, so the line after `dddd,` is a single
    // word whatever the layout, and the other rules are kept where they can be.
    name: 'C2:  a single word after a comma when no layout avoids it',
    options: narrow,
    code: block(
      'aaaa bbbb cccc dddd, `eeee ffff gggg hhhh iiii jjjj kkkk llll`, mmmm nnnn.',
    ),
    output: block(
      'aaaa bbbb cccc dddd,',
      '`eeee ffff gggg hhhh iiii jjjj kkkk llll`,',
      'mmmm nnnn.',
    ),
  },
  {
    name: 'tag continuation lines are filled from the description column',
    options: narrow,
    code: block(
      'Does a thing.',
      '',
      '@param name - the description, which is long enough to wrap',
    ),
    output: block(
      'Does a thing.',
      '',
      '@param name - the description,',
      '              which is long enough',
      '              to wrap',
    ),
  },
  {
    name: 'a `{Type}` head moves the description column',
    options: narrow,
    code: block('@param {string} s - aaaa bbbb cccc dddd eeee.'),
    output: block(
      '@param {string} s - aaaa bbbb cccc',
      '                    dddd eeee.',
    ),
  },
  {
    name: '`@returns` lines hang under the description, with or without a type',
    errors: Array(2).fill({ messageId: 'break' }),
    options: narrow,
    code: block(
      '@returns aaaa bbbb cccc dddd eeee ffff gggg.',
      '@returns {Foo} aaaa bbbb cccc dddd eeee ffff.',
    ),
    output: block(
      '@returns aaaa bbbb cccc dddd eeee',
      '         ffff gggg.',
      '@returns {Foo} aaaa bbbb cccc dddd',
      '               eeee ffff.',
    ),
  },
  {
    // `MAX_HEAD` is 45:  `@param {string} ` is 16, the name 26 or 27, ` - ` 3.
    name: 'a head of 45 columns keeps its description beside it, a wider one not',
    errors: Array(2).fill({ messageId: 'break' }),
    code: block(
      '@param {string} abcdefghijklmnopqrstuvwxyz - the description, which is long enough to wrap',
      '@param {string} abcdefghijklmnopqrstuvwxyzz - the description, which is long enough to wrap',
    ),
    output: block(
      '@param {string} abcdefghijklmnopqrstuvwxyz - the description, which is long',
      '                                             enough to wrap',
      '@param {string} abcdefghijklmnopqrstuvwxyzz -',
      '  the description, which is long enough to wrap',
    ),
  },
  {
    name: "a wide head's description moves below it, two spaces in",
    code: [
      'class A {',
      '  /**',
      "   * @param {import('eslint').Rule.RuleContext} context - the rule context,",
      '   *   which is what ESLint passes to a rule, and long enough to wrap',
      "   * @returns {import('eslint').Rule.RuleListener} the listeners",
      '   */',
      '  m() {}',
      '}',
      '',
    ].join('\n'),
    output: [
      'class A {',
      '  /**',
      "   * @param {import('eslint').Rule.RuleContext} context -",
      '   *   the rule context, which is what ESLint passes to a rule, and long',
      '   *   enough to wrap',
      "   * @returns {import('eslint').Rule.RuleListener} the listeners",
      '   */',
      '  m() {}',
      '}',
      '',
    ].join('\n'),
  },
  {
    name: 'a `{Type}` with braces inside is one token of the head',
    code: block(
      '@returns {{ a: string, b: number }[] | null} the result, which is long enough to wrap',
    ),
    output: block(
      '@returns {{ a: string, b: number }[] | null} the result, which is long',
      '                                             enough to wrap',
    ),
  },
  {
    name: "a one-liner with a wide head expands when it doesn't fit",
    code: '/** @returns {{ aaaaaaaaaaaaaaaa: number, b: string }} the thing, which is long, and longer still */\nexport const x = 1;\n',
    output: block(
      '@returns {{ aaaaaaaaaaaaaaaa: number, b: string }}',
      '  the thing, which is long, and longer still',
    ),
  },
  {
    name: 'a wide head split across lines is joined when the tag fits on one',
    errors: [{ messageId: 'join' }],
    code: block(
      '@param {string} abcdefghijklmnopqrstuvwxyzz -',
      '  fits on one line',
    ),
    output: block(
      '@param {string} abcdefghijklmnopqrstuvwxyzz - fits on one line',
    ),
  },
  {
    // ` * ` is 3 and the head 46, so 29 columns of description fit in 78.
    name: 'a wide head one column too wide for one line splits',
    code: block(
      '@param {string} abcdefghijklmnopqrstuvwxyzz - aaaaaaaaa bbbbbbbbb cccccccccc',
    ),
    output: block(
      '@param {string} abcdefghijklmnopqrstuvwxyzz -',
      '  aaaaaaaaa bbbbbbbbb cccccccccc',
    ),
  },
  {
    name: 'a misaligned block that also needs reflowing is reflowed',
    errors: [{ messageId: 'join' }],
    options: narrow,
    code: block('@param name - aaaa bbbb', '  cccc dddd eeee ffff gggg.'),
    output: block(
      '@param name - aaaa bbbb cccc dddd',
      '              eeee ffff gggg.',
    ),
  },
  {
    name: 'a code span is unbreakable',
    options: narrow,
    code: block('aaaa bbbb cccc dddd `a code span` eeee ffff.'),
    output: block('aaaa bbbb cccc dddd `a code span`', 'eeee ffff.'),
  },
  {
    name: 'links and `{...}` are unbreakable',
    options: narrow,
    code: block(
      'aaaa bbbb cccc see [the docs](https://x.y) and {@link Foo bar}.',
    ),
    output: block(
      'aaaa bbbb cccc see',
      '[the docs](https://x.y)',
      'and {@link Foo bar}.',
    ),
  },
  {
    name: 'bullets, numbered lists and tables are kept as they are',
    errors: [{ messageId: 'join' }],
    options: narrow,
    code: block(
      'aaaa bbbb',
      'cccc dddd:',
      '',
      '- a bullet line that is far too long to fit.  Kept.',
      '- another  one',
      '1. a numbered  one',
      '| a | table  |',
    ),
    output: block(
      'aaaa bbbb cccc dddd:',
      '',
      '- a bullet line that is far too long to fit.  Kept.',
      '- another  one',
      '1. a numbered  one',
      '| a | table  |',
    ),
  },
  {
    name: "a list item's wrapped lines are flowed under its text",
    errors: [{ messageId: 'join' }],
    options: narrow,
    code: block(
      '- an item',
      'whose wrapped lines run on',
      'and on, under its marker',
      '  10.   a nested one, with',
      'more',
    ),
    output: block(
      '- an item',
      '  whose wrapped lines run on and on,',
      '  under its marker',
      '  10.   a nested one, with',
      '      more',
    ),
  },
  {
    name: 'fenced code is kept as it is',
    errors: [{ messageId: 'join' }],
    options: narrow,
    code: block(
      'aaaa',
      'bbbb.',
      '',
      '```',
      'const  aVeryLongLineOfCodeThatIsWiderThanForty = 1;',
      '```',
    ),
    output: block(
      'aaaa bbbb.',
      '',
      '```',
      'const  aVeryLongLineOfCodeThatIsWiderThanForty = 1;',
      '```',
    ),
  },
  {
    name: '`@example` is kept as it is, up to the next tag',
    errors: Array(2).fill({ messageId: 'join' }),
    options: narrow,
    code: block(
      'aaaa',
      'bbbb.',
      '',
      '@example',
      'foo(  a,  b );  // a long comment that goes past forty',
      '@returns the',
      '         result',
    ),
    output: block(
      'aaaa bbbb.',
      '',
      '@example',
      'foo(  a,  b );  // a long comment that goes past forty',
      '@returns the result',
    ),
  },
  {
    name: "a one-liner expands when it doesn't fit",
    code: [
      'class A {',
      '  /** A one-line block whose text is too long to fit on one line, so it expands. */',
      '  x = 1;',
      '}',
      '',
    ].join('\n'),
    output: [
      'class A {',
      '  /**',
      '   * A one-line block whose text is too long to fit on one line, so it expands.',
      '   */',
      '  x = 1;',
      '}',
      '',
    ].join('\n'),
  },
  {
    name: 'a .ts file',
    errors: [{ messageId: 'join' }],
    filename: 'x.ts',
    languageOptions: { parser: ts.parser },
    code: block('@returns {Promise<void>} once it is', 'done.'),
    output: block('@returns {Promise<void>} once it is done.'),
  },
  {
    name: "a .gts class body is checked, and its <template>'s comments aren't",
    filename: 'x.gts',
    languageOptions: { parser: ember.parser },
    code: [
      "import Component from '@glimmer/component';",
      '',
      '/**',
      ' * A component.',
      ' * It renders.',
      ' */',
      'export default class Foo extends Component {',
      '  <template>',
      '    {{!-- /** Not.',
      '    JSDoc. */ --}}',
      '    <!-- /** Not.',
      '    JSDoc. */ -->',
      '  </template>',
      '}',
      '',
    ].join('\n'),
    output: [
      "import Component from '@glimmer/component';",
      '',
      '/**',
      ' * A component.  It renders.',
      ' */',
      'export default class Foo extends Component {',
      '  <template>',
      '    {{!-- /** Not.',
      '    JSDoc. */ --}}',
      '    <!-- /** Not.',
      '    JSDoc. */ -->',
      '  </template>',
      '}',
      '',
    ].join('\n'),
    errors: [{ messageId: 'join' }],
  },
  {
    name: 'the two words around a break that goes wrong are reported',
    options: narrow,
    code: block(
      'aaaa',
      'bbbb cccc dddd eeee ffff gggg hhhh iiii',
      'jjjj kkkk.',
    ),
    output: block('aaaa bbbb cccc dddd eeee ffff gggg', 'hhhh iiii jjjj kkkk.'),
    // Only the first break is reported, since the rest follow from it.
    errors: [
      { messageId: 'join', line: 2, column: 4, endLine: 3, endColumn: 8 },
    ],
  },
  {
    name: 'once the breaks meet again, the next that goes wrong is reported',
    options: narrow,
    code: block(
      'aaaa bbbb cccc dddd eeee ffff',
      'gggg hhhh iiii jjjj kkkk llll mmmm nnnn',
      'oooo pppp qqqq rrrr ssss tttt uuuu',
      'vvvv wwww',
      'xxxx yyyy zzzz.',
    ),
    output: block(
      'aaaa bbbb cccc dddd eeee ffff gggg',
      'hhhh iiii jjjj kkkk llll mmmm nnnn',
      'oooo pppp qqqq rrrr ssss tttt uuuu',
      'vvvv wwww xxxx yyyy zzzz.',
    ),
    errors: [
      { messageId: 'join', line: 2, column: 29, endLine: 3, endColumn: 8 },
      { messageId: 'join', line: 5, column: 9, endLine: 6, endColumn: 8 },
    ],
  },
].map((c) => ({ errors, ...c }));

// The safety net:  `\u0001` is the reflow's own stand-in for a masked space,
// so a block holding one would come out with a space in its place.  That
// changes a word, so the rule reports it without a fix.
invalid.push({
  name: 'no fix when a reflow would change more than whitespace',
  code: block('a\u0001b  c.'),
  output: null,
  errors: [{ messageId: 'unsafe' }],
});
