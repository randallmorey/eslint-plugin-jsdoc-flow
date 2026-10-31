// The cases of `jsdoc-flow/no-exotic-whitespace`, shared by its own tests and
// the tests of all the rules together.  Each run of whitespace with a tab or
// another character that isn't a plain space in it is reported on its own,
// from the word before it through the word after it, and the fix makes each
// of its characters a plain space, so no gap's width changes.  The valid cases
// are valid for the spacing rules too, and each invalid case's gaps are as
// wide as they should be, so it's valid for the spacing and edge rules.
import { block } from '../helpers.js';

const errors = (n) =>
  Array.from({ length: n }, () => ({ messageId: 'exotic' }));

export const exoticValid = [
  {
    name: 'tabs in fenced code, indented code and `@example` are kept',
    code: block(
      'Some code:',
      '',
      '```',
      'if (a)\t{',
      '```',
      '',
      '    foo(\tbar);',
      '',
      '@example',
      '\tfoo();',
    ),
  },
  {
    name: 'the tabs that indent a block are kept',
    code: 'class A {\n\t/**\n\t * One.\n\t */\n\tx = 1;\n}\n',
  },
  {
    name: 'joiners are not spaces',
    code: block('Joined a\u200db, a\u200cb and a\u2060b.'),
  },
];

export const exoticInvalid = [
  {
    name: 'a tab, a no-break space and other Unicode spaces between words',
    code: block('One\ttwo\u00a0three\u2003four\u202ffive\u3000six.'),
    output: block('One two three four five six.'),
    errors: errors(5),
  },
  {
    name: 'a run of them, as wide as the gap should be',
    code: block('One sentence.\t\u00a0Then more:\u00a0 and more.'),
    output: block('One sentence.  Then more:  and more.'),
    errors: errors(2),
  },
  {
    name: 'a zero-width space splits a word, and a byte order mark is a space',
    code: block('Long\u200bwords break, and\ufeffhere too.'),
    output: block('Long words break, and here too.'),
    errors: errors(2),
  },
  {
    name: 'the words around the gap are reported, at their line and columns',
    code: block('Fine.', 'Here\tand there.'),
    output: block('Fine.', 'Here and there.'),
    errors: [
      { messageId: 'exotic', line: 3, column: 4, endLine: 3, endColumn: 12 },
    ],
  },
  {
    name: "between a line's `*` and its text",
    code: '/**\n *\tOne.\n */\nexport const x = 1;\n',
    output: block('One.'),
    errors: [
      { messageId: 'exotic', line: 2, column: 2, endLine: 2, endColumn: 8 },
    ],
  },
  {
    name: "a one-liner's `/**` and `*/`",
    code: '/**\u00a0One-liner.\u00a0*/\nexport const x = 1;\n',
    output: '/** One-liner. */\nexport const x = 1;\n',
    errors: [
      { messageId: 'exotic', line: 1, column: 1, endLine: 1, endColumn: 15 },
      { messageId: 'exotic', line: 1, column: 5, endLine: 1, endColumn: 18 },
    ],
  },
  {
    name: 'list items, table rows and code spans',
    code: block('-\ta bullet', '| a\u00a0| b |', '', 'Some `code\tspan` here.'),
    output: block('- a bullet', '| a | b |', '', 'Some `code span` here.'),
    errors: errors(3),
  },
  {
    name: "a tag's head and description",
    code: block('@param\tname\u00a0-\u00a0the\tname'),
    output: block('@param name - the name'),
    errors: errors(4),
  },
];

// A case with gaps that are too wide or too narrow as well as made of tabs,
// for the tests of all the rules together.
export const exoticMixed = [
  {
    name: 'whitespace of every kind',
    code: block(
      'One sentence.\tThen\t\ttwo:\tthree.',
      '-\t\tan item',
      '@param\t\tname\t-\tthe name',
    ),
  },
];
