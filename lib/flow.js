/**
 * The text engine behind the rules.  Text is split into tokens, glued into
 * units that a line never breaks inside, and filled greedily into lines
 * (see `fillPara`).  The other rules find what a reflow would fix, so `--fix`
 * settles on the same block in any order.
 */

/**
 * The nominal width of a JSDoc line, prefix included.
 */
export const WIDTH = 80;

/**
 * The columns kept free at the right of the nominal width, so hung
 * punctuation still ends short of the editor's edge.
 */
const MARGIN = 2;

/**
 * The widest a tag's head may be by default, as a fraction of the nominal
 * width, and still have its description begin beside it.
 */
export const MAX_HEAD = 0.55;

/**
 * `reflow` and `tag-align` both find the head limit with this, so they agree.
 * It's a fraction of the nominal width, not of the fill width, so a head is
 * wide or not however its block is laid out.  It's rounded so a fraction's
 * binary error can't move it, as `0.57 * 100`, just under 57, would.
 *
 * @param {number} nominal - the nominal line width
 * @param {number} [maxHead] - the widest head, as a fraction of that
 * @returns {number} the widest head, in columns
 */
const headLimit = (nominal, maxHead = MAX_HEAD) =>
  Math.round(maxHead * nominal);

/**
 * The whitespace other than line breaks that may sit inside a non-breaking
 * span, and U+200B, which the rules read as whitespace too.
 */
const SPACES =
  ' \t\v\f\u00a0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007' +
  '\u2008\u2009\u200a\u202f\u205f\u3000\ufeff\u200b';

/**
 * Control characters that stand in for each of `SPACES` inside a non-breaking
 * span, so its whitespace comes back as it was.  They skip those that
 * `\s` matches.
 */
const MASKS = [...SPACES]
  .map((_, i) => String.fromCharCode(i < 8 ? i + 1 : i + 6))
  .join('');

/**
 * Matches a whitespace character other than a plain space, including U+200B,
 * which `\s` doesn't match.
 */
const EXOTIC = /[^\S ]|\u200b/g;

/**
 * @param {string} s - text
 * @returns {string} the text without the whitespace at its ends,
 *                   reading U+200B as whitespace,
 *                   as `no-exotic-whitespace` would
 */
export const strip = (s) => s.replace(/^[\s\u200b]+|[\s\u200b]+$/g, '');

/**
 * Matches a token that ends in a common abbreviation, such as `e.g.` or `Dr.`,
 * whose period may not end a sentence (see `abbrInSentence`).  `al` stands
 * for the `al.` of `et al.`.
 */
const ABBR =
  /(^|[^a-z])(e\.g|i\.e|etc|al|a\.k\.a|w\.r\.t|esp|incl|approx|vs|cf|fig|eq|sec|ch|vol|pp|no|nos|a\.m|p\.m|a\.d|b\.c|a\.c\.e|b\.c\.e|dr|mr|mrs|ms|prof|st|jr|sr|inc|ltd|corp|co)\.$/i;

/**
 * The abbreviations in `ABBR` that come beside a name, so a capitalized word
 * after one doesn't show that a sentence ended, as in `Mr. Smith`
 * and `Elm St. Station`.
 */
const BESIDE_NAME = new Set('dr mr mrs ms prof st vs cf'.split(' '));

/**
 * The abbreviations in `ABBR` that are ordinary words too, so only a number
 * after one shows it is an abbreviation, as in `No. 5` and unlike
 * "is no.  Then".
 */
const BEFORE_NUMBER = new Set('no nos'.split(' '));

/**
 * Matches a token that ends in a dotted initialism such as `U.S.`,
 * after which a capitalized word may continue a name.
 */
const INITIALISM = /(?:^|[^\p{L}\p{N}_$.])(?:\p{Lu}\.){2,}$/u;

/**
 * Matches a short word that `limits.shortWords` keeps off the end of a line:
 * `a`, `an`, `the`, or a one-letter word with no punctuation after it.
 */
