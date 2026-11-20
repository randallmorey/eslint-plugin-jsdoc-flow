// Random JSDoc blocks for the property tests, built from the pieces the rules
// care about:  prose, tags, bullets, fences, `@example`, braces, code spans,
// abbreviations, links, odd stars, exotic whitespace, and both line endings.
import fc from 'fast-check';

const split = (s) => s.split(' ');
export const WORDS = [
  ...split('the a an I value returns end. end! end? end: end; end, Then Smith'),
  ...split('e.g. i.e. etc. Mr. Dr. St. Paul vs. No. 5 U.S. et al. approx.'),
  ...split('foo() `code` ``a`b`` {@link Foo} {@link Foo|bar} [x](http://y)'),
  ...split('[opt] [a=1] http://example.com/a.b (paren paren) "quoted"'),
  ...split('- -- \u2014 | 1. 2) * + # > <b> </b> <br> \\ ... { } [ ] @ a@b.c'),
  ...split(
    '$x _y_ **b** ^ ~~~ ``` <pre> </pre> v1.2.3 \u00e9t\u00e9 \u65e5\u672c',
  ),
  ...split('aVeryLongIdentifierThatGoesOnAndOn Label: x; y: (a, b) {Type}'),
  ...split('{string} {{ a: 1 }}'),
  '`two  spaces`',
];
const GAPS = [
  ' ',
  ' ',
  ' ',
  ' ',
  '  ',
  '   ',
  '\t',
  '\u00a0',
  '\u200b',
  ' \u3000',
];
const STARTS = [
  ...Array(8).fill(''),
  ...split('- * 1. 2) # > | --- === |---|---| ^^^ ``` ```js ~~~ <pre> </pre>'),
  ...['    ', '  ', '\t', '@example', '@typedef {object} T', '@license '],
  ...['- ', ' - ', '  - ', '   * ', '1. ', ' 10. ', '     - '],
  ...['@param x - ', '@param {string} x ', '@param {{\n a: string\n}} o - '],
  '@param {string} aVeryLongParameterNameIndeed - ',
  ...['@returns ', '@returns {number} ', '@see ', '@deprecated '],
  ...['@throws {Error} ', '@property {string} [a=1] - '],
];
export const STARS = [' * ', ' * ', ' * ', ' *  ', ' *', '* ', '   * ', ' *\t'];
export const INDENTS = ['', '', '  ', '    ', '\t'];

const gap = fc.constantFrom(...GAPS);
const join = (words) => words.map(([g, w], i) => (i ? g : '') + w).join('');
const line = fc
  .tuple(
    fc.constantFrom(...STARTS),
    fc.array(fc.tuple(gap, fc.constantFrom(...WORDS)), { maxLength: 14 }),
    fc.constantFrom('', '', '', '', '  ', ' '),
  )
  .map(([start, words, end]) => (start + join(words) + end).split('\n'));

// A row of a list laid out in two columns, with words from a short list, so
// two rows' gaps often end in the same place, and sometimes don't.
const LEFT = split('a bb `c d` end. Label: ccc `{ e }`');
const row = fc
  .tuple(
    fc.constantFrom('- ', '-   ', ' * ', '1. '),
    fc.constantFrom(...LEFT),
    fc.constantFrom(' ', '  ', '   ', '    ', '  \u00a0', ' \t '),
    fc.constantFrom(
      '',
      '...',
      '....',
      '.....',
      '-----',
      '\u00b7\u00b7\u00b7\u00b7',
    ),
    fc.constantFrom(' ', '  ', ''),
    fc.array(fc.tuple(gap, fc.constantFrom(...WORDS)), {
      minLength: 1,
      maxLength: 4,
    }),
  )
  .map(([start, left, before, leader, after, words]) => [
    start + left + before + (leader && leader + after) + join(words),
  ]);

export const settings = fc.record({
  width: fc.constantFrom(40, 60, 80, 100),
  spaces: fc.constantFrom(1, 2),
  preformatted: fc.boolean(),
});

/**
 * Builds a block from its body lines, starring them with `stars` in turn.
 * With `open`, the first line's text goes on the `/**` line, after what
 * follows its star, and with `close`, the `*\/` goes on the last line.
 */
