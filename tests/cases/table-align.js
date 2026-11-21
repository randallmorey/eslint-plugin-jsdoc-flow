// The `jsdoc-flow/table-align` cases, shared by its own tests and the tests
// of all the rules together.  A table's rows are padded so their pipes line
// up, and each misaligned row is reported from its text's start to its end.
import { block } from '../helpers.js';

// An error on a row at a line of the file, from its text to its end.
const at = (line, row, column = 4) => ({
  messageId: 'table',
  line,
  column,
  endLine: line,
  endColumn: column + row.length,
});

const narrow = { 'jsdoc-flow': { width: 40 } };

export const tableValid = [
  {
    name: 'an aligned table',
    code: block(
      '| Option   | Default | Purpose           |',
      '| ---      | ---     | ---               |',
      '| `spaces` | `2`     | Sentence gap      |',
      '| `width`  | `80`    | Target line width |',
    ),
  },
  {
    name: 'an aligned table with no edge pipes, its columns aligned',
    code: block(
      'Files | Workers | Speed',
      ':---  |  :---:  |  ---:',
      'a     |    b    |     1',
      'ccc   |  dddd   |    22',
    ),
  },
  {
    name: 'a table too wide to align, with one space beside each pipe',
    settings: narrow,
    code: block(
      '| Option | Purpose |',
      '| --- | --- |',
      '| `width` | The target line width, prefix included |',
    ),
  },
  {
    name: 'a row with fewer cells, and an empty cell',
    code: block('| a   | b |', '| --- | - |', '|     | 1 |', '| 2   |'),
  },
  {
    name: 'a pipe escaped, in a code span or not',
    code: block('| a      | b   |', '| ---    | --- |', '| `x\\|y` | z\\| |'),
  },
  {
    name: 'a row with only an escaped pipe',
    code: block('a      | b', '---    | ---', 'c \\| d'),
  },
  {
    name: 'a tab in a cell is one column',
    code: block('| a\tb | c   |', '| --- | --- |'),
  },
  {
    name: 'a tab and whitespace at the end are left to their rules',
    code: block(' \u200b| a\t| b |  ', '| - | - |'),
  },
  {
    name: 'rows indented differently keep their indentation',
    code: block('| a | b |', '  | - | - |', '| 1 | 2 |'),
  },
  {
    name: 'a table in an `@example`',
    code: block('@example', '| a | b |', '|---|---|', '| 1 | 2 |'),
  },
  {
    name: 'a table in a fence',
    code: block('```md', '| a | b |', '|---|---|', '| 1 | 2 |', '```'),
  },
  {
    name: 'a header row with a cell more than its delimiter row',
    code: block('| a | b |', '|---|', '| 1 | 2 |'),
  },
  {
    name: 'a row with more cells than the header row',
    code: block('| a | b |', '|---|---|', '| 1 | 2 | 3 |'),
  },
  {
    name: 'a delimiter cell GFM reads as no delimiter',
    code: block('| a | b |', '| - - |---|', '| 1 | 2 |'),
  },
  {
    name: 'a row with no pipe in a table with no edge pipes',
    code: block('a | b', '--|--', '1 | 2', 'three'),
  },
  {
    name: 'a row that is a heading, in a table with no edge pipes',
    code: block('a | b', '--|--', '1 | 2', '# c | d'),
  },
  {
    name: 'a header row that is a heading',
    code: block('# a | b', '--|--', '1 | 2'),
  },
  {
    name: 'a header row that is a list item',
    code: block('- a | b', '--|--', '1 | 2'),
  },
  {
    name: 'a delimiter row with no header row',
    code: block('|---|---|', '| 1 | 2 |'),
  },
  {
    name: 'a delimiter row right after a table, which GFM reads as a row',
    code: block('| a | bb |', '|---|---|', '| 1 | 2 |', '--|--', '3 | 4'),
  },
  {
    name: 'a wide character',
    code: block('| a | \u65e5\u672c |', '|---|---|', '| 1 | 2 |'),
  },
  {
    name: 'an emoji',
    code: block('| a | \u{1f600} |', '|---|---|', '| 1 | 2 |'),
  },
  {
    name: 'a combining mark',
    code: block('| a | e\u0301 |', '|---|---|', '| 1 | 2 |'),
  },
  {
    name: 'a one-line block',
    code: '/** | a | b | */\nexport const x = 1;\n',
  },
];