const SHORT = /^[("'[*_]*(?:an|the|\p{L})$/iu;

/**
 * Matches a token that ends in closing punctuation, which `limits.hang` lets
 * hang past the width.
 */
const HANG = /[.,;:!?)\]'"\u2019\u201d]$/;

/**
 * Tags whose head includes a name, as in `@param name -`.
 */
const NAMED_TAGS = new Set(
  'param property prop template typedef arg argument'.split(' '),
);

/**
 * The `ReflowOptions` limits that can be turned off (see `index.d.ts`).
 *
 * @typedef {object} LimitOptions
 * @property {{ sentence?: boolean, clause?: boolean, paren?: boolean }} [orphans] -
 *   edge words of sentences, clauses, and parentheses
 * @property {boolean} [names] - keeps an abbreviation with the name beside it
 * @property {boolean} [shortWords] - keeps a short word with the next
 * @property {boolean} [hang] - lets closing punctuation hang past the width
 * @property {number} [widows] - the shortest last line, as a width fraction
 * @property {number} [maxHead] - the widest head with its
 *                                description beside it
 */

/**
 * The options of the functions that read a block, taken from the shared
 * settings so every rule reads a block the same way.
 *
 * @typedef {object} BlockOptions
 * @property {boolean} [preformatted] - whether to keep unfenced code
 * @property {1 | 2} [spaces] - the spaces after a sentence end or colon
 */

/**
 * The options of `reflowComment`.
 *
 * @typedef {BlockOptions & LimitOptions} ReflowOptions
 */

/**
 * The options of the functions that align tags.  `width` and `maxHead` decide
 * which heads are wide, and must match what `reflow` is given.
 *
 * @typedef {BlockOptions & { width?: number, maxHead?: number }} AlignOptions
 */

/**
 * The `ReflowOptions` limits as resolved values, with `maxHead` in columns
 * (see `headLimit`).
 *
 * @typedef {{ sentence: boolean, clause: boolean, paren: boolean, names: boolean, shortWords: boolean, hang: boolean, widows: number, maxHead: number }} Limits
 */

/**
 * @param {ReflowOptions} options - the options
 * @param {number} nominal - the nominal width of a line, prefix included
 * @returns {Limits} the limits they leave on
 */
const limitsOf = (
  {
    orphans = {},
    names = true,
    shortWords = true,
    hang = true,
    widows = 0.15,
    maxHead,
  },
  nominal,
) => ({
  sentence: orphans.sentence ?? true,
  clause: orphans.clause ?? true,
  paren: orphans.paren ?? true,
  names,
  shortWords,
  hang,
  widows,
  maxHead: headLimit(nominal, maxHead),
});

/**
 * @param {string} s - a trimmed body line or token
 * @returns {boolean} whether it starts a block tag such as `@param`
 */
const isTag = (s) => /^@[A-Za-z]/.test(s);

/**
 * Finds the tag a block's text begins with, reading a zero-width space as
 * whitespace, as `no-exotic-whitespace` would.
 *
 * @param {string} text - the block's text
 * @returns {string | undefined} the tag's name, without its `@`, if any
 */
export const leadingTag = (text) =>
  /^@([A-Za-z][\w-]*)/.exec(text.replace(EXOTIC, ' ').trimStart())?.[1];

/**
 * Whether a block is a `@ts-*` directive.  TypeScript reads one only from
 * a block's last line, so it must stay on one line however wide.
 *
 * @param {string} text - the block's text
 * @returns {boolean} whether it begins with a `@ts-*` tag
 */
export const isDirective = (text) => !!leadingTag(text)?.startsWith('ts-');

/**
 * Whether the `*` and `_` ending a token close emphasis rather than being
 * part of it, as in `.eslintrc.*` or `foo._`.  They must mirror the ones
 * opening the token, except that `**` may close what an earlier word opened.
 *
 * @param {string} base - a token, up to its closing marks
 * @param {string} marks - the `*` and `_` among them, in order
 * @returns {boolean} whether they close emphasis
 */
const closesEmphasis = (base, marks) => {
  const open = /^[("'[\u2018\u201c*_]*/.exec(base)?.[0] ?? '';
  return (
    (/^[\p{L}\p{N}`]/u.test(base.slice(open.length)) &&
      open.replace(/[^*_]/g, '') === [...marks].reverse().join('')) ||
    (/^\*{2,}$/.test(marks) && /[^*_.][.!?:]+$/.test(base))
  );
};

/**
 * Strips closing brackets, quotes, and emphasis, so `end.)` and `**end.**`
 * are seen to end in a period.
 *
 * @param {string} t - a token
 * @returns {string} the token without them
 */
const stripClose = (t) => {
  const close = /[)\]"'\u2019\u201d*_]+$/.exec(t)?.[0] ?? '';
  const base = t.slice(0, t.length - close.length);
  const marks = close.replace(/[^*_]/g, '');
  return !marks || closesEmphasis(base, marks)
    ? base
    : t.slice(0, t.length - close.replace(/^.*[*_]/, '').length);
};

/**
 * Whether a token starts with a capital, after any opening brackets, quotes,
 * and emphasis.  Code, numbers, and `{...}` don't count, since they're cased
 * the same anywhere.
 *
 * @param {string | undefined} t - a token, or undefined
 * @returns {boolean} whether it starts with a capital letter
 */
const capitalized = (t) => /^[("'[*_]*\p{Lu}/u.test(t ?? '');

/**
 * @param {string | undefined} t - a token, or undefined
 * @returns {boolean} whether it starts with a digit
 */
const numeric = (t) => /^[("'[*_]*\d/.test(t ?? '');

/**
 * @param {string} t - a token
 * @returns {string | undefined} the abbreviation it ends in, or undefined
 */
const abbrOf = (t) => ABBR.exec(t)?.[2].toLowerCase();

/**
 * Whether an abbreviation stays inside its sentence, as `e.g.` does,
 * rather than ending it, as `etc.` does in "and so on, etc.  Then".
 * Two spaces after one mark an end, since nothing else shows whether
 * a capitalized word after it continues a name.
 *
 * @param {string} t - a token ending in `.`
 * @param {string} [next] - the token after it
 * @param {boolean} [wide] - whether the token is wide
 * @returns {boolean} whether the sentence goes on past it
 */
const abbrInSentence = (t, next, wide) => {
  const word = abbrOf(t);
  if (word === 'st' || (!word && INITIALISM.test(t))) return !wide;
  if (word && BEFORE_NUMBER.has(word)) return !wide && numeric(next);
  return !!word && (BESIDE_NAME.has(word) || (!wide && !capitalized(next)));
};

/**
 * Whether a token ending in `.` stays inside its sentence because `St.`
 * follows it, as in "Mt. St. Helens", where only two spaces can show that
 * a sentence ended.
 *
 * @param {string} t - a token
 * @param {string} [next] - the token after it
 * @param {boolean} [wide] - whether the token is wide
 * @returns {boolean} whether `St.` follows a narrow token ending in `.`
 */
const beforeSt = (t, next, wide) =>
  !wide && t.endsWith('.') && abbrOf(next ?? '') === 'st';

/**
 * @param {string} t - a token
 * @param {string} [next] - the token after it
 * @param {boolean} [wide] - whether the token is wide
 * @returns {boolean} whether it ends a sentence
 */
const endsSentence = (t, next, wide) => {
  const base = stripClose(t);
  return (
    /[.!?]$/.test(base) &&
    !abbrInSentence(base, next, wide) &&
    !beforeSt(t, next, wide)
  );
};

/**
 * @param {string} t - a token
 * @returns {boolean} whether the token ends in a colon
 */
const endsColon = (t) => /:$/.test(stripClose(t));

/**
 * @param {string} t - a token
 * @param {string} [next] - the token after it
 * @param {boolean} [wide] - whether the token is wide
 * @param {1 | 2} [spaces] - the spaces after a sentence end or a colon
 * @returns {string} the space after the token on a line
 */
const sepAfter = (t, next, wide, spaces) =>
  spaces !== 1 && (endsSentence(t, next, wide) || endsColon(t)) ? '  ' : ' ';

/**
 * Whether a gap makes the token before it wide.  With one space, no token is
 * wide, since a fix would then stop a token ending its sentence, so a gap's
 * kind depends only on the words beside it.
 *
 * @param {string} gap - the whitespace after a token
 * @param {1 | 2} [spaces] - the spaces after a sentence end or a colon
 * @returns {boolean} whether the token is wide
 */
const wideIn = (gap, spaces) => spaces !== 1 && gap.length > 1;

/**
 * Matches a Markdown code span.  An unclosed run of backticks is plain text.
 */
const CODE_SPAN = /(?<!`)(`+)(?!`)[\s\S]*?(?<!`)\1(?!`)/g;

/**
 * @param {string} t - a token
 * @returns {string} the token with its code spans emptied
 */
const codeless = (t) => t.replace(CODE_SPAN, '``');

/**
 * Whether no space belongs between two words:  before closing punctuation,
 * or after a word ending in `(` or `[`.  Reflow joins such words into one
 * token, and `no-extra-punctuation-space` removes the space between them.
 *
 * @param {string} a - a word
 * @param {string} b - the word after it
 * @returns {boolean} whether no space belongs between them
 */
const tight = (a, b) =>
  /^(?:[)\]]*[,.;:]|[)\]]+)$/.test(b) ||
  /(?:^|[\p{L}\p{N}_$`'"*([])[([]$/u.test(a);

/**
 * @param {string[]} words - a run of words, in order
 * @returns {{ tokens: string[], last: number[], of: number[] }}
 *   the tokens that `tight` joins the words into, each token's last word
 *   index (`last`), and each word's token index (`of`)
 */
function joinTight(words) {
  /**
   * @type {string[]}
   */
  const tokens = [];
  /**
   * @type {number[]}
   */
  const last = [];
  const of = words.map((w, k) => {
    if (k > 0 && tight(words[k - 1], w)) tokens[tokens.length - 1] += w;
    else tokens.push(w);
    last[tokens.length - 1] = k;
    return tokens.length - 1;
  });
  return { tokens, last, of };
}

/**
 * Finds the punctuation a line break must not strand a word next to.
 * A call's or link's `)` and an abbreviation's period don't count.
 *
 * @param {string} t - a token
 * @param {string} [next] - the token after it
 * @param {boolean} [wide] - whether the token is wide
 * @returns {string} one character, or `''` if there is none
 */
const tailPunct = (t, next, wide) => {
  const bare = codeless(t.replace(/["'\u2019\u201d*_]+$/, ''));
  const last = bare.slice(-1);
  if (last === ')' && bare.includes('(', 1)) return '';
  if (last === '.' && abbrInSentence(bare, next, wide)) return '';
  if (beforeSt(t, next, wide)) return '';
  return /[,;:.!?)]/.test(last) ? last : '';
};

/**
 * Finds how many tokens make up a tag's head, which stays together.
 * `reflow` and `tag-align` share it, so they agree on the description column.
 *
 * @param {string[]} tokens - a tag's masked tokens
 * @param {string} [typed] - the tag's name, if `tokens` follow its `{Type}`
 * @returns {number} how many make up the head, as in `@param name -`
 */
function headSize(tokens, typed) {
  let head = 1;
  const name = typed ?? tokens[0].slice(1);
  if (!typed && tokens[head]?.startsWith('{')) head++;
  if (NAMED_TAGS.has(name) && tokens[head] && tokens[head] !== '-') head++;
  if (tokens[head] === '-') head++;
  return Math.min(head, tokens.length);
}

/**
 * Finds the `-` that ends a tag's head.  `tag-spacing` owns the one space on
 * either side of it, and a `-` glued to a word isn't a separator.
 *
 * @param {string[]} words - a paragraph's masked words
 * @param {string} [typed] - the tag's name (see `headSize`)
 * @returns {number} the separator's index among the words, or -1 if none
 */
function separatorOf(words, typed) {
  if (!typed && !isTag(words[0] ?? '')) return -1;
  const { tokens, last } = joinTight(words);
  const head = headSize(tokens, typed);
  return tokens[head - 1] === '-' ? last[head - 1] : -1;
}

/**
 * @param {number} column - a tag's head width
 * @param {number} limit - the widest head, in columns
 * @returns {number} how far past ` * ` its description's later lines start
 */
const hangOf = (column, limit) => (column <= limit ? column : 2);

/**
 * @param {string} s - masked text
 * @returns {string} the text with its masked whitespace restored
 */
const unmask = (s) => [...s].map((c) => SPACES[MASKS.indexOf(c)] ?? c).join('');

/**
 * @param {string} s - text
 * @returns {string} the text with code spans blanked to backticks
 */
const blankCode = (s) => s.replace(CODE_SPAN, (c) => '`'.repeat(c.length));

/**
 * Matches what `mask` makes unbreakable, in `blankCode` output:  a code span,
 * a link, the `{` of a `{@link ...}` or `{Type}`, or an `[optional]` name.
 */
const SPANS = /`+|\[[^\]]*\]\([^)]*\)|\{|\[[^\]]*\]/g;

/**
 * Pairs the braces in text in one pass, so text with many `{` is read in
 * linear time.
 *
 * @param {string} blanked - text, with its code spans blanked
 * @returns {Map<number, number>} the index just past each `{`'s closing `}`,
 *                                by the index of each `{` that has one
 */
function braceEnds(blanked) {
  const ends = new Map();
  const open = [];
  for (const m of blanked.matchAll(/[{}]/g)) {
    if (m[0] === '{') open.push(m.index);
    else if (open.length) ends.set(open.pop(), m.index + 1);
  }
  return ends;
}

/**
 * @param {string} s - text
 * @returns {string} the text with its whitespace masked, except line breaks
 */
const hide = (s) =>
  s.replace(/[^\S\n\r]|\u200b/g, (c) => MASKS[SPACES.indexOf(c)]);

/**
 * Masks the inner whitespace of the spans that `SPANS` matches,
 * making them unbreakable.  Line breaks stay.
 *
 * @param {string} s - a paragraph's text
 * @returns {string} the text with that whitespace masked
 */
function mask(s) {
  const blanked = blankCode(s);
  const ends = braceEnds(blanked);
  let out = '';
  let done = 0;
  SPANS.lastIndex = 0;
  for (let m = SPANS.exec(blanked); m; m = SPANS.exec(blanked)) {
    const end = m[0] === '{' ? (ends.get(m.index) ?? -1) : SPANS.lastIndex;
    if (end < 0) continue;
    out += s.slice(done, m.index) + hide(s.slice(m.index, end));
    done = SPANS.lastIndex = end;
  }
  return out + s.slice(done);
}

/**
 * @typedef {object} BodyLine
 * @property {string} raw - the line whole
 * @property {string} content - its text, without its ` * ` prefix
 * @property {number} offset - the column that text starts at
 * @property {number} at - the line's index in the block
 */

/**
 * A paragraph of a block, or a tag with its continuation lines.
 *
 * @typedef {object} Para
 * @property {'para'} type - what the item is
 * @property {boolean} tag - whether it's a tag
 * @property {string[]} parts - its lines' text, trimmed
 * @property {BodyLine[]} recs - its lines
 * @property {Bullet} [bullet] - the marker of the item it wraps
 * @property {string} [typed] - the tag's name, if it starts on the line
 *                              closing its `{Type}`
 */

const BULLET = /^(\s*)([-*+]|\d+[.)])(\s+)(\S+)/;

/**
 * The HTML elements whose block runs to their closing tag, blank lines and
 * all, as in Markdown.
 */
const VERBATIM_HTML = /^<(pre|script|style|textarea)(?:[\s>]|$)/i;

/**
 * The block-level HTML elements that a doc comment might hold,
 * without `<title>` and `<link>`, which are likelier placeholders in prose.
 */
const HTML_NAMES =
  'pre|script|style|textarea|address|article|aside|blockquote|center|dd|' +
  'details|dialog|div|dl|dt|fieldset|figcaption|figure|footer|form|' +
  'h[1-6]|header|hr|li|main|menu|nav|ol|p|section|summary|table|tbody|td|' +
  'tfoot|th|thead|tr|ul';

/**
 * Matches a line, or a token that would be one at a line's start, that opens
 * or closes an HTML block.
 */
const HTML_BLOCK = new RegExp(`^</?(?:${HTML_NAMES})(?:[\\s/>]|$)`, 'i');

const DELIMITER = /^(?=.*\|)[|:\s-]*-[|:\s-]*$/;

/**
 * Matches a line that makes the line above it a heading or a table's header.
 */
const UNDERLINE = new RegExp(`^=+$|^-{2,}$|${DELIMITER.source}`);

/**
 * Matches a line that's a construct only if it's the whole line:  a thematic
 * break, an underline, a bare list marker, or a link reference definition.
 * A space before that definition's colon is allowed,
 * since `no-extra-punctuation-space` removes it.
 */
const OWN_LINE = new RegExp(
  [
    '^([-*_])(?:\\s*\\1){2,}$',
    UNDERLINE.source,
    '^(?:[-*+]|\\d+[.)])$',
    '^\\[[^\\]]+\\]\\s*:(?:\\s*\\S+(?:\\s+(?:"[^"]*"|\'[^\']*\'|\\([^)]*\\)))?)?$',
  ].join('|'),
);

/**
 * Matches a line that's kept as it is, whatever else is on it:  an ATX
 * heading, a blockquote, or a number with whitespace before its `.` or `)`,
 * which `no-extra-punctuation-space` would make a list item.
 */
const KEPT = /^(?:#{1,6}(?:\s|$)|>|\d+\s+[.)](?:\s|$))/;

/**
 * Matches a token that a wrap must never put at the start of a line, where it
 * would read as a block construct.
 */
const NO_START = new RegExp(
  `^(?:${[
    '[@*|>]',
    '`{3,}[^`]*$',
    '~~~',
    '<!--',
    '\\[[^\\]]*\\]:',
    '#{1,6}$',
    '\\+$',
    '\\d+[.)]$',
    '=+$',
    '_+$',
    '[\\^~]+$',
    '[|:-]*-[|:-]*$',
    `</?(?:${HTML_NAMES})(?:[\\s/>]|$)`,
  ].join('|')})`,
  'i',
);

/**
 * Matches text that ends in a hard break, a `<br>` or a backslash.
 * Two trailing spaces aren't one, since `no-trailing-space` removes them.
 */
const HARD_BREAK = /(?:<br\s*\/?>|\\)$/i;

/**
 * Matches a line of only `^` and `~` runs, which point at the line above.
 */
const POINTER = /^[\^~]+(?:\s+[\^~]+)*$/;

/**
 * The most characters other than whitespace that a line ending in `:` may
 * have and still be a label (see `isLabel`).  Whitespace doesn't count,
 * so a spacing fix never changes what kind of line it is.
 */
const SHORT_LABEL = 24;

/**
 * The most characters other than whitespace that a line after a label may
 * have and still be line-oriented (see `parseItems`).
 */
const SHORT_LINE = 50;

/**
 * @param {string} line - a trimmed line, read as `plainOf` reads it
 * @returns {number} how many characters it has other than whitespace
 */
const sizeOf = (line) => line.replace(/\s/g, '').length;

/**
 * @param {string} line - a trimmed line, read as `plainOf` reads it
 * @returns {boolean} whether it's a short label such as `Examples:`
 */
const isLabel = (line) =>
  line.endsWith(':') &&
  sizeOf(line) <= SHORT_LABEL &&
  /[\p{L}\p{N}]/u.test(line);

/**
 * Finds what closes the fence a line opens, as in Markdown.
 *
 * @param {string} s - a trimmed body line
 * @returns {RegExp | undefined} what a closing line matches, if it opens one
 */
const fenceEnd = (s) => {
  if (/^`{3,}[^`]*$/.test(s)) return /^```/;
  const tildes = /^~{3,}/.exec(s)?.[0];
  return tildes ? new RegExp(`^${tildes}~*$`) : undefined;
};

/**
 * @param {string} s - a trimmed body line
 * @returns {RegExp | undefined} what a closing line matches, if it opens one
 */
const verbatimEnd = (s) => {
  const name = VERBATIM_HTML.exec(s)?.[1];
  if (name) return new RegExp(`</${name}\\s*>`, 'i');
  return s.startsWith('<!--') ? /-->/ : undefined;
};

/**
 * A list item's marker on its line, with the column its first word ends
 * at (`end`).  Its text starts one space after the marker once
 * `bullet-spacing` spaces it.
 *
 * @typedef {{ at: number, start: number, marker: string, gap: string, end: number }} Bullet
 */

/**
 * A body line's text, read as `no-exotic-whitespace` would leave it,
 * so a whitespace fix never changes what kind of line it is.  A zero-width
 * space matters, since `\s` doesn't match it.
 *
 * @param {string} content - a body line's text
 * @returns {string} the text, with each exotic space a plain one
 */
const plainOf = (content) => content.replace(EXOTIC, ' ');

/**
 * How far a body line's text is indented past the one space after its `*`,
 * read as `no-exotic-whitespace` would leave it.  It reads the whole line,
 * since a tab right after the `*` is that one space.
 *
 * @param {Pick<BodyLine, 'raw'>} r - a body line
 * @returns {number} the indentation
 */
const indentOf = ({ raw }) =>
  plainOf(raw)
    .replace(/^\s*\* ?/, '')
    .search(/[^ ]|$/);

/**
 * Whether the whitespace before a one-line block's text, past the one space
 * after its `/**`, makes the text indented code, as four columns of it do
 * unless a tag follows.  Otherwise, `text-indent` removes it.
 *
 * @param {string} lead - the whitespace
 * @param {string} text - the text after it
 * @returns {boolean} whether it's kept
 */
const indentsOne = (lead, text) =>
  plainOf(lead).length >= 4 && !text.startsWith('@');

/**
 * @param {BodyLine} r - a body line
 * @returns {Bullet | undefined} its marker, if it starts a list item
 */
function bulletOf(r) {
  const m = BULLET.exec(plainOf(r.content));
  if (!m) return undefined;
  const [, before, marker, gap, word] = m;
  const start = r.offset + before.length;
  const end = start + marker.length + gap.length + word.length;
  return { at: r.at, start, marker, gap, end };
}

/**
 * A list item's wrapped lines start under its text, one space after its
 * marker as `bullet-spacing` spaces it, so `reflow` and `bullet-align` agree
 * whatever the gap is now.  They start at least one space after the `*`,
 * so they stay body lines.  An item that `bullet-indent` moves is read where
 * it moves to (see `misindented`), so `reflow`, `bullet-align` and
 * `bullet-indent` agree in any order.
 *
 * @param {Bullet} bullet - the item's marker
 * @param {string} indent - the whitespace before the block on its line
 * @param {Map<number, number>} moved - the column each moved item's marker
 *                                      moves to, by its line
 * @returns {string} what starts each wrapped line, up to its text
 */
const hangPrefix = (bullet, indent, moved) =>
  `${indent} *`.padEnd(
    Math.max(
      (moved.get(bullet.at) ?? bullet.start) + bullet.marker.length + 1,
      indent.length + 3,
    ),
  );

/**
 * Finds a tag's `{Type}` that spans several lines.  It starts right after
 * the tag's name, may hold blank lines, and ends before the next tag.
 *
 * @param {BodyLine[]} recs - the body lines
 * @param {number} i - the index among them of a line that starts a tag
 * @returns {{ at: number, kept: number, name: string } | null}
 *   the block index of the line it closes on (`at`), how much of that line is
 *   inside it (`kept`), and the tag's `name`, or null if there is none
 */
function typeSpan(recs, i) {
  let next = i + 1;
  while (next < recs.length && !isTag(strip(recs[next].content))) next++;
  const text = recs
    .slice(i, next)
    .map((r) => r.content)
    .join('\n');
  const m = /^\s*@([A-Za-z]\S*)(?!\s*\n\s*\n)\s+\{(?!@)/.exec(text);
  if (!m) return null;
  const end = braceEnds(blankCode(text)).get(m[0].length - 1) ?? -1;
  if (end < 0) return null;
  const lines = text.slice(0, end).split('\n');
  if (lines.length === 1) return null;
  const at = recs[i + lines.length - 1].at;
  return { at, kept: lines[lines.length - 1].length, name: m[1] };
}

/**
 * An item of a block (see `parseItems`).  A raw item's `code` is whether it's
 * kept as code, and its `tag` is the tag that begins the line, which a line
 * of code has only in an `@example`.
 *
 * @typedef {{ type: 'blank', recs: BodyLine[] }} Blank
 * @typedef {{ type: 'raw', raw: string, at: number, code: boolean, tag: string | undefined, bullet?: Bullet }} Raw
 * @typedef {Blank | Raw | Para} Item
 */

/**
 * Turns the body lines of a block into items:  blank, raw (kept as is),
 * or para (a paragraph, or a tag with its continuation lines).  Raw covers
 * lists, tables, headings, blockquotes, fenced and indented code, HTML blocks,
 * `@example`, and a tag's multi-line `{Type}`, though a list item's wrapped
 * lines are flowed as a paragraph.  With `preformatted`, what looks like
 * unfenced code or a diagram is raw too (see `runFrom`).
 *
 * Reading a reflow's output, or a block after any other fix, gives the same
 * items, so no fix changes how a block is read.
 *
 * @param {BodyLine[]} recs - the body lines
 * @param {boolean} [preformatted] - whether to keep unfenced code
 * @returns {Item[]} the items, in order
 */
function parseItems(recs, preformatted = true) {
  /**
   * @type {Item[]}
   */
  const items = [];
  /**
   * @type {Para | null}
   */
  let cur = null;
  /**
   * @type {string | null}
   */
  let mode = null;
  /**
   * @type {RegExp | undefined}
   */
  let closer;
  /**
   * The mode a fence goes back to when it closes:  `example` for a fence in
   * an `@example`.
   *
   * @type {string | null}
   */
  let resume = null;
  /**
   * The preformatted run being kept:  the indentation a line must be past to
   * stay in it (`above`), and the body line index it ends at (`end`).
   *
   * @type {{ above: number, end: number }}
   */
  let run = { above: 0, end: 0 };
  /**
   * Whether this is a table with no `|` at the start of its delimiter row,
   * so its rows can't be told from text.  Its lines are kept until a blank
   * line or a tag, so a wrap never moves a `|` onto a line that would
   * read as a row.
   */
  let table = false;
  /**
   * @type {ReturnType<typeof typeSpan>}
   */
  let type = null;
  const flush = () => {
    if (cur) items.push(cur);
    cur = null;
  };
  /**
   * @type {(r: BodyLine, bullet?: Bullet) => void}
   */
  const raw = (r, bullet) => {
    const tag = !mode || mode === 'example' ? leadingTag(r.content) : undefined;
    const { raw: line, at } = r;
    items.push({ type: 'raw', raw: line, at, code: !!mode, tag, bullet });
  };
  /**
   * @type {(i: number) => boolean}
   */
  const aboveUnderline = (i) =>
    UNDERLINE.test(plainOf(recs[i + 1]?.content ?? '').trim());
  /**
   * @type {(line: string) => boolean}
   */
  const endsRun = (line) =>
    line === '' || isTag(line) || !!fenceEnd(line) || !!verbatimEnd(line);
  /**
   * @type {(i: number) => boolean}
   */
  const standsAlone = (i) => {
    const line = plainOf(recs[i].content).trim();
    return (
      HTML_BLOCK.test(line) ||
      KEPT.test(line) ||
      OWN_LINE.test(line) ||
      POINTER.test(line) ||
      DELIMITER.test(line) ||
      line.startsWith('|') ||
      !!bulletOf(recs[i]) ||
      aboveUnderline(i)
    );
  };
  /**
   * Whether a run goes on through a line.  A line that stands alone stays in
   * it if it's indented at all, as a diagram's `|` is.  Otherwise, it would
   * leave the run only until `text-indent` moved the paragraph left.
   *
   * @type {(i: number, line: string) => boolean}
   */
  const inRun = (i, line) =>
    i < run.end &&
    !endsRun(line) &&
    indentOf(recs[i]) > (standsAlone(i) ? 0 : run.above);
  /**
   * @type {(i: number) => number}
   */
  const paraEnd = (i) => {
    let end = i;
    while (
      end < recs.length &&
      !endsRun(plainOf(recs[end].content).trim()) &&
      !standsAlone(end)
    )
      end++;
    return end;
  };
  /**
   * Finds the preformatted run that a line starts, if any:  a pointer line
   * under text, a line indented past the paragraph above, or short lines
   * after a label.
   *
   * @type {(i: number, r: BodyLine, line: string) => typeof run | null}
   */
  const runFrom = (i, r, line) => {
    if (!preformatted || line === '' || isTag(line)) return null;
    const indent = indentOf(r);
    if (POINTER.test(line) && i > 0 && plainOf(recs[i - 1].content).trim())
      return { above: Math.max(indent - 1, 0), end: recs.length };
    if (!cur || cur.tag || cur.bullet) return null;
    const last = cur.recs[cur.recs.length - 1];
    const above = indentOf(last);
    const label = isLabel(plainOf(last.content).trim());
    if (label && cur.recs.length === 1) {
      const end = paraEnd(i);
      const lines = recs.slice(i, end).map((l) => plainOf(l.content).trim());
      if (
        lines.length > 1 &&
        lines.every((l) => sizeOf(l) <= SHORT_LINE && !/[.!?]$/.test(l))
      )
        return { above: -1, end };
    }
    return indent >= above + (label ? 1 : 2)
      ? { above, end: recs.length }
      : null;
  };

  for (const [i, r] of recs.entries()) {
    if (type) {
      const inside = r.at < type.at;
      // A closing line above an underline is kept like any other line there.
      if (inside || aboveUnderline(i)) {
        raw(r);
        if (!inside) type = null;
        continue;
      }
      const { kept, name } = type;
      const content = hide(r.content.slice(0, kept)) + r.content.slice(kept);
      const parts = [content.trimEnd()];
      const rec = { ...r, content };
      cur = { type: 'para', tag: true, typed: name, parts, recs: [rec] };
      type = null;
      continue;
    }

    const s = strip(r.content);
    const line = plainOf(s).trim();
    const indented = /^ {4,}\S/.test(plainOf(r.content));

    // A fence in an `@example` keeps its lines as code, even one that starts
    // with `@`, such as a decorator, and the example goes on after it.
    if (mode === 'example' && fenceEnd(line)) {
      mode = 'fence';
      closer = fenceEnd(line);
      resume = 'example';
      raw(r);
      continue;
    }

    if (
      (mode === 'code' && (s === '' || indented)) ||
      mode === 'fence' ||
      (mode === 'html' && s !== '' && !isTag(s)) ||
      (mode === 'example' && !isTag(s)) ||
      (mode === 'preformatted' && inRun(i, line))
    ) {
      raw(r);
      if (mode === 'fence' && closer?.test(s)) {
        mode = resume;
        resume = null;
      }
      continue;
    }

    // Indented code starts only at the block's start or after a blank line,
    // never inside a paragraph.  A list item or table row sets no mode, so the
    // line after it is read afresh, which is how a bullet's wrapped lines
    // become a paragraph.
    mode = null;
    if (s === '' || isTag(s)) table = false;
    else if (DELIMITER.test(line) && !line.startsWith('|')) table = true;
    // Verbatim HTML that no later line closes ends like other HTML, so a stray
    // `<pre>` doesn't keep the rest of the block as is.
    const fence = fenceEnd(line);
    const verbatim = verbatimEnd(line);
    if (indented && !cur && (!items.length || items.at(-1)?.type === 'blank'))
      mode = 'code';
    else if (/^@example\b/.test(s)) mode = 'example';
    else if (
      fence ||
      (verbatim && recs.slice(i).some((l) => verbatim.test(l.content)))
    ) {
      mode = 'fence';
      closer = fence ?? verbatim;
    } else if (verbatim || HTML_BLOCK.test(line)) mode = 'html';
    type = !mode && isTag(s) ? typeSpan(recs, i) : null;
    if (type) {
      flush();
      raw(r);
      continue;
    }
    // A construct on its own isn't a list item, though `- - -` starts like one.
    // A line above an underline is kept even if it's a tag's, or a tag's
    // wrapped last line would be read as a heading next time.
    const own = KEPT.test(line) || OWN_LINE.test(line);
    const bullet = mode || own ? undefined : bulletOf(r);
    if (
      mode ||
      bullet ||
      own ||
      table ||
      /^\|/.test(line) ||
      (s !== '' && aboveUnderline(i))
    ) {
      flush();
      raw(r, bullet);
      // Verbatim HTML may close on the line it opens on.
      if (mode === 'fence' && verbatim?.test(line)) mode = null;
      continue;
    }

    const started = runFrom(i, r, line);
    if (started) {
      // A label in the middle of a paragraph stays on a line of its own above
      // what it labels.
      if (
        cur &&
        cur.recs.length > 1 &&
        !cur.tag &&
        !cur.bullet &&
        isLabel(plainOf(cur.recs[cur.recs.length - 1].content).trim())
      ) {
        const above = /** @type {Para} */ (cur);
        const label = {
          parts: above.parts.splice(-1),
          recs: above.recs.splice(-1),
        };
        flush();
        cur = { type: 'para', tag: false, ...label };
      }
      flush();
      run = started;
      mode = 'preformatted';
      raw(r);
      continue;
    }

    if (s === '' || isTag(s)) flush();
    if (s === '') items.push({ type: 'blank', recs: [r] });
    else if (cur) {
      cur.parts.push(s);
      cur.recs.push(r);
    } else {
      const prev = items.at(-1);
      cur = { type: 'para', tag: isTag(s), parts: [s], recs: [r] };
      if (prev?.type === 'raw' && prev.bullet && !cur.tag)
        cur.bullet = prev.bullet;
    }
  }
  flush();
  return items;
}

/**
 * Finds where a paragraph's lines end in a hard break, other than its
 * last line.  A line that ends inside a span doesn't.  The paragraph is
 * masked once, so a long run of hard breaks is read in linear time.
 *
 * @param {string[]} parts - a paragraph's lines' text
 * @returns {number[]} the index of the line after each such line, and then
 *                     how many lines there are
 */
function breaksOf(parts) {
  const masked = mask(parts.join(' '));
  let at = -1;
  const ends = parts.flatMap((p, k) => {
    at += p.length + 1;
    return HARD_BREAK.test(p) && masked[at] === ' ' ? [k + 1] : [];
  });
  return [...ends, parts.length];
}

/**
 * Fills a paragraph into lines (see `fillLines`).  Text after a line that
 * ends in a hard break is filled on its own, so the break stays.
 *
 * @param {{ tag: boolean, parts: string[], typed?: string }} item -
 *   the paragraph
 * @param {string} firstPrefix - what starts its first line
 * @param {string} contPrefix - what starts each later line,
 *                              before a tag's hang
 * @param {number} width - the widest a line may be
 * @param {Limits} limits - the limits on where a line may break
 * @param {1 | 2} [spaces] - the spaces after a sentence end or a colon
 * @returns {string[]} the lines, each already prefixed
 */
function fillPara(item, firstPrefix, contPrefix, width, limits, spaces) {
  // A loop, not a recursion, so a long run of hard breaks can't overflow
  // the stack.
  const out = [];
  let start = 0;
  let piece = item;
  let prefix = firstPrefix;
  for (const end of breaksOf(item.parts)) {
    const parts = item.parts.slice(start, end);
    const [lines, next] = fillLines(
      { ...piece, parts },
      prefix,
      contPrefix,
      width,
      limits,
      spaces,
    );
    out.push(lines);
    start = end;
    piece = { tag: false, parts: [] };
    prefix = contPrefix = next;
  }
  return out.flat();
}

/**
 * Fills a paragraph with no hard break inside it into lines of units
 * (glued runs of tokens), greedily, moving a break earlier a unit at a time
 * while it breaks a rule.
 *
 * @param {{ tag: boolean, parts: string[], typed?: string }} item -
 *   the paragraph
 * @param {string} firstPrefix - what starts its first line
 * @param {string} contPrefix - what starts each later line,
 *                              before a tag's hang
 * @param {number} width - the widest a line may be
 * @param {Limits} limits - the limits on where a line may break
 * @param {1 | 2} [spaces] - the spaces after a sentence end or a colon
 * @returns {[string[], string]} the lines, each already prefixed, and what
 *                               starts each line of text after them
 */
function fillLines(item, firstPrefix, contPrefix, width, limits, spaces) {
  // The lines are joined with one space, so a line break never counts as two
  // spaces after a token.  The whitespace inside a masked span stays as it is,
  // so a code span's text never changes.
  const text = mask(item.parts.join(' '))
    .replace(/[\s\u200b]/g, ' ')
    .trim();
  const words = text.split(/ +/);
  const gaps = (text.match(/ +/g) ?? []).map((gap) => wideIn(gap, spaces));
  const { tokens, last } = joinTight(words);
  const wide = last.map((k) => gaps[k]);
  const n = tokens.length;
  const ends = tokens.map((t, k) => endsSentence(t, tokens[k + 1], wide[k]));
  const sep = tokens.map((t, k) => sepAfter(t, tokens[k + 1], wide[k], spaces));
  // One space goes before a tag's `-`, whatever the word before it ends in.
  const dash = item.tag ? separatorOf(tokens, item.typed) : -1;
  if (dash > 0) sep[dash - 1] = ' ';
  // The next token and the spacing only ever hide a period, so they never
  // change whether a token ends in `, ; :`.
  const tail = tokens.map((t, k) => tailPunct(t, tokens[k + 1], wide[k]));
  const mark = tail.map((p) => /[,;:]/.test(p));
  /**
   * Whether tokens[k] may end a line alone after the mark that ends tokens[j]:
   * if it ends a sentence, or follows a comma and ends in a comma or
   * semicolon itself, as in a list.
   *
   * @type {(j: number, k: number) => boolean}
   */
  const mayEnd = (j, k) => ends[k] || (tail[j] === ',' && /[,;]/.test(tail[k]));

  const head = item.tag ? headSize(tokens, item.typed) : 0;

  /**
   * @type {number[]}
   */
  const col = [];
  let full = '';
  for (let k = 0; k < n; k++) {
    col.push(full.length);
    full += tokens[k] + sep[k];
  }
  /**
   * @type {(a: number, b: number) => string}
   */
  const textOf = (a, b) => full.slice(col[a], col[b] + tokens[b].length);
  // Only a first line that starts a fence or a link reference definition,
  // or that's made of these characters, can read as a construct that's one
  // only if it's the whole line (see `glued`), so the check of each longer
  // first line stops at the first other character, which keeps it linear.
  const constructEnd = /^(?:```|~~~|\[[^\]]+\]\s*:)/.test(full)
    ? Infinity
    : full.search(/[^-*_=|:+^~.)\d\s]|$/);
  /**
   * @type {(t: string) => number}
   */
  const room = (t) => width + (limits.hang && HANG.test(t) ? 1 : 0);

  // A head wider than `limits.maxHead` takes a line of its own unless the whole
  // tag fits on one, and its description is filled below it, unless that would
  // read as a block construct at a line start or the head would read as ending
  // in a hard break.
  const oneLine =
    firstPrefix.length + col[n - 1] + tokens[n - 1].length <=
    room(tokens[n - 1]);
  if (
    head < n &&
    col[head] > limits.maxHead &&
    !oneLine &&
    !NO_START.test(tokens[head]) &&
    !HARD_BREAK.test(tokens[head - 1])
  ) {
    const below = `${contPrefix}  `;
    const parts = [unmask(textOf(head, n - 1))];
    return [
      [
        unmask(firstPrefix + textOf(0, head - 1)),
        ...fillPara({ tag: false, parts }, below, below, width, limits, spaces),
      ],
      below,
    ];
  }

  /**
   * @type {(k: number) => boolean}
   */
  const glued = (k) => {
    const [prev, t, next] = [tokens[k - 1], tokens[k], tokens[k + 1]];
    if (k < head) return true;
    if (NO_START.test(next)) return true;
    // A hard break must not end a line inside a paragraph, where it would
    // become a real break.
    if (HARD_BREAK.test(t)) return true;
    // A paragraph's first line never ends where it would read as a construct
    // that's one only if it's the whole line, as `--- then` would at `---`, or
    // as a fence would, as ```` ```js a b` ```` would at `a`.
    const first = col[k] + t.length <= constructEnd ? textOf(0, k) : '';
    if (OWN_LINE.test(first) || POINTER.test(first) || fenceEnd(first))
      return true;
    // An abbreviation that ends a sentence only because two spaces follow it,
    // as in `Elm St.  Then`, is glued to the next word, since a break would
    // lose those two spaces and the sentence end with them.
    if (ends[k] && !endsSentence(t, next)) return true;
    // No other glue crosses a sentence end.
    if (ends[k]) return false;
    if (k === head) return true;
    if (limits.shortWords && SHORT.test(t)) return true;
    // The first two and last two words of a sentence stay together, and a word
    // ending in `. ! ?` stays with the one before it.
    if (
      limits.sentence &&
      (ends[k - 1] || ends[k + 1] || k === n - 2 || /[.!?]/.test(tail[k + 1]))
    )
      return true;
    // An abbreviation beside a name is glued to it, as in `Mr. Smith`, `St.
    // Paul` (before a capitalized word only), `Elm St.`, and `et al.`
    const abbr = abbrOf(t);
    if (
      limits.names &&
      ((abbr === 'st' ? capitalized(next) : !!abbr && BESIDE_NAME.has(abbr)) ||
        (abbrOf(next) === 'st' && capitalized(t)) ||
        (abbrOf(next) === 'al' && /(^|[^a-z])et$/i.test(t)))
    )
      return true;
    // The first and last words inside parentheses stay with their neighbors,
    // but a whole `(word)` token is glued to neither.
    if (
      limits.paren &&
      ((t.startsWith('(') && !codeless(t).includes(')')) ||
        (k > 0 && /^\(+$/.test(prev)) ||
        /^[^(]*\)/.test(codeless(next)))
    )
      return true;
    // A single word after `, ; :` can't end a line alone unless `mayEnd` allows
    // it.
    return limits.clause && k > 0 && mark[k - 1] && !mayEnd(k - 1, k);
  };

  // Units are runs of glued tokens, and lines break only between them.  cuts[i]
  // is the first token of unit i, and cuts[m] is n.
  const cuts = [...tokens.keys()].filter((k) => k === 0 || !glued(k - 1));
  cuts.push(n);
  const m = cuts.length - 1;

  // A tag's later lines hang at its description's column, which is past the
  // head's end if the tag has no description.
  contPrefix += ' '.repeat(
    hangOf(head < n ? col[head] : full.length, limits.maxHead),
  );

  /**
   * A line is units [a, b), which is tokens [T0, T1].
   *
   * @type {(a: number, b: number) => [number, number]}
   */
  const range = (a, b) => [cuts[a], cuts[b] - 1];
  /**
   * @type {(a: number, b: number) => number}
   */
  const reach = (a, b) => {
    const [T0, T1] = range(a, b);
    const prefix = a === 0 ? firstPrefix : contPrefix;
    return prefix.length + col[T1] + tokens[T1].length - col[T0];
  };
  /**
   * @type {(a: number, b: number) => boolean}
   */
  const fits = (a, b) => reach(a, b) <= room(tokens[range(a, b)[1]]);
  /**
   * Whether the line [a, b) keeps the `limits.clause` rules.  A sentence's
   * last two words need no check, since the glue keeps them together.
   *
   * @type {(a: number, b: number) => boolean}
   */
  const valid = (a, b) => {
    if (!limits.clause) return true;
    const [T0, T1] = range(a, b);
    if (a > 0 && mark[T0 - 1] && T0 === T1) return false;
    return b === m || !(T1 > T0 && mark[T1 - 1] && !mayEnd(T1 - 1, T1));
  };
  /**
   * The most units that fit on a line from a, or one if even that overflows.
   *
   * @type {(a: number) => number}
   */
  const greedy = (a) => {
    let b = a + 1;
    while (b < m && fits(a, b + 1)) b++;
    return b;
  };

  // breakAt[a] is where the line from unit a ends, as units [a, b):  the latest
  // break that fits, is valid, and lets the lines after it keep every rule,
  // or 0 if none does.  It's found from the last unit back, so the lines after
  // a break are known before the break is tried.
  const breakAt = Array(m).fill(0);
  for (let a = m - 1; a >= 0; a--) {
    for (let b = greedy(a); b > a && !breakAt[a]; b--) {
      if ((b === m || breakAt[b]) && valid(a, b)) breakAt[a] = b;
    }
  }
  /**
   * Lays out the lines from unit a, each as units [a, b), by `breakAt`,
   * except that from a unit with no layout that keeps every rule, the line
   * ends at the latest valid break, or else the greedy one.
   *
   * @type {(a: number) => [number, number][]}
   */
  const lenient = (a) => {
    const lines = [];
    while (a < m) {
      let b = breakAt[a];
      if (!b) {
        const max = greedy(a);
        b = max;
        while (b > a && !valid(a, b)) b--;
        if (b === a) b = max;
      }
      lines.push(/** @type {[number, number]} */ ([a, b]));
      a = b;
    }
    return lines;
  };
  /**
   * With `limits.widows`, moves the last break earlier while the last line's
   * text is shorter than that fraction of `width`.  A move must keep both
   * lines valid and in `width`, and the last line may never end right of
   * the line before it.
   *
   * @type {(lines: [number, number][]) => [number, number][]}
   */
  const widowless = (lines) => {
    const L = lines.length;
    if (!limits.widows || L < 2) return lines;
    const [a] = lines[L - 2];
    const min = limits.widows * width;
    /**
     * @type {(b: number) => boolean}
     */
    const long = (b) => {
      const [T0, T1] = range(b, m);
      return col[T1] + tokens[T1].length - col[T0] >= min;
    };
    let best = lines[L - 1][0];
    for (let b = best - 1; b > a && !long(best); b--) {
      if (!fits(b, m) || reach(b, m) > reach(a, b)) break;
      if (valid(a, b) && valid(b, m)) best = b;
    }
    return [...lines.slice(0, L - 2), [a, best], [best, m]];
  };
  const lines = widowless(lenient(0)).map(([a, b], i) => {
    const prefix = i === 0 ? firstPrefix : contPrefix;
    return unmask(prefix + textOf(...range(a, b)));
  });
  return [lines, contPrefix];
}

/**
 * Whether a block has a line that begins with one of some tags, which makes
 * the rules leave the whole block as it is.  Lines are read as
 * `no-exotic-whitespace` would leave them, and a wrap never moves an `@` word
 * to a line start (see `NO_START`), so fixing a block never makes it verbatim.
 * A one-line block is checked whatever its form, since `single-line` spreads
 * it out, and a block with text beside its delimiters is read as
 * `delimiter-lines` spreads it (see `spreadDelimiters`), as every
 * rule reads it.
 *
 * @param {string} text - the block, from its `/**` to its `*\/`
 * @param {string} indent - the whitespace before the block on its line
 * @param {Set<string>} names - the tags' names, without their `@`s
 * @param {BlockOptions} [options] - how to read and space the block
 * @returns {boolean} whether a line of the block begins with one of them
 */
export function hasVerbatimTag(text, indent, names, { preformatted } = {}) {
  const spread = spreadDelimiters(text, indent) ?? text;
  const tags = text.includes('\n')
    ? itemsOf(spread, indent, preformatted).flatMap((it) =>
        it.type === 'raw' ? it.tag : it.recs.map((r) => leadingTag(r.content)),
      )
    : [leadingTag(text.slice(3, -2))];
  return tags.some((tag) => !!tag && names.has(tag));
}

/**
 * Reflows one JSDoc block.  A one-line block stays on one line if its text
 * fits or it's a `@ts-*` directive, and expands otherwise.  A longer block
 * keeps its first and last lines.
 *
 * @param {string} text - the block, from its `/**` to its `*\/`
 * @param {string} indent - the whitespace before the block on its line
 * @param {number} [nominal] - the nominal line width, prefix included
 * @param {ReflowOptions} [options] - limits to turn off, and how to
 *                                    read the block
 * @returns {string | null} the reflowed block, or null if its form
 *                          isn't handled
 */
export function reflowComment(text, indent, nominal = WIDTH, options = {}) {
  const block = parseBlock(text, indent);
  if (!block) return null;
  const width = nominal - MARGIN;
  const limits = limitsOf(options, nominal);
  const { spaces } = options;
  const { lines, recs } = block;
  const items = parseItems(recs, options.preformatted);
  const one = lines.length === 1;
  const pre = `${indent} * `;
  // A one-liner stays on one line if it fits (` *\/` is 3 columns), and a
  // directive however wide.
  if (one && items.length === 1 && items[0].type === 'para') {
    const room = isDirective(recs[0].content) ? Infinity : width;
    const l = fillPara(
      items[0],
      `${indent}/** `,
      pre,
      room - 3,
      limits,
      spaces,
    );
    if (l.length === 1 && l[0].length + 3 <= room) {
      return `${l[0]} */`.slice(indent.length);
    }
  }
  const open = one ? `${indent}/**` : lines[0];
  const close = one ? `${indent} */` : lines.at(-1);
  const moved = movedOf(text, indent, options);
  const body = items.flatMap((it) => {
    if (it.type === 'blank') return `${indent} *`;
    if (it.type === 'raw') return it.raw;
    const hang = it.bullet ? hangPrefix(it.bullet, indent, moved) : pre;
    // The line that closes a multi-line `{Type}` keeps its own prefix.
    const [{ raw, offset }] = it.recs;
    const first = it.typed ? raw.slice(0, offset) : hang;
    return fillPara(it, first, hang, width, limits, spaces);
  });
  return [open, ...body, close].join('\n').slice(indent.length);
}

/**
 * Splits a block into its lines and finds its body lines.  A one-line block
 * has one, its text between the `/**` and the `*\/`, with a ` * ` prefix as
 * on a line of its own.  A block with a `\r`, `\u2028`, or `\u2029` isn't
 * handled, since only `\n` is split on.
 *
 * @param {string} text - the block, from its `/**` to its `*\/`
 * @param {string} indent - the whitespace before the block on its line
 * @returns {{ lines: string[], recs: BodyLine[] } | null}
 *   the `lines` and body lines (`recs`), or null if its form isn't handled
 */
function parseBlock(text, indent) {
  if (/[\r\u2028\u2029]/.test(text)) return null;
  const lines = `${indent}${text}`.split('\n');
  if (lines.length === 1) {
    const one = lines[0].match(/^(\s*\/\*\*\s)(.+?)[\s\u200b]*\*\/\s*$/);
    if (!one) return null;
    const [, start, text] = one;
    const lead = /^[\s\u200b]*/.exec(text)?.[0] ?? '';
    const cut = indentsOne(lead, text.slice(lead.length)) ? 0 : lead.length;
    const open = start + text.slice(0, cut);
    const content = text.slice(cut);
    const raw = `${indent} * ${content}`;
    return { lines, recs: [{ raw, content, offset: open.length, at: 0 }] };
  }
  const body = lines.slice(1, -1);
  if (!/^\s*\/\*\*\s*$/.test(lines[0])) return null;
  if (!/^\s*\*\/\s*$/.test(lines[lines.length - 1])) return null;
  if (!body.every((l) => /^\s*\*(\s|$)/.test(l))) return null;
  const recs = body.map((raw, i) => {
    const content = raw.replace(/^\s*\*\s?/, '');
    return { raw, content, offset: raw.length - content.length, at: i + 1 };
  });
  return { lines, recs };
}

/**
 * @param {string} text - the block, from its `/**` to its `*\/`
 * @param {string} indent - the whitespace before the block on its line
 * @param {boolean} [preformatted] - whether to keep unfenced code
 * @returns {Item[]} the block's items, none if its form isn't handled
 */
const itemsOf = (text, indent, preformatted) =>
  parseItems(parseBlock(text, indent)?.recs ?? [], preformatted);

/**
 * @param {string} text - the block, from its `/**` to its `*\/`
 * @param {string} indent - the whitespace before the block on its line
 * @param {boolean} [preformatted] - whether to keep unfenced code
 * @returns {Para[]} the block's paragraphs
 */
const parasOf = (text, indent, preformatted) =>
  itemsOf(text, indent, preformatted).filter((it) => it.type === 'para');

/**
 * A change to a block:  it replaces the columns `start` to `end` on line `at`
 * with `text`.
 *
 * @typedef {{ at: number, start: number, end: number, text: string }} Edit
 */

/**
 * What `misaligned` and `mishung` find:  an `Edit` that replaces a line's
 * prefix, and the `column` that prefix ends at.
 *
 * @typedef {Edit & { column: number }} Alignment
 */

/**
 * What `misspaced` and `misedged` find:  a `Span` to report, and an `Edit`
 * that fixes it.  Its `kind` is the `messageId` of the rule that reports it.
 *
 * @typedef {Span & Edit} Finding
 */

/**
 * @param {BodyLine[]} recs - body lines
 * @param {string} prefix - what each should start with, up to its text
 * @returns {Alignment[]} an `Alignment` for each line that doesn't
 */
const realign = (recs, prefix) =>
  recs.flatMap(({ at, raw }) => {
    // Every body line has a prefix, since `parseBlock` checks that each starts
    // with a `*`.
    const end = raw.match(/^\s*\*[\s\u200b]*/)?.[0].length ?? 0;
    const column = prefix.length;
    return end === column ? [] : [{ at, start: 0, end, text: prefix, column }];
  });

/**
 * Finds a block's tag continuation lines that don't start at their tag's
 * description column, which is two spaces in when the head is wider than its
 * limit (see `headLimit`).  Moving words is reflow's job, so only the lines
 * after the head's own are checked.
 *
 * @param {string} text - the block, from its `/**` to its `*\/`
 * @param {string} indent - the whitespace before the block on its line
 * @param {AlignOptions} [options] - how to read and space the block,
 *                                   and which heads are wide
 * @returns {Alignment[]} an `Alignment` for each such line
 */
export function misaligned(
  text,
  indent,
  { preformatted, spaces, width = WIDTH, maxHead } = {},
) {
  const pre = `${indent} * `;
  const limit = headLimit(width, maxHead);
  return parasOf(text, indent, preformatted).flatMap((it) => {
    if (!it.tag) return [];
    const line = mask(it.recs[0].content);
    const words = line.match(/[^\s\u200b]+/g) ?? [];
    const gaps = line.match(/[\s\u200b]+/g) ?? [];
    const dash = separatorOf(words, it.typed);
    /**
     * @type {(t: string, k: number) => string}
     */
    const sep = (t, k) =>
      k === dash - 1
        ? ' '
        : sepAfter(t, words[k + 1], gaps[k]?.length > 1, spaces);
    const headWidth = words
      .slice(0, headSize(words, it.typed))
      .reduce((a, t, k) => a + t.length + sep(t, k).length, 0);
    const column = pre.length + hangOf(headWidth, limit);
    return realign(it.recs.slice(1), `${indent} *`.padEnd(column));
  });
}

/**
 * Finds a list item's wrapped lines that don't start under its text
 * (see `hangPrefix`).  The item's own line is kept as it is.
 *
 * @param {string} text - the block, from its `/**` to its `*\/`
 * @param {string} indent - the whitespace before the block on its line
 * @param {BlockOptions} [options] - how to read and space the block
 * @returns {Alignment[]} an `Alignment` for each such line
 */
export function mishung(text, indent, { preformatted } = {}) {
  const moved = movedOf(text, indent, { preformatted });
  return parasOf(text, indent, preformatted).flatMap((it) =>
    it.bullet ? realign(it.recs, hangPrefix(it.bullet, indent, moved)) : [],
  );
}

/**
 * A list item of a block, and where it is in its list:  how far it's indented
 * past the one space after its `*` (`from`, see `indentOf`), how far it
 * should be (`to`), how deep it's nested (`level`), and whether its list is
 * left as it is (`kept`).
 *
 * @typedef {{ item: Raw, from: number, to: number, level: number, kept: boolean }} ListItem
 */

/**
 * Finds a block's list items and where each should start.  A list runs over
 * items, their wrapped lines, and blank lines, and anything else ends it.
 * Nesting follows CommonMark:  an item is a child of the open item above it
 * only if it starts at or past that item's text, one space after its marker,
 * as `bullet-spacing` spaces it.  Otherwise, it's a sibling, even if it's
 * indented a bit more.  The first item at each level of a list sets
 * the level's column, and a nested list moves as far as its parent,
 * so the author's depth for it is kept, and no item changes its parent.
 *
 * A changed marker, as from `-` to `*`, starts a new list in CommonMark
 * whatever its column, so the items are aligned by level alone, and their
 * markers keep the lists apart.  A list with a child four or more columns
 * past its parent's text, which CommonMark may read as code or as text,
 * is kept as it is.
 *
 * @param {Item[]} items - a block's items
 * @returns {ListItem[]} its list items, in order
 */
function listItemsOf(items) {
  /**
   * @type {ListItem[]}
   */
  const out = [];
  /**
   * The open item at each level:  the column its text starts at, and how
   * far it moves.
   *
   * @type {{ text: number, to: number, shift: number }[]}
   */
  let open = [];
  let first = 0;
  const end = () => {
    const kept = out.slice(first).some((l) => l.kept);
    for (const l of out.slice(first)) l.kept = kept;
    open = [];
    first = out.length;
  };
  for (const it of items) {
    if (it.type === 'blank' || (it.type === 'para' && it.bullet)) continue;
    if (it.type !== 'raw' || !it.bullet) {
      end();
      continue;
    }
    const from = indentOf(it);
    let parent = open.length - 1;
    while (parent >= 0 && from < open[parent].text) parent--;
    const level = parent + 1;
    const above = open[parent];
    const to = open[level]?.to ?? from + (above?.shift ?? 0);
    const kept = !!above && from - above.text >= 4;
    open = open.slice(0, level);
    open.push({
      text: from + it.bullet.marker.length + 1,
      to,
      shift: to - from,
    });
    out.push({ item: it, from, to, level, kept });
  }
  end();
  return out;
}

/**
 * Reads a block's lines as `parseItems` does, and each list item's level,
 * to check that a fix changes neither.
 *
 * @param {string} text - the block, from its `/**` to its `*\/`
 * @param {string} indent - the whitespace before the block on its line
 * @param {boolean} [preformatted] - whether to keep unfenced code
 * @returns {string} what each line is read as
 */
function shapeOf(text, indent, preformatted) {
  const items = itemsOf(text, indent, preformatted);
  const levels = new Map(
    listItemsOf(items).map(({ item, level }) => [item.at, level]),
  );
  return JSON.stringify(
    items.map((it) =>
      it.type === 'raw'
        ? [it.at, it.code, levels.get(it.at)]
        : [it.type, ...it.recs.map((r) => r.at)],
    ),
  );
}

/**
 * Finds the list items of a block that don't start in line with the other
 * items at their level (see `listItemsOf`).  Each fix replaces the item's
 * line prefix, `*` and all, as `bullet-align` does for its wrapped lines.
 * If the fixes together would change how any line of the block is read, as by
 * moving an item into indented code, there are none.
 *
 * @param {string} text - the block, from its `/**` to its `*\/`
 * @param {string} indent - the whitespace before the block on its line
 * @param {BlockOptions} [options] - how to read the block
 * @returns {Alignment[]} an `Alignment` for each such item
 */
export function misindented(text, indent, { preformatted } = {}) {
  const items = itemsOf(text, indent, preformatted);
  const edits = listItemsOf(items).flatMap(({ item, from, to, kept }) => {
    if (kept || from === to) return [];
    const prefix = `${indent} *`.padEnd(indent.length + 3 + to);
    const end =
      item.raw.length - item.raw.replace(/^\s*\*[\s\u200b]*/, '').length;
    const column = prefix.length;
    return [{ at: item.at, start: 0, end, text: prefix, column }];
  });
  if (!edits.length) return [];
  const fixed = applyEdits(text, indent, [...edits]);
  return shapeOf(fixed, indent, preformatted) ===
    shapeOf(text, indent, preformatted)
    ? edits
    : [];
}

/**
 * @param {string} text - the block, from its `/**` to its `*\/`
 * @param {string} indent - the whitespace before the block on its line
 * @param {BlockOptions} [options] - how to read the block
 * @returns {Map<number, number>} the column each item that `misindented`
 *                                moves will start at, by its line
 */
const movedOf = (text, indent, options) =>
  new Map(misindented(text, indent, options).map((a) => [a.at, a.column]));

/**
 * Finds the gaps between words on a line that aren't the space reflow puts
 * there:  two after a sentence end or a colon (one if `spaces` is `1`),
 * and one otherwise.  Only text that reflow modifies is checked.  A gap that
 * no space belongs in is left to `mispunctuated`, and the two around a tag's
 * `-` have kind `tag`.
 *
 * Each spacing rule fixes only the gaps of its own `kind`, and no fix changes
 * any gap's kind, which depends only on the tokens beside the gap and whether
 * it's wide.  So the rules are independent and settle on the same block
 * in any order.
 *
 * @param {string} text - the block, from its `/**` to its `*\/`
 * @param {string} indent - the whitespace before the block on its line
 * @param {BlockOptions} [options] - how to read and space the block
 * @returns {Finding[]} findings of kind `sentence`, `colon`, `word`, or `tag`
 */
export function misspaced(text, indent, { preformatted, spaces } = {}) {
  return parasOf(text, indent, preformatted).flatMap((it) => {
    const words = placeParaWords(it);
    const { tokens, of } = joinTight(words.map((w) => w.word));
    const dash = separatorOf(
      words.map((w) => w.word),
      it.typed,
    );
    return words.slice(1).flatMap((b, k) => {
      const a = words[k];
      if (a.at !== b.at || tight(a.word, b.word)) return [];
      const [before, after] = [tokens[of[k]], tokens[of[k + 1]]];
      const wide = wideIn(b.gap, spaces);
      const tag = dash > 0 && (k === dash - 1 || k === dash);
      const space = tag ? ' ' : sepAfter(before, after, wide, spaces);
      // A gap of the right width is left as it is, even if it's a tab, which
      // `exoticSpaces` finds.
      if (b.gap.length === space.length) return [];
      const kind = endsSentence(before, after, wide)
        ? 'sentence'
        : endsColon(before)
          ? 'colon'
          : 'word';
      return [gapFinding(tag ? 'tag' : kind, a, b, space)];
    });
  });
}

/**
 * Finds the gaps on a line between words that no space belongs between
 * (see `tight`).  A line break between two such words is left to reflow,
 * which joins them.
 *
 * @param {string} text - the block, from its `/**` to its `*\/`
 * @param {string} indent - the whitespace before the block on its line
 * @param {BlockOptions} [options] - how to read and space the block
 * @returns {Finding[]} findings of kind `punctuation` whose edit
 *                      removes a gap
 */
export function mispunctuated(text, indent, { preformatted } = {}) {
  return parasOf(text, indent, preformatted).flatMap((it) => {
    const words = placeParaWords(it);
    return words
      .slice(1)
      .flatMap((b, k) =>
        words[k].at === b.at && tight(words[k].word, b.word)
          ? [gapFinding('punctuation', words[k], b, '')]
          : [],
      );
  });
}

/**
 * Finds the list items whose marker isn't followed by exactly one space.
 * A tab is left to `exoticSpaces`, and the indentation before the marker,
 * which nests a list, is the author's.
 *
 * @param {string} text - the block, from its `/**` to its `*\/`
 * @param {string} indent - the whitespace before the block on its line
 * @param {BlockOptions} [options] - how to read and space the block
 * @returns {Finding[]} findings of kind `bullet`, one per bad item
 */
export function misbulleted(text, indent, { preformatted } = {}) {
  return itemsOf(text, indent, preformatted).flatMap((it) => {
    if (it.type !== 'raw' || !it.bullet || it.bullet.gap.length === 1)
      return [];
    const { at, start, marker, gap, end } = it.bullet;
    const after = start + marker.length;
    const edit = { at, start: after, end: after + gap.length, text: ' ' };
    return [finding('bullet', [start, end], edit)];
  });
}

/**
 * Finds the whitespace in a block's text that isn't plain spaces
 * (see `EXOTIC`).  Code is skipped, since a tab may belong there, but code
 * spans aren't, since reflow joins their words with plain spaces.  Each such
 * character becomes one space, so no gap's width changes, and the spacing and
 * edge rules find the same gaps before and after.
 *
 * @param {string} text - the block, from its `/**` to its `*\/`
 * @param {string} indent - the whitespace before the block on its line
 * @param {BlockOptions} [options] - how to read and space the block
 * @returns {Finding[]} findings of kind `exotic`, one per such run
 */
export function exoticSpaces(text, indent, { preformatted } = {}) {
  const block = parseBlock(text, indent);
  if (!block) return [];
  const { lines } = block;
  const one = lines.length === 1;
  const checked = parseItems(block.recs, preformatted).flatMap((it) => {
    if (it.type !== 'raw') return it.recs.map((r) => r.at);
    return it.code ? [] : [it.at];
  });
  return checked.flatMap((at) => {
    const l = lines[at];
    const from = one ? l.indexOf('/**') + 3 : l.indexOf('*') + 1;
    const to = one ? l.lastIndexOf('*/') : l.trimEnd().length;
    return [...l.slice(from, to).matchAll(/[\s\u200b]+/g)]
      .filter((m) => /[^ ]/.test(m[0]))
      .map((m) => {
        const start = from + m.index;
        const end = start + m[0].length;
        const before = l.slice(0, start).search(/[^\s\u200b]*$/);
        const after = end + l.slice(end).search(/[\s\u200b]|$/);
        const text = m[0].replace(EXOTIC, ' ');
        return finding('exotic', [before, after], { at, start, end, text });
      });
  });
}

/**
 * Finds each word of a paragraph, masked (see `mask`).  A span may cross
 * lines, so the paragraph is masked as a whole, then split.
 *
 * @param {Para} it - the paragraph
 * @returns {{ at: number, start: number, end: number, word: string, gap: string }[]}
 *   each word's position, text, and the `gap` before it
 */
function placeParaWords(it) {
  const masked = mask(it.recs.map((r) => r.content).join('\n')).split('\n');
  return it.recs.flatMap((r, i) =>
    [...masked[i].matchAll(/([\s\u200b]*)([^\s\u200b]+)/g)].map((m) => {
      const start = r.offset + m.index + m[1].length;
      const end = start + m[2].length;
      return { at: r.at, start, end, word: m[2], gap: m[1] };
    }),
  );
}

/**
 * Applies edits from the last to the first, so an edit doesn't move
 * the columns of an earlier one.
 *
 * @param {string} text - the block, from its `/**` to its `*\/`
 * @param {string} indent - the whitespace before the block on its line
 * @param {Edit[]} edits - the edits, in order
 * @returns {string} the edited block
 */
function applyEdits(text, indent, edits) {
  const lines = `${indent}${text}`.split('\n');
  for (const { at, start, end, text: t } of edits.reverse()) {
    lines[at] = lines[at].slice(0, start) + t + lines[at].slice(end);
  }
  return lines.join('\n').slice(indent.length);
}

/**
 * @template {BlockOptions} O
 * @param {(text: string, indent: string, options?: O) => Edit[]} find -
 *   finds the edits that fix a block
 * @returns {(text: string, indent: string, options?: O) => string}
 *   a function that applies them
 */
const fixer = (find) => (text, indent, options) =>
  applyEdits(text, indent, find(text, indent, options));

/**
 * The block, with its tag continuation lines aligned (see `misaligned`).
 */
export const alignTags = fixer(misaligned);

/**
 * The block, with its list items' wrapped lines aligned (see `mishung`).
 */
export const alignBullets = fixer(mishung);

/**
 * The block, with the gaps between its words spaced (see `misspaced`).
 */
export const fixSpacing = fixer(misspaced);

/**
 * The block, with no space before `, . ; : ) ]` or after `(` and `[` on
 * a line (see `mispunctuated`).
 */
export const fixPunctuation = fixer(mispunctuated);

/**
 * The block, with its whitespace made of plain spaces (see `exoticSpaces`).
 */
export const fixWhitespace = fixer(exoticSpaces);

/**
 * The block, with the whitespace at its lines' edges fixed (see `misedged`).
 */
export const fixEdges = fixer(misedged);

/**
 * A word that `placeWords` finds, with the line it starts on (`at`) and ends
 * on (`endAt`), and its columns on them.
 *
 * @typedef {{ at: number, endAt: number, start: number, end: number, word: string }} PlacedWord
 */

/**
 * Finds each word in a block, without its delimiters and line prefixes,
 * plus the `/**` and `*\/` around them.  Words that no space belongs between
 * (see `tight`) are found as one, since reflow joins them.
 *
 * @param {string} text - the block, from its `/**` to its `*\/`
 * @param {string} indent - the whitespace before the block on its line
 * @returns {PlacedWord[]} the words, in order
 */
function placeWords(text, indent) {
  const lines = `${indent}${text}`.split('\n');
  const last = lines.length - 1;
  const close = lines[last].lastIndexOf('*/');
  const start = indent.length;
  const out = [{ at: 0, endAt: 0, start, end: start + 3, word: '/**' }];
  let prev = '';
  lines.forEach((l, at) => {
    // Blank out the delimiters and line prefixes, keeping the columns.
    if (at === last) l = l.slice(0, close);
    if (at === 0)
      l = ' '.repeat(indent.length + 3) + l.slice(indent.length + 3);
    else l = l.replace(/^\s*\*(?!\S)/, (m) => ' '.repeat(m.length));
    for (const m of l.matchAll(/[^\s\u200b]+/g)) {
      const end = m.index + m[0].length;
      const w = out.at(-1);
      if (out.length > 1 && w && tight(prev, m[0])) {
        Object.assign(w, { endAt: at, end, word: w.word + m[0] });
      } else out.push({ at, endAt: at, start: m.index, end, word: m[0] });
      prev = m[0];
    }
  });
  out.push({ at: last, endAt: last, start: close, end: close + 2, word: '*/' });
  return out;
}

/**
 * A place in a block:  a line's index in the block (`at`), and a column on it.
 *
 * @typedef {{ at: number, column: number }} Place
 */

/**
 * What the rules report:  a span of a block, `from` one place `to` another,
 * and what it is (`kind`).
 *
 * @typedef {{ kind: string, from: Place, to: Place }} Span
 */

/**
 * @param {string} kind - what the span reports
 * @param {number} at - the index in the block of the line it starts on
 * @param {number} from - the column it starts at
 * @param {number} to - the column it ends at
 * @param {number} [toAt] - the index of the line it ends on, `at` by default
 * @returns {Span} the span
 */
const span = (kind, at, from, to, toAt = at) => ({
  kind,
  from: { at, column: from },
  to: { at: toAt, column: to },
});

/**
 * @param {string} kind - what the finding reports
 * @param {[number, number]} shown - the span's columns on the edit's line
 * @param {Edit} edit - the change that fixes it
 * @returns {Finding} the finding
 */
const finding = (kind, [from, to], edit) => ({
  ...span(kind, edit.at, from, to),
  ...edit,
});

/**
 * @param {string} kind - what the finding reports
 * @param {{ at: number, start: number, end: number }} a - a word on a line
 * @param {{ start: number, end: number }} b - the word after it on the line
 * @param {string} text - what the gap between them should be
 * @returns {Finding} a finding that replaces the gap
 */
const gapFinding = (kind, a, b, text) =>
  finding(kind, [a.start, b.end], {
    at: a.at,
    start: a.end,
    end: b.start,
    text,
  });

/**
 * Finds the lines of a block that reflow fixes whose whitespace is off at
 * their edges:  a `*` that isn't under the `/**`, extra whitespace after it,
 * or whitespace after the text.  Lines that reflow keeps verbatim are skipped,
 * and tag continuation and list item wrapped lines are left to `tag-align`
 * and `bullet-align`.  The whitespace before the text is checked by its width,
 * so a tab is left to `exoticSpaces`.
 *
 * @param {string} text - the block, from its `/**` to its `*\/`
 * @param {string} indent - the whitespace before the block on its line
 * @param {BlockOptions} [options] - how to read and space the block
 * @returns {Finding[]} findings of kind `star`, `leading`, or `trailing`
 */
export function misedged(text, indent, { preformatted } = {}) {
  const block = parseBlock(text, indent);
  if (!block) return [];
  /**
   * @type {(m: { 0: string, index: number }) => number}
   */
  const endOf = (m) => m.index + m[0].length;
  if (block.lines.length === 1) {
    // This matches the whole line rather than the body line, so `/**  */` has
    // no word to check, and in `/**  foo*\/` the highlight runs through the
    // `*\/`.
    const l = block.lines[0];
    const one = l.match(
      /^\s*\/\*\*\s([\s\u200b]*)[^\s\u200b].*?([\s\u200b]*)\*\/$/,
    );
    if (!one) return [];
    const words = [...l.matchAll(/[^\s\u200b]+/g)];
    const [open, first] = words;
    const last = words[words.length - 2];
    const out = [];
    if (one[1] && !indentsOne(one[1], first[0])) {
      const edit = {
        at: 0,
        start: open.index + 3,
        end: first.index,
        text: ' ',
      };
      out.push(finding('leading', [open.index, endOf(first)], edit));
    }
    if (one[2].length > 1) {
      const edit = { at: 0, start: endOf(last), end: l.length - 2, text: ' ' };
      out.push(finding('trailing', [last.index, l.length], edit));
    }
    return out;
  }
  return parseItems(block.recs, preformatted).flatMap((it) =>
    it.type === 'raw'
      ? []
      : it.recs.flatMap(({ at, raw: l }, i) => {
          const words = [...l.matchAll(/[^\s\u200b]+/g)];
          const [star, first = star] = words;
          const last = words[words.length - 1];
          const out = [];
          // A tag's continuation lines and a list item's wrapped lines are
          // indented by `tag-align` and `bullet-align`, and the line that
          // closes a multi-line `{Type}` keeps its prefix.
          if (
            it.type === 'blank' ||
            (!it.bullet && !it.typed && (!it.tag || i === 0))
          ) {
            if (star.index !== indent.length + 1) {
              const edit = {
                at,
                start: 0,
                end: star.index,
                text: `${indent} `,
              };
              out.push(finding('star', [0, endOf(first)], edit));
            }
            if (first.index - star.index > 2) {
              const start = star.index + 1;
              const edit = { at, start, end: first.index, text: ' ' };
              out.push(finding('leading', [star.index, endOf(first)], edit));
            }
          }
          if (/[\s\u200b]$/.test(l)) {
            const edit = { at, start: endOf(last), end: l.length, text: '' };
            out.push(finding('trailing', [last.index, l.length], edit));
          }
          return out;
        }),
  );
}

/**
 * Finds a block's extra blank lines:  each right after its `/**`,
 * right before its `*\/`, or right after another blank line.  A blank line
 * that the block keeps as it is, as in an `@example` or a fence,
 * isn't a blank item (see `parseItems`), so it's never extra.  A block of
 * only blank lines keeps its first, so dropping the rest leaves a block that
 * `single-line` and `reflow` read as they did.  Dropping a blank line never
 * changes how the other lines are read, since a line is read the same after
 * one blank line as after several, or at the block's start.
 *
 * @param {string} text - the block, from its `/**` to its `*\/`
 * @param {string} indent - the whitespace before the block on its line
 * @param {BlockOptions} [options] - how to read the block
 * @returns {number[]} the index in the block of each extra blank
 *                     line, in order
 */
export function extraBlanks(text, indent, { preformatted } = {}) {
  if (!text.includes('\n')) return [];
  const items = itemsOf(text, indent, preformatted);
  const inked = items.flatMap((it, i) => (it.type === 'blank' ? [] : [i]));
  const [first, last] = [inked[0], inked[inked.length - 1]];
  /**
   * @type {(i: number) => boolean}
   */
  const extra = (i) =>
    inked.length
      ? i < first || i > last || items[i - 1].type === 'blank'
      : i > 0;
  return items.flatMap((it, i) =>
    it.type === 'blank' && extra(i) ? [it.recs[0].at] : [],
  );
}

/**
 * @param {string} text - the block, from its `/**` to its `*\/`
 * @param {string} indent - the whitespace before the block on its line
 * @param {BlockOptions} [options] - how to read the block
 * @returns {string} the block without its extra blank lines
 *                   (see `extraBlanks`)
 */
export function dropBlanks(text, indent, options) {
  const extra = new Set(extraBlanks(text, indent, options));
  return `${indent}${text}`
    .split('\n')
    .filter((_, at) => !extra.has(at))
    .join('\n')
    .slice(indent.length);
}

/**
 * Matches the whitespace at the end of a line, a zero-width space included.
 */
const TRAILING = /[\s\u200b]+$/;

/**
 * Finds the text on a multi-line block's `/**` line (kind `opening`) and on
 * its `*\/` line (kind `closing`), past the closing line's `*` prefix, if it
 * has one.  None is found in a one-line block, which `single-line` spreads,
 * or in a block with a `\r`, `\u2028`, or `\u2029`, which no rule handles
 * (see `parseBlock`).  Nor is any found when the closing text is a `@ts-*`
 * directive (see `isDirective`), which TypeScript reads only from a block's
 * last line, or ends in a `*`, as in `foo **\/`, since that `*` may as well
 * be a stray star of the `*\/` as part of the text.
 *
 * @param {string} text - the block, from its `/**` to its `*\/`
 * @param {string} indent - the whitespace before the block on its line
 * @returns {Span[]} the text on each delimiter line, in order
 */
export function delimiterText(text, indent) {
  if (!text.includes('\n') || /[\r\u2028\u2029]/.test(text)) return [];
  const lines = `${indent}${text}`.split('\n');
  const last = lines.length - 1;
  const tail = lines[last].slice(0, -2).replace(TRAILING, '');
  /**
   * @type {(kind: string, at: number, line: string, from: number) => Span[]}
   */
  const inked = (kind, at, line, from) => {
    const start = line.slice(from).search(/[^\s\u200b]/);
    if (start < 0) return [];
    return [span(kind, at, from + start, line.replace(TRAILING, '').length)];
  };
  const prefix = tail.length - tail.replace(/^\s*\*?/, '').length;
  const closing = inked('closing', last, tail, prefix);
  const body = closing[0] ? tail.slice(closing[0].from.column) : '';
  if (body.endsWith('*') || isDirective(body)) return [];
  return [...inked('opening', 0, lines[0], indent.length + 3), ...closing];
}

/**
 * Moves the text on a multi-line block's `/**` and `*\/` lines
 * (see `delimiterText`) onto lines of its own, as `jsdoc/multiline-blocks`
 * does, so the block takes the form that the other rules read
 * (see `parseBlock`).  A line break and a `*` under the `/**` go right after
 * the `/**`, and a space too if no whitespace was there, so the opening text
 * reads as it would have on a line of its own:  four columns of whitespace
 * before it still make indented code, and fewer are left to `text-indent`,
 * as whitespace after it is left to `no-trailing-space`.  The whitespace
 * before the `*\/` becomes a line break and the block's indentation,
 * so the closing line keeps its prefix.  Every other line is kept as it is.
 *
 * @param {string} text - the block, from its `/**` to its `*\/`
 * @param {string} indent - the whitespace before the block on its line
 * @returns {string | null} the block with its delimiters on lines of their
 *                          own, or null if neither has text beside it
 */
export function spreadDelimiters(text, indent) {
  const spans = delimiterText(text, indent);
  if (!spans.length) return null;
  const kinds = new Set(spans.map((s) => s.kind));
  const lines = `${indent}${text}`.split('\n');
  const [first, last] = [lines[0], lines[lines.length - 1]];
  const rest = first.slice(indent.length + 3);
  const open = kinds.has('opening')
    ? [`${indent}/**`, `${indent} *${/^\s/.test(rest) ? '' : ' '}${rest}`]
    : [first];
  const close = kinds.has('closing')
    ? [last.slice(0, -2).replace(TRAILING, ''), `${indent} */`]
    : [last];
  return [...open, ...lines.slice(1, -1), ...close]
    .join('\n')
    .slice(indent.length);
}

/**
 * Whether spreading a block's delimiter lines (see `spreadDelimiters`) is
 * safe:  it changes only whitespace and line prefixes (see `onlyWhitespace`),
 * and leaves a block whose form the rules handle (see `parseBlock`).
 * Unlike `safeReflow`, it compares no kept lines, since the block before has
 * none, its form not being handled.
 *
 * @param {string} text - the block, from its `/**` to its `*\/`
 * @param {string} fixed - the block with its delimiter lines spread
 * @param {string} indent - the whitespace before the block on its line
 * @returns {boolean} whether the spread is safe
 */
export function safeSpread(text, fixed, indent) {
  return onlyWhitespace(text, fixed) && !!parseBlock(fixed, indent);
}

/**
 * Finds where a place in a block's spread (see `spreadDelimiters`) was in
 * the block as written.  The opening text keeps its columns past the `/**`,
 * the line of the `*\/` is lined up with the end of the closing line,
 * and every other line is as it was.  A place that the spread made,
 * rather than kept from the block as written, is `made`:  one on the `/**`
 * line or the `*\/` line, or in the prefix before the opening text.
 *
 * @param {string} text - the block as written, from its `/**` to its `*\/`
 * @param {string} indent - the whitespace before the block on its line
 * @param {string} spread - the block spread
 * @param {Place} place - a place in the spread
 * @returns {Place & { made: boolean }} where it was in the block as written
 */
export function writtenPlace(text, indent, spread, { at, column }) {
  const kinds = new Set(delimiterText(text, indent).map((s) => s.kind));
  const lines = `${indent}${text}`.split('\n');
  const spreadLines = `${indent}${spread}`.split('\n');
  const last = lines.length - 1;
  const opens = kinds.has('opening') ? 1 : 0;
  if (opens && at === 0) return { at, column, made: true };
  if (opens && at === 1) {
    // Where the opening text, and any whitespace before it, starts.
    const start = spreadLines[1].length - lines[0].length + indent.length + 3;
    const shift = indent.length + 3 - start;
    return { at: 0, column: column + shift, made: column < start };
  }
  if (kinds.has('closing') && at === spreadLines.length - 1) {
    const back = spreadLines[at].length - column;
    return {
      at: last,
      column: Math.max(lines[last].length - back, 0),
      made: true,
    };
  }
  return { at: at - opens, column, made: false };
}

/**
 * Finds where a block's line breaks differ from its reflow's, which has
 * the same words.  Only the first difference is reported until both break at
 * the same gap again, since later ones follow from it.  If none is found,
 * each differing line is reported, or the whole block if the line
 * counts differ.
 *
 * @param {string} text - the block, from its `/**` to its `*\/`
 * @param {string} fixed - its reflow, with the same words
 * @param {string} indent - the whitespace before the block on its line
 * @returns {Span[]} spans of kind `break`, `join`, or `reflow`
 */
export function misflowed(text, fixed, indent) {
  const was = placeWords(text, indent);
  const now = placeWords(fixed, indent);
  const out = [];
  let synced = true;
  for (let k = 0; k < was.length - 1; k++) {
    const wasBreak = was[k].endAt !== was[k + 1].at;
    const nowBreak = now[k].endAt !== now[k + 1].at;
    if (wasBreak && nowBreak) synced = true;
    else if (wasBreak !== nowBreak && synced) {
      synced = false;
      const [a, b] = [was[k], was[k + 1]];
      const kind = nowBreak ? 'break' : 'join';
      out.push(span(kind, a.at, a.start, b.end, b.endAt));
    }
  }
  if (out.length) return out;

  const lines = `${indent}${text}`.split('\n');
  const fixedLines = `${indent}${fixed}`.split('\n');
  const last = lines.length - 1;
  if (lines.length !== fixedLines.length) {
    return [span('reflow', 0, indent.length, lines[last].length, last)];
  }
  return lines.flatMap((l, at) =>
    l === fixedLines[at]
      ? []
      : [span('reflow', at, Math.max(l.search(/\S/), 0), l.length)],
  );
}

/**
 * The words of a block, without its delimiters and line prefixes.  A fix must
 * keep these, so it only changes whitespace.  Words that no space belongs
 * between count as one, so reflow may join them.
 *
 * @param {string} text - a JSDoc block
 * @returns {string[]} its words, in order
 */
export function wordsOf(text) {
  return placeWords(text, '')
    .slice(1, -1)
    .map((w) => w.word);
}

/**
 * @param {string} s - text
 * @returns {string} the text without its whitespace, as the rules read it,
 *                   which a fix that changes only whitespace keeps
 */
export const inkOf = (s) => s.replace(/[\s\u200b]/g, '');

/**
 * Finds the lines a block keeps as they are (see `parseItems`), each with its
 * text past its ` * ` prefix and whether it's code.  A reflow changes none of
 * these lines, and no fix changes code.
 *
 * @param {string} text - the block, from its `/**` to its `*\/`
 * @param {string} indent - the whitespace before the block on its line
 * @param {BlockOptions} [options] - how to read the block
 * @returns {{ at: number, text: string, code: boolean }[]}
 *   the lines, in order
 */
export const keptOf = (text, indent, { preformatted } = {}) =>
  itemsOf(text, indent, preformatted).flatMap((it) =>
    it.type === 'raw'
      ? [{ at: it.at, text: it.raw.replace(/^\s*\* ?/, ''), code: it.code }]
      : [],
  );

/**
 * Whether edits to a block keep its code (see `keptOf`) on the same lines,
 * the same past their prefixes.
 *
 * @param {string} text - the block, from its `/**` to its `*\/`
 * @param {string} indent - the whitespace before the block on its line
 * @param {Edit[]} edits - changes to it, in order
 * @param {BlockOptions} [options] - how to read the block
 * @returns {boolean} whether they keep it
 */
export function keepsCode(text, indent, edits, options) {
  /**
   * @type {(t: string) => string}
   */
  const code = (t) =>
    JSON.stringify(
      keptOf(t, indent, options).flatMap((k) => (k.code ? [k.at, k.text] : [])),
    );
  return code(applyEdits(text, indent, [...edits])) === code(text);
}

/**
 * Whether a fix that replaces a whole block leaves a well-formed block,
 * which opens with `/**`, closes with its only `*\/`, and has a `*` starting
 * each later line, and changes only whitespace:  it keeps every word
 * (see `wordsOf`) and every other character, apart from the delimiters and
 * line prefixes.
 *
 * @param {string} text - the block, from its `/**` to its `*\/`
 * @param {string} fixed - the block after the fix
 * @returns {boolean} whether the fix is safe
 */
export function onlyWhitespace(text, fixed) {
  /**
   * @type {(t: string) => string}
   */
  const ink = (t) => inkOf(t.slice(3, -2).replace(/\n\s*\*/g, ''));
  return (
    fixed.startsWith('/**') &&
    fixed.indexOf('*/', 3) === fixed.length - 2 &&
    fixed
      .split('\n')
      .slice(1)
      .every((l) => /^\s*\*/.test(l)) &&
    ink(fixed) === ink(text) &&
    wordsOf(fixed).join(' ') === wordsOf(text).join(' ')
  );
}

/**
 * Whether a reflow is safe:  it changes only whitespace (see `onlyWhitespace`)
 * and keeps each line that the block keeps as it is (see `keptOf`),
 * past its prefix.
 *
 * @param {string} text - the block, from its `/**` to its `*\/`
 * @param {string} fixed - its reflow
 * @param {string} indent - the whitespace before the block on its line
 * @param {BlockOptions} [options] - how to read the block
 * @returns {boolean} whether the reflow is safe
 */
export function safeReflow(text, fixed, indent, options) {
  /**
   * @type {(t: string) => string}
   */
  const kept = (t) =>
    JSON.stringify(keptOf(t, indent, options).map((k) => k.text));
  return onlyWhitespace(text, fixed) && kept(fixed) === kept(text);
}