export const build = (indent, stars, lines, { open, close } = {}) => {
  const body = lines.map(
    (l, i) => indent + (l ? stars[i % stars.length] + l : ' *'),
  );
  const first = open && lines[0] ? body.shift() : undefined;
  const opener = first ? first.replace(/^\s*\*/, '/**') : `${indent}/**`;
  const last = close && body.length ? `${body.pop()} */` : `${indent} */`;
  return [opener, ...body, last].join('\n');
};

export const block = fc
  .tuple(
    fc.constantFrom(...INDENTS),
    fc.array(fc.constantFrom(...STARS), { minLength: 1, maxLength: 3 }),
    fc.array(
      fc.oneof(
        { weight: 6, arbitrary: line },
        { weight: 2, arbitrary: row },
        fc.constant(['']),
      ),
      {
        minLength: 1,
        maxLength: 9,
      },
    ),
    fc.integer({ min: 0, max: 7 }),
    fc.record({ open: fc.boolean(), close: fc.boolean() }),
  )
  .map(([indent, stars, lines, one, edges]) =>
    one === 0
      ? `${indent}/** ${lines[0].join(' ')} */`
      : build(indent, stars, lines.flat(), one < 4 ? edges : {}),
  );

/**
 * A file around one or two blocks, with code and comments that the rules must
 * leave as they are, in LF or CRLF.
 */
export const file = fc
  .tuple(fc.array(block, { minLength: 1, maxLength: 2 }), fc.boolean())
  .map(([blocks, crlf]) => {
    const code = [
      'const a  = 1; // a   line comment',
      ...blocks.flatMap((b, i) => [b, `export function f${i}(x,  y) {}`]),
      '/* a   plain\n *   comment */ const b = /** inline   doc */ 2;',
      '',
    ].join('\n');
    return crlf ? code.replace(/\n/g, '\r\n') : code;
  });

// Code kept as it is:  a fence, an `@example`, or `<pre>`, around code lines,
// with prose that opens and closes nothing around it.
const CODE = [
  'const a  =  1;',
  '\tif (x) {',
  '    return  y;  ',
  '}',
  '',
  '// a   comment',
  'foo(  bar ,baz )',
  '@decorator',
  '  * not a bullet',
];
const region = fc
  .tuple(
    fc.constantFrom('fence', 'tilde', 'example', 'pre'),
    fc.array(fc.constantFrom(...CODE), { minLength: 1, maxLength: 5 }),
  )
  .map(([kind, body]) => {
    if (kind === 'example') {
      return ['@example', ...body.filter((l) => !l.startsWith('@'))];
    }
    const [open, close] = {
      fence: ['```js', '```'],
      tilde: ['~~~', '~~~'],
      pre: ['<pre>', '</pre>'],
    }[kind];
    // An `@example` runs to the next tag.
    return [open, ...body, close];
  });
const PROSE = WORDS.filter((w) => !/^(?:```|~~~|<\/?pre>)$/.test(w));
const prose = fc
  .array(fc.tuple(gap, fc.constantFrom(...PROSE)), {
    minLength: 1,
    maxLength: 14,
  })
  .map(join);
const proseLine = fc.oneof(
  prose,
  prose.map((p) => `@param x - ${p}`),
  fc.constant(''),
);

/**
 * @param {string} line - a block's line
 * @returns {string} the line past its star and the space after it
 */
export const unstar = (line) => line.replace(/^\s*\* ?/, '');

/**
 * A block with one code region, and the region's lines as they are in it,
 * past their stars.
 */
export const withCode = fc
  .tuple(
    fc.array(proseLine, { maxLength: 4 }),
    region,
    fc.array(proseLine, { maxLength: 4 }),
    fc.constantFrom(...STARS),
    fc.constantFrom(...INDENTS),
  )
  .map(([before, lines, after, star, indent]) => {
    const rest = lines[0] === '@example' ? ['@returns it', ...after] : after;
    const all = [...before, ...lines, ...rest];
    const code = `${build(indent, [star], all)}\nfoo();\n`;
    const kept = lines.map((l) => (l ? unstar(star + l) : '')).join('\n');
    return { code, kept };
  });