export const tableInvalid = [
  {
    name: 'a table with its columns ragged',
    code: block(
      '| Option | Default | Purpose |',
      '|---|---|---|',
      '| `spaces` | `2` | Sentence gap |',
      '| `width` | `80` | Target line width |',
    ),
    output: block(
      '| Option   | Default | Purpose           |',
      '| ---      | ---     | ---               |',
      '| `spaces` | `2`     | Sentence gap      |',
      '| `width`  | `80`    | Target line width |',
    ),
    errors: [
      at(2, '| Option | Default | Purpose |'),
      at(3, '|---|---|---|'),
      at(4, '| `spaces` | `2` | Sentence gap |'),
      at(5, '| `width` | `80` | Target line width |'),
    ],
  },
  {
    name: 'a table with no edge pipes, its columns aligned',
    code: block(
      'Files | Workers | Speed',
      ':--- | :---: | ---:',
      'a | b | 1',
      'ccc | dddd | 22',
    ),
    output: block(
      'Files | Workers | Speed',
      ':---  |  :---:  |  ---:',
      'a     |    b    |     1',
      'ccc   |  dddd   |    22',
    ),
    errors: [
      at(3, ':--- | :---: | ---:'),
      at(4, 'a | b | 1'),
      at(5, 'ccc | dddd | 22'),
    ],
  },
  {
    name: 'a centered column with an odd gap puts the extra space after',
    code: block('| a | b |', '|:----:|---|', '| 1 | 2 |'),
    output: block('|   a    | b   |', '| :----: | --- |', '|   1    | 2   |'),
    errors: [at(2, '| a | b |'), at(3, '|:----:|---|'), at(4, '| 1 | 2 |')],
  },
  {
    name: 'a row with fewer cells, and an empty cell',
    code: block('| a | b |', '|---|-|', '| | 1 |', '| 2 |'),
    output: block('| a   | b |', '| --- | - |', '|     | 1 |', '| 2   |'),
    errors: [
      at(2, '| a | b |'),
      at(3, '|---|-|'),
      at(4, '| | 1 |'),
      at(5, '| 2 |'),
    ],
  },
  {
    name: 'a pipe escaped, in a code span or not',
    code: block('| a | b |', '|---|---|', '| `x\\|y` | z\\| |'),
    output: block('| a      | b   |', '| ---    | --- |', '| `x\\|y` | z\\| |'),
    errors: [at(2, '| a | b |'), at(3, '|---|---|')],
  },
  {
    name: 'a pipe in a code span splits its cell, as in GFM',
    code: block('| a | b | c |', '|---|---|---|', '| `x|y` | z |'),
    output: block(
      '| a   | b   | c   |',
      '| --- | --- | --- |',
      '| `x  | y`  | z   |',
    ),
    errors: [
      at(2, '| a | b | c |'),
      at(3, '|---|---|---|'),
      at(4, '| `x|y` | z |'),
    ],
  },
  {
    name: 'a table too wide to align gets one space beside each pipe',
    settings: narrow,
    code: block(
      '|Option|Purpose|',
      '|  ---  |---|',
      '|`width`|  The target line width, prefix included|',
    ),
    output: block(
      '| Option | Purpose |',
      '| --- | --- |',
      '| `width` | The target line width, prefix included |',
    ),
    errors: [
      at(2, '|Option|Purpose|'),
      at(3, '|  ---  |---|'),
      at(4, '|`width`|  The target line width, prefix included|'),
    ],
  },
  {
    name: "a table in a tag's description",
    code: block(
      '@param options - the options:',
      '| Name | Use |',
      '|--|--|',
      '| `a` | the first one |',
      '@returns the result',
    ),
    output: block(
      '@param options - the options:',
      '| Name | Use           |',
      '| --   | --            |',
      '| `a`  | the first one |',
      '@returns the result',
    ),
    errors: [
      at(3, '| Name | Use |'),
      at(4, '|--|--|'),
      at(5, '| `a` | the first one |'),
    ],
  },
  {
    name: 'a fix removes the whitespace after its row',
    code: block('| a | bb |  ', '|-|-|', '| ccc | d |'),
    output: block('| a   | bb |', '| -   | -  |', '| ccc | d  |'),
    errors: [at(2, '| a | bb |'), at(3, '|-|-|'), at(4, '| ccc | d |')],
  },
  {
    name: 'a fix makes every whitespace character on its row a space',
    code: block(' \u200b| a\t| bb |', '| - | -\u00a0|', '| `c\td` | e |'),
    output: block('  | a     | bb |', '| -     | -  |', '| `c d` | e  |'),
    errors: [
      at(2, '| a\t| bb |', 6),
      at(3, '| - | -\u00a0|'),
      at(4, '| `c\td` | e |'),
    ],
  },
  {
    name: 'rows indented differently keep their indentation',
    code: block('| a | b |', '  |---|-|', '|1|2|'),
    output: block('| a   | b |', '  | --- | - |', '| 1   | 2 |'),
    errors: [at(2, '| a | b |'), at(3, '|---|-|', 6), at(4, '|1|2|')],
  },
  {
    name: 'a table beside the delimiters',
    code: '/** | a | bb |\n * |-|-|\n * | ccc | d | */\nexport const x = 1;\n',
    output:
      '/** | a   | bb |\n * | -   | -  |\n * | ccc | d  | */\nexport const x = 1;\n',
    errors: [at(1, '| a | bb |', 5), at(2, '|-|-|'), at(3, '| ccc | d |')],
  },
];
