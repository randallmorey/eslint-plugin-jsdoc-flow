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
 * What may open a token before its first letter, in a pattern:
 * brackets, quotes, emphasis, and the masked whitespace just inside a link's
 * `[`, which `link-spacing` removes, so a word is read the same
 * before and after.
 */
const OPENING = `^[("'[*_${MASKS}]*`;

/**
 * Matches a token that starts with a capital, after any opening brackets,
 * quotes, and emphasis.
 */
const CAPITAL = new RegExp(`${OPENING}\\p{Lu}`, 'u');

/**
 * Matches a token that starts with a digit, after the same.
 */
const DIGIT = new RegExp(`${OPENING}\\d`);

/**
 * Whether a token starts with a capital, after any opening brackets, quotes,
 * and emphasis.  Code, numbers, and `{...}` don't count, since they're cased
 * the same anywhere.
 *
 * @param {string | undefined} t - a token, or undefined
 * @returns {boolean} whether it starts with a capital letter
 */
const capitalized = (t) => CAPITAL.test(t ?? '');

/**
 * @param {string | undefined} t - a token, or undefined
 * @returns {boolean} whether it starts with a digit
 */
const numeric = (t) => DIGIT.test(t ?? '');

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
 * Matches the start of an inline tag, such as `{@link`, in `blankCode` output.
 */
const INLINE_TAG = /^\{@[A-Za-z][^\s\u200b{}|]*/;

/**
 * Matches the `[label]` of a reference link, after its text's `]`.
 */
const REF_LABEL = /\[[^\]]*\]/y;

/**
 * Finds the part of a span (see `SPANS`) whose spacing `link-spacing` fixes:
 * the text of a Markdown link, from just past its `[`, or an inline tag's,
 * from just past its name.  A `{Type}`, an `[optional]` name, a code span,
 * a link's destination, and a reference's label are left alone.
 *
 * @param {string} blanked - text, with its code spans blanked
 * @param {number} start - where the span starts
 * @param {number} end - where it ends
 * @returns {{ from: number, to: number, tag: boolean } | null}
 *   where the part starts and ends, and whether it's an inline tag's, or null
 *   if the span has none
 */
function spanText(blanked, start, end) {
  const open = blanked[start];
  if (open === '{') {
    const tag = INLINE_TAG.exec(blanked.slice(start, end));
    return tag && { from: start + tag[0].length, to: end - 1, tag: true };
  }
  if (open !== '[') return null;
  if (blanked[end - 1] === ')') {
    return { from: start + 1, to: blanked.indexOf(']', start), tag: false };
  }
  REF_LABEL.lastIndex = end;
  return REF_LABEL.test(blanked)
    ? { from: start + 1, to: end - 1, tag: false }
    : null;
}

/**
 * A change to text:  it replaces the characters `start` to `end` with `text`.
 *
 * @typedef {{ start: number, end: number, text: string }} TextEdit
 */

/**
 * Finds the whitespace inside inline tags, such as `{@link ...}`,
 * and Markdown link text that isn't spaced as reflow writes it:  one space
 * between words, one after a tag's name, and none just inside a link's `[`
 * and `]` or a tag's `}`.  `mask` makes these spans unbreakable,
 * so the spacing rules never see inside them.  Whitespace in a code span is
 * kept, and a run of one character, as a tab, is left to `exoticSpaces`,
 * so no gap's width depends on which rule runs first.  A gap across a line
 * break is reflow's, which joins it with one space.
 *
 * @param {string} s - text, its lines joined with `\n`
 * @returns {TextEdit[]} the edits that fix it, in order
 */
function linkGaps(s) {
  const blanked = blankCode(s);
  const ends = braceEnds(blanked);
  /**
   * @type {TextEdit[]}
   */
  const out = [];
  // The spans are walked as `mask` walks them, so a span inside a `{Type}`
  // or a link is part of it.
  SPANS.lastIndex = 0;
  for (let m = SPANS.exec(blanked); m; m = SPANS.exec(blanked)) {
    const end = m[0] === '{' ? (ends.get(m.index) ?? -1) : SPANS.lastIndex;
    if (end < 0) continue;
    SPANS.lastIndex = end;
    const part = spanText(blanked, m.index, end);
    if (!part) continue;
    const { from, to, tag } = part;
    // A reference's label isn't another span.
    if (!tag && blanked[end - 1] === ']') SPANS.lastIndex = REF_LABEL.lastIndex;
    for (const gap of blanked.slice(from, to).matchAll(/[\s\u200b]+/g)) {
      const start = from + gap.index;
      const stop = start + gap[0].length;
      if (gap[0].includes('\n')) continue;
      const edge = stop === to || (!tag && start === from);
      const text = edge ? '' : ' ';
      if (edge || gap[0].length > 1) out.push({ start, end: stop, text });
    }
  }
  return out;
}

/**
 * @param {string} s - text on one line
 * @returns {string} the text with its links spaced (see `linkGaps`)
 */
const tidyLinks = (s) =>
  linkGaps(s).reduceRight(
    (t, { start, end, text }) => t.slice(0, start) + text + t.slice(end),
    s,
  );

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
 * @property {Bullet} [bullet] - the marker of the list item it is,
 *                               on its first line
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
 * Matches a run of leader characters, as between the columns of a list laid
 * out by hand.  Three dots are an ellipsis, so it takes four.
 */
const LEADER = /^[-.·_]{4,}$/;

/**
 * Finds the gaps in a list item's text that look laid out by hand, as between
 * two columns:  three or more spaces, or leader characters after two or more
 * spaces and before a word.  No fix writes either, so a fix to an item that
 * isn't kept can only remove them.  Two spaces after a sentence's end or
 * a colon are its usual spacing, so leaders there don't count, and neither do
 * gaps inside a span (see `mask`).
 *
 * Each gap is placed by where it ends, counting the text before it without
 * its whitespace, which the spacing rules change, but with a span's,
 * which they don't.  So the places don't change unless the gap goes.
 *
 * @param {Bullet} bullet - the item's marker
 * @param {BodyLine} r - its line
 * @returns {Set<number>} the place of each such gap
 */
function layoutGaps(bullet, r) {
  const from = bullet.start - r.offset + bullet.marker.length;
  const text = plainOf(r.content)
    .slice(from + bullet.gap.length)
    .trimEnd();
  const words = Array.from(
    mask(text).matchAll(/( *)(\S+)/g),
    ([, gap, word]) => ({ gap, word }),
  );
  const out = new Set();
  let ink = 0;
  for (const [k, { gap, word }] of words.entries()) {
    if (gap.length >= 3) out.add(ink + gap.length);
    if (
      gap.length >= 2 &&
      k + 1 < words.length &&
      LEADER.test(word) &&
      !/[.!?:][^\p{L}\p{N}]*$/u.test(words[k - 1].word)
    )
      out.add(ink + word.length);
    ink += word.length;
  }
  return out;
}

/**
 * A list item's wrapped lines start under its text, one space after its
 * marker as `bullet-spacing` spaces it, so `reflow` and `bullet-align` agree
 * whatever the gap is now.  They start at least one space after the `*`,
 * so they stay body lines.  An item that `bullet-indent` or `list-nesting`
 * moves is read where it moves to (see `misindented` and `misnested`), so
 * `reflow`, `bullet-align`, `bullet-indent` and `list-nesting` agree in
 * any order.
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
 * of code has only in an `@example`.  Its `bullet` is the marker of a list
 * item kept as it is, as in a table, it's `listed` if it's a line of a list
 * laid out by hand (see `parseItems`), and its `fence` is whether it opens or
 * closes a Markdown fence outside an `@example`.
 *
 * @typedef {{ type: 'blank', recs: BodyLine[] }} Blank
 * @typedef {{ type: 'raw', raw: string, at: number, code: boolean, inType: boolean, tag: string | undefined, bullet?: Bullet, listed?: boolean, fence?: 'open' | 'close' }} Raw
 * @typedef {Blank | Raw | Para} Item
 */

/**
 * Turns the body lines of a block into items:  blank, raw (kept as is),
 * or para (a paragraph, a list item with its wrapped lines, or a tag with its
 * continuation lines).  Raw covers tables, headings, blockquotes, fenced and
 * indented code, HTML blocks, `@example`, and a tag's multi-line `{Type}`.
 * With `preformatted`, what looks like unfenced code or a diagram is raw too
 * (see `runFrom`), and so is a list laid out by hand (see `laidOutEnd`).
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
   * Whether the fence being kept is a Markdown fence outside an `@example`,
   * whose edges `padding-lines` sets off.
   */
  let fenced = false;
  /**
   * The preformatted run being kept:  the indentation a line must be past to
   * stay in it (`above`), and the body line index it ends at (`end`).
   *
   * @type {{ above: number, end: number }}
   */
  let run = { above: 0, end: 0 };
  /**
   * The body line index that the list laid out by hand being kept ends at.
   */
  let listEnd = 0;
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
   * @type {(r: BodyLine, bullet?: Bullet, listed?: boolean, fence?: 'open' | 'close') => void}
   */
  const raw = (r, bullet, listed, fence) => {
    const tag = !mode || mode === 'example' ? leadingTag(r.content) : undefined;
    const { raw: line, at } = r;
    const [code, inType] = [!!mode, !!type];
    items.push({
      type: 'raw',
      raw: line,
      at,
      code,
      inType,
      tag,
      bullet,
      ...(listed && { listed }),
      ...(fence && { fence }),
    });
  };
  /**
   * @type {(r: BodyLine) => Bullet | undefined}
   */
  const itemOf = (r) => {
    const line = plainOf(strip(r.content));
    return KEPT.test(line) || OWN_LINE.test(line) ? undefined : bulletOf(r);
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
  /**
   * Finds the end of the list laid out by hand that starts at a list item's
   * line, if any:  its lines up to a blank line, a tag, or a fence, in which
   * two items have a gap (see `layoutGaps`) in the same place, as in a list
   * of two columns.  Its lines are kept as they are, so no fix changes its
   * gaps, and no fix to a list that isn't kept adds one or moves one
   * into place.  The places are counted from the items' text, so neither
   * `bullet-indent` nor `bullet-spacing` changes them.
   *
   * @type {(i: number) => number}
   */
  const laidOutEnd = (i) => {
    let end = i;
    while (end < recs.length && !endsRun(plainOf(strip(recs[end].content))))
      end++;
    const seen = new Set();
    for (const r of recs.slice(i, end)) {
      const bullet = itemOf(r);
      const gaps = bullet ? layoutGaps(bullet, r) : new Set();
      if ([...gaps].some((g) => seen.has(g))) return end;
      for (const g of gaps) seen.add(g);
    }
    return i;
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
      const closes = mode === 'fence' && !!closer?.test(s);
      raw(r, undefined, false, closes && fenced ? 'close' : undefined);
      if (closes) {
        mode = resume;
        resume = null;
        fenced = false;
      }
      continue;
    }

    // Indented code starts only at the block's start or after a blank line,
    // never inside a paragraph or a list item.  A table row sets no mode,
    // so the line after it is read afresh.
    mode = null;
    if (s === '' || isTag(s)) table = false;
    else if (DELIMITER.test(line) && !line.startsWith('|')) table = true;
    if (i < listEnd) {
      raw(r, itemOf(r), true);
      continue;
    }
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
      fenced = !!fence;
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
      own ||
      table ||
      /^\|/.test(line) ||
      (s !== '' && aboveUnderline(i))
    ) {
      flush();
      raw(r, bullet, false, fenced ? 'open' : undefined);
      // Verbatim HTML may close on the line it opens on.
      if (mode === 'fence' && verbatim?.test(line)) mode = null;
      continue;
    }
    // A list item is flowed as a paragraph of the text after its marker,
    // and its wrapped lines join it.
    if (bullet) {
      flush();
      if (preformatted) listEnd = laidOutEnd(i);
      if (i < listEnd) {
        raw(r, bullet, true);
        continue;
      }
      const text = r.content.slice(
        bullet.start - r.offset + bullet.marker.length,
      );
      cur = {
        type: 'para',
        tag: false,
        parts: [strip(text)],
        recs: [r],
        bullet,
      };
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
    } else cur = { type: 'para', tag: isTag(s), parts: [s], recs: [r] };
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
 * A paragraph's text as reflow spaces it (see `spacedText`):  its `tokens`,
 * whether each is `wide`, how many make up a tag's `head`, where each starts
 * (`col`) in the spaced text (`full`), and where a tag's description starts
 * (`hang`), past the head's end if it has none.
 *
 * @typedef {{ tokens: string[], wide: boolean[], head: number, col: number[], full: string, hang: number }} Spaced
 */

/**
 * Spaces text as reflow writes it:  its words joined into tokens by `tight`,
 * each followed by the space `sepAfter` puts there, and one space before
 * a tag's `-`.  `reflow` fills these tokens, and `tag-align` measures a tag's
 * head with them, so both read the head as the spacing and punctuation rules
 * leave it, and every order of the rules hangs a tag at the same column.
 * The whitespace inside a masked span stays as it is, so a code span's text
 * never changes, except in a link, which is spaced as
 * `link-spacing` spaces it.
 *
 * @param {string} text - the text
 * @param {boolean} tag - whether it starts a tag
 * @param {string} [typed] - the tag's name (see `headSize`)
 * @param {1 | 2} [spaces] - the spaces after a sentence end or a colon
 * @returns {Spaced} the text, spaced
 */
function spacedText(text, tag, typed, spaces) {
  const plain = mask(tidyLinks(text))
    .replace(/[\s\u200b]/g, ' ')
    .trim();
  const words = plain.split(/ +/);
  const gaps = (plain.match(/ +/g) ?? []).map((gap) => wideIn(gap, spaces));
  const { tokens, last } = joinTight(words);
  const wide = last.map((k) => gaps[k]);
  const sep = tokens.map((t, k) => sepAfter(t, tokens[k + 1], wide[k], spaces));
  // One space goes before a tag's `-`, whatever the word before it ends in.
  const dash = tag ? separatorOf(tokens, typed) : -1;
  if (dash > 0) sep[dash - 1] = ' ';
  const head = tag ? headSize(tokens, typed) : 0;
  /**
   * @type {number[]}
   */
  const col = [];
  let full = '';
  for (const [k, t] of tokens.entries()) {
    col.push(full.length);
    full += t + sep[k];
  }
  const hang = head < tokens.length ? col[head] : full.length;
  return { tokens, wide, head, col, full, hang };
}

/**
 * A paragraph to fill:  whether it's a tag, its lines' text, the tag's name
 * if it's `typed` (see `Para`), and the list marker and space before its text
 * on its first line (`lead`), if it's a list item.
 *
 * @typedef {{ tag: boolean, parts: string[], typed?: string, lead?: string }} Fillable
 */

/**
 * Fills a paragraph into lines (see `fillLines`).  Text after a line that
 * ends in a hard break is filled on its own, so the break stays.
 *
 * @param {Fillable} item - the paragraph
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
 * @param {Fillable} item - the paragraph
 * @param {string} firstPrefix - what starts its first line, a list item's
 *                               `lead` included
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
  // spaces after a token.
  const { tokens, wide, head, col, full, hang } = spacedText(
    item.parts.join(' '),
    item.tag,
    item.typed,
    spaces,
  );
  const n = tokens.length;
  const ends = tokens.map((t, k) => endsSentence(t, tokens[k + 1], wide[k]));
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
    // as a fence would, as ```` ```js a b` ```` would at `a`.  A list item's
    // is read with its marker, as `- - - then` would be at the last `-`.
    const first =
      col[k] + t.length <= constructEnd ? (item.lead ?? '') + textOf(0, k) : '';
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

  // A tag's later lines hang at its description's column.
  contPrefix += ' '.repeat(hangOf(hang, limits.maxHead));

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
  if (
    one &&
    items.length === 1 &&
    items[0].type === 'para' &&
    !items[0].bullet
  ) {
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
    if (it.type === 'raw') return keptLine(it);
    const [r] = it.recs;
    if (it.bullet) {
      // A list item's line keeps its prefix, unless `bullet-indent` or
      // `list-nesting` moves it, and its marker is followed by one space,
      // as `bullet-spacing` spaces it.  In a one-line block, the marker's
      // column is on the block's line (see `parseBlock`), so it's counted on
      // the body line instead.
      const start =
        it.bullet.start + r.raw.length - r.content.length - r.offset;
      const bullet = { ...it.bullet, start };
      const hang = hangPrefix(bullet, indent, moved);
      const column = moved.get(r.at);
      const before = column
        ? `${indent} *`.padEnd(column)
        : r.raw.slice(0, start);
      const lead = `${bullet.marker} `;
      const item = { ...it, lead };
      return fillPara(item, before + lead, hang, width, limits, spaces);
    }
    // The line that closes a multi-line `{Type}` keeps its own prefix.
    const first = it.typed ? r.raw.slice(0, r.offset) : pre;
    return fillPara(it, first, pre, width, limits, spaces);
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
 * limit (see `headLimit`).  The head is measured as the spacing and
 * punctuation rules will leave it (see `spacedText`), so the column is
 * the same in any order.  Moving words is reflow's job, so only the lines
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
    const { hang } = spacedText(it.recs[0].content, true, it.typed, spaces);
    const column = pre.length + hangOf(hang, limit);
    return realign(it.recs.slice(1), `${indent} *`.padEnd(column));
  });
}

/**
 * Finds a list item's wrapped lines that don't start under its text
 * (see `hangPrefix`).  The item's own line is left to `bullet-indent`,
 * and the wrapped lines of an item that `misnested` moves are left to it.
 *
 * @param {string} text - the block, from its `/**` to its `*\/`
 * @param {string} indent - the whitespace before the block on its line
 * @param {BlockOptions} [options] - how to read and space the block
 * @returns {Alignment[]} an `Alignment` for each such line
 */
export function mishung(text, indent, { preformatted } = {}) {
  const moved = movedOf(text, indent, { preformatted });
  const nested = new Set(
    misnested(text, indent, { preformatted }).map((n) => n.at),
  );
  return parasOf(text, indent, preformatted).flatMap((it) =>
    it.bullet && !nested.has(it.recs[0].at)
      ? realign(it.recs.slice(1), hangPrefix(it.bullet, indent, moved))
      : [],
  );
}

/**
 * A list item of a block, and where it is in its list:  its own `line`,
 * how far it's indented past the one space after its `*`
 * (`from`, see `indentOf`), how far it should be (`to`), how deep it's nested
 * (`level`), whether it starts short of its parent's text (`misnested`),
 * whether its list has an item that does (`nested`), and whether its list is
 * left as it is (`kept`).
 *
 * @typedef {{ line: Pick<BodyLine, 'raw' | 'at'>, from: number, to: number, level: number, misnested: boolean, nested: boolean, kept: boolean }} ListItem
 */

/**
 * How far past the marker of the item it would be a sibling of an item must
 * start to be read as that item's child, though it starts short of its text
 * (see `listItemsOf`).  Two columns is the usual indent under a bullet, so it
 * shows the author meant a child, while one is a slip that `bullet-indent`
 * lines up with its siblings.
 */
const NEST = 2;

/**
 * Finds a block's list items and where each should start.  A list runs over
 * items, with their wrapped lines, and blank lines, and anything else ends it.
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
 * An item that starts `NEST` or more columns past the marker of the item it
 * would be a sibling of, but short of its text, as `  - b` does under
 * `1. a`, is read as that item's child, as its author meant, and is
 * misnested.  It should start at its parent's text, or in line with
 * the items already at its level.  `list-nesting` moves every item of a list
 * with a misnested item, and `bullet-indent` every item of any other list,
 * so each rule moves its lists all the way at once, whichever runs first.
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
   * The open item at each level:  the columns its marker and text start at,
   * how far it moves, and whether it's a paragraph, rather than a line of
   * a list laid out by hand.
   *
   * @type {{ from: number, text: number, to: number, shift: number, para: boolean }[]}
   */
  let open = [];
  let first = 0;
  const end = () => {
    const list = out.slice(first);
    const kept = list.some((l) => l.kept);
    const nested = list.some((l) => l.misnested);
    for (const l of list) Object.assign(l, { kept, nested });
    open = [];
    first = out.length;
  };
  for (const it of items) {
    // A laid-out item's wrapped lines are kept too, and stay in its list.
    if (it.type === 'blank' || (it.type === 'raw' && it.listed && !it.bullet))
      continue;
    if (!it.bullet) {
      end();
      continue;
    }
    const line = it.type === 'raw' ? it : it.recs[0];
    const from = indentOf(line);
    const para = it.type === 'para';
    let parent = open.length - 1;
    while (parent >= 0 && from < open[parent].text) parent--;
    // The loop leaves `from` short of the would-be sibling's text.
    const sibling = open[parent + 1];
    const misnested = para && !!sibling?.para && from >= sibling.from + NEST;
    if (misnested) parent++;
    const level = parent + 1;
    const above = open[parent];
    const to =
      open[level]?.to ??
      (misnested ? above.text + above.shift : from + (above?.shift ?? 0));
    const kept = !!above && from - above.text >= 4;
    open = open.slice(0, level);
    open.push({
      from,
      text: from + it.bullet.marker.length + 1,
      to,
      shift: to - from,
      para,
    });
    out.push({ line, from, to, level, misnested, nested: false, kept });
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
    listItemsOf(items).map(({ line, level }) => [line.at, level]),
  );
  return JSON.stringify(
    items.map((it) =>
      it.type === 'raw'
        ? [it.at, it.code, levels.get(it.at)]
        : [it.type, levels.get(it.recs[0].at), ...it.recs.map((r) => r.at)],
    ),
  );
}

/**
 * Finds the list items of a block that don't start in line with the other
 * items at their level (see `listItemsOf`).  Each fix replaces the item's
 * line prefix, `*` and all, as `bullet-align` does for its wrapped lines.
 * If the fixes together would change how any line of the block is read, as by
 * moving an item into indented code, there are none.  A list with a misnested
 * item is left to `misnested`.
 *
 * @param {string} text - the block, from its `/**` to its `*\/`
 * @param {string} indent - the whitespace before the block on its line
 * @param {BlockOptions} [options] - how to read the block
 * @returns {Alignment[]} an `Alignment` for each such item
 */
export function misindented(text, indent, { preformatted } = {}) {
  const items = itemsOf(text, indent, preformatted);
  const edits = listItemsOf(items).flatMap((l) =>
    l.kept || l.nested || l.from === l.to ? [] : [moveItem(l, indent, l.to)],
  );
  return keepsShape(text, indent, preformatted, edits) ? edits : [];
}

/**
 * @param {ListItem} item - a list item
 * @param {string} indent - the whitespace before the block on its line
 * @param {number} to - how far its text should be indented past the one
 *                      space after its `*`
 * @returns {Alignment} the `Alignment` that replaces its line's prefix,
 *                      `*` and all
 */
function moveItem({ line }, indent, to) {
  const prefix = `${indent} *`.padEnd(indent.length + 3 + to);
  const end =
    line.raw.length - line.raw.replace(/^\s*\*[\s\u200b]*/, '').length;
  return { at: line.at, start: 0, end, text: prefix, column: prefix.length };
}

/**
 * @param {string} text - the block, from its `/**` to its `*\/`
 * @param {string} indent - the whitespace before the block on its line
 * @param {boolean | undefined} preformatted - whether to keep unfenced code
 * @param {Edit[]} edits - changes to the block, in order
 * @returns {boolean} whether there are some, and they change neither how any
 *                    line of the block is read nor any list item's level
 *                    (see `shapeOf`)
 */
const keepsShape = (text, indent, preformatted, edits) =>
  !!edits.length &&
  shapeOf(applyEdits(text, indent, [...edits]), indent, preformatted) ===
    shapeOf(text, indent, preformatted);

/**
 * What `misnested` finds:  an `Alignment` that moves a list item's line,
 * whether the item is misnested itself or moves with its list
 * (`misnested`), and the `Alignment` of each of its wrapped lines that
 * doesn't hang under its text where it moves to (`hung`).
 *
 * @typedef {Alignment & { misnested: boolean, hung: Alignment[] }} Nesting
 */

/**
 * Finds the list items of a block that are misnested (see `listItemsOf`),
 * which CommonMark reads as siblings of the item they're nested under,
 * and the other items of their lists that don't start where they should
 * once those are nested, as `misindented` would find them in another list.
 * Each item's wrapped lines are hung under its text where it moves to
 * (see `hangPrefix`), so `bullet-align` leaves them alone.  If the fixes
 * together would change how any line of the block is read, as by moving
 * an item into indented code, there are none.
 *
 * @param {string} text - the block, from its `/**` to its `*\/`
 * @param {string} indent - the whitespace before the block on its line
 * @param {BlockOptions} [options] - how to read the block
 * @returns {Nesting[]} a `Nesting` for each such item
 */
export function misnested(text, indent, { preformatted } = {}) {
  const items = itemsOf(text, indent, preformatted);
  const moves = listItemsOf(items).flatMap((l) =>
    l.kept || !l.nested || l.from === l.to
      ? []
      : [{ ...moveItem(l, indent, l.to), misnested: l.misnested }],
  );
  const moved = new Map(moves.map((a) => [a.at, a.column]));
  const paras = new Map(
    items.flatMap((it) => (it.type === 'para' ? [[it.recs[0].at, it]] : [])),
  );
  const nests = moves.map((move) => {
    // An item kept as it is, as in a table, has no wrapped lines.
    const it = paras.get(move.at);
    const hung = it?.bullet
      ? realign(it.recs.slice(1), hangPrefix(it.bullet, indent, moved))
      : [];
    return { ...move, hung };
  });
  const edits = nests.flatMap((n) => [n, ...n.hung]);
  return keepsShape(text, indent, preformatted, edits) ? nests : [];
}

/**
 * @param {string} text - the block, from its `/**` to its `*\/`
 * @param {string} indent - the whitespace before the block on its line
 * @param {BlockOptions} [options] - how to read the block
 * @returns {Map<number, number>} the column each item that `misindented` or
 *                                `misnested` moves will start at, by its line
 */
const movedOf = (text, indent, options) =>
  new Map(
    [
      ...misindented(text, indent, options),
      ...misnested(text, indent, options),
    ].map((a) => [a.at, a.column]),
  );

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
 * Finds the whitespace inside a block's inline tags and Markdown link text
 * that isn't spaced as reflow writes it (see `linkGaps`).  Only text that
 * reflow modifies is checked, so a table, a heading, and code are left as
 * they are.  A span may cross lines, so each paragraph is read whole.
 *
 * @param {string} text - the block, from its `/**` to its `*\/`
 * @param {string} indent - the whitespace before the block on its line
 * @param {BlockOptions} [options] - how to read the block
 * @returns {Finding[]} findings of kind `link`, one per such gap
 */
export function misspanned(text, indent, { preformatted } = {}) {
  return parasOf(text, indent, preformatted).flatMap((it) => {
    const contents = it.recs.map((r) => r.content);
    return linkGaps(contents.join('\n')).map(({ start, end, text: t }) => {
      // A gap never crosses a line break, so it's on one line.
      let [i, from] = [0, start];
      while (from > contents[i].length) from -= contents[i++].length + 1;
      const [c, r, to] = [contents[i], it.recs[i], from + end - start];
      const before = c.slice(0, from).search(/[^\s\u200b]*$/);
      const after = to + c.slice(to).search(/[\s\u200b]|$/);
      return finding('link', [r.offset + before, r.offset + after], {
        at: r.at,
        start: r.offset + from,
        end: r.offset + to,
        text: t,
      });
    });
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
    if (it.type === 'blank' || !it.bullet || it.bullet.gap.length === 1)
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
 * Finds each word of a paragraph, masked (see `mask`), without a list item's
 * marker, whose spacing is `bullet-spacing`'s.  A span may cross lines,
 * so the paragraph is masked as a whole, then split.
 *
 * @param {Para} it - the paragraph
 * @returns {{ at: number, start: number, end: number, word: string, gap: string }[]}
 *   each word's position, text, and the `gap` before it
 */
function placeParaWords(it) {
  const masked = mask(it.recs.map((r) => r.content).join('\n')).split('\n');
  return it.recs.flatMap((r, i) =>
    [...masked[i].matchAll(/([\s\u200b]*)([^\s\u200b]+)/g)]
      .slice(i === 0 && it.bullet ? 1 : 0)
      .map((m) => {
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
 * The block, with its list items lined up (see `misindented`).
 */
export const indentBullets = fixer(misindented);

/**
 * The block, with its misnested list items and their wrapped lines moved
 * under their parents' text (see `misnested`).
 */
export const nestBullets = fixer((text, indent, options) =>
  misnested(text, indent, options).flatMap((n) => [n, ...n.hung]),
);

/**
 * The block, with one space after each list item's marker (see `misbulleted`).
 */
export const spaceBullets = fixer(misbulleted);

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
 * The block, with its inline tags and link text spaced (see `misspanned`).
 */
export const fixLinks = fixer(misspanned);

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
 * (see `tight`) are found as one, since reflow joins them, and so are a word
 * after a `[` and a word before a `]` or `}`, which reflow joins in a link
 * (see `linkGaps`).
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
      const joins =
        tight(prev, m[0]) || prev.endsWith('[') || /^[\]}]/.test(m[0]);
      if (out.length > 1 && w && joins) {
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
 * Whether the whitespace after a kept line's text is checked, and removed by
 * reflow:  a markdown line kept as it is, such as a table row or a heading.
 * Code, HTML, and a multi-line `{Type}` are kept exactly, and a line with no
 * text past its `*` isn't trimmed, since it would read as a blank line.
 *
 * @param {Raw} it - a kept line
 * @returns {boolean} whether its trailing whitespace is checked
 */
const trimsEnd = (it) =>
  !it.code && !it.inType && /[^\s\u200b]/.test(it.raw.replace(/^\s*\*/, ''));

/**
 * @param {Raw} it - a kept line
 * @returns {string} the line as reflow writes it (see `trimsEnd`)
 */
const keptLine = (it) => (trimsEnd(it) ? it.raw.replace(TRAILING, '') : it.raw);

/**
 * @param {number} at - the index of a line in its block
 * @param {string} l - the line, ending in whitespace
 * @returns {Finding} a finding of kind `trailing` that removes the whitespace
 */
const trailingFinding = (at, l) => {
  const words = [...l.matchAll(/[^\s\u200b]+/g)];
  const last = words[words.length - 1];
  const start = last.index + last[0].length;
  return finding('trailing', [last.index, l.length], {
    at,
    start,
    end: l.length,
    text: '',
  });
};

/**
 * Finds the lines of a block that reflow fixes whose whitespace is off at
 * their edges:  a `*` that isn't under the `/**`, extra whitespace after it,
 * or whitespace after the text.  Of the lines that reflow keeps as they are,
 * only the whitespace after a markdown line's text is checked
 * (see `trimsEnd`).  A tag's continuation lines are left to `tag-align`,
 * and a list item's lines to `bullet-indent` and `bullet-align`.
 * The whitespace before the text is checked by its width, so a tab is left
 * to `exoticSpaces`.
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
      ? trimsEnd(it) && TRAILING.test(it.raw)
        ? [trailingFinding(it.at, it.raw)]
        : []
      : it.recs.flatMap(({ at, raw: l }, i) => {
          const words = [...l.matchAll(/[^\s\u200b]+/g)];
          const [star, first = star] = words;
          const out = [];
          // A tag's continuation lines and a list item's wrapped lines are
          // indented by `tag-align` and `bullet-align`, a list item's own line
          // by `bullet-indent`, and the line that closes a multi-line `{Type}`
          // keeps its prefix.
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
          if (TRAILING.test(l)) out.push(trailingFinding(at, l));
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
 * @param {Item} it - an item of a block
 * @returns {string} a kept line's text past its `*`, read as `plainOf` reads
 *                   it, and trimmed, or nothing if it isn't a kept line
 */
const rawText = (it) =>
  it.type === 'raw' ? plainOf(it.raw.replace(/^\s*\*/, '')).trim() : '';

/**
 * Whether an item is a line kept as Markdown, not code, and not part of
 * a tag or a list.
 *
 * @param {Item} it - an item of a block
 * @returns {boolean} whether it's such a line
 */
const markdownLine = (it) =>
  it.type === 'raw' &&
  !it.code &&
  !it.inType &&
  !it.tag &&
  !it.bullet &&
  !it.listed;

/**
 * A table among a block's items:  the index of its delimiter row
 * (`delimiter`), of its first line (`top`), which is the line above that row
 * unless that's blank or the block's start, and of its last row (`end`).
 *
 * @typedef {{ top: number, delimiter: number, end: number }} TableSpan
 */

/**
 * Finds the tables among a block's items.  A table runs from the line above
 * its delimiter row through its rows:  the lines that start with `|`, or,
 * if the delimiter row doesn't, every line up to a blank line or a tag,
 * as `parseItems` keeps them.  A line that looks like a delimiter row inside
 * a table, or right after its last row, is one of its rows, as in GFM, so no
 * blank line splits the table there.
 *
 * @param {Item[]} items - a block's items
 * @returns {TableSpan[]} its tables, in order
 */
function tablesOf(items) {
  /**
   * @type {TableSpan[]}
   */
  const out = [];
  let after = 0;
  for (const [k, it] of items.entries()) {
    if (k < after || !markdownLine(it) || !DELIMITER.test(rawText(it)))
      continue;
    const piped = rawText(it).startsWith('|');
    let end = k;
    while (end + 1 < items.length) {
      const next = items[end + 1];
      const row = piped
        ? markdownLine(next) && rawText(next).startsWith('|')
        : next.type !== 'blank' && !next.tag;
      if (!row) break;
      end++;
    }
    const top = k > 0 && items[k - 1].type !== 'blank' ? k - 1 : k;
    const above = out[out.length - 1];
    if (above?.end === k - 1) above.end = end;
    else out.push({ top, delimiter: k, end });
    after = end + 1;
  }
  return out;
}

/**
 * Matches an ATX heading's line.
 */
const HEADING = /^#{1,6}(?:\s|$)/;

/**
 * A place where a block needs a blank line (see `unpadded`):  the index in
 * the block of the line it goes before (`at`), the line of the construct it
 * sets off (`line`), which `side` of that construct it's on,
 * `what` the construct is, and whether the paragraph after it `moves` left.
 *
 * @typedef {{ at: number, line: number, side: 'before' | 'after', what: 'code fence' | 'heading' | 'table', moves: boolean }} Padding
 */

/**
 * Finds where a block needs a blank line to set off a Markdown fence, an ATX
 * heading, or a table from the text beside it, as markdownlint's MD031, MD022,
 * and MD058 do.  In GFM, a line of text right after a table is one of its
 * rows, though the rules read it as a paragraph, and a blank line settles
 * it their way.
 *
 * None goes where it could change how a line is read, or fight another rule:
 * at the block's start or end, beside a blank line, inside an `@example`,
 * a fence, or a table, before an underline, which would no longer underline
 * the line above it, before a tag, which starts a section of its own,
 * or after a tag with no description, which may be what
 * the construct describes.  Nor does one go in or after a run of lines that
 * starts at a list item, where it could make a tight list loose.  A line kept
 * as it is that's indented four columns or more would be read as indented
 * code after a blank line, so none goes before it either.  A paragraph's line
 * would too, so the fix moves its lines left, as `text-indent` would
 * (see `padBlanks`).  Every rule reads a block the same way with these blank
 * lines as without, and no other rule's fix changes where they go,
 * so the rules settle in any order.
 *
 * @param {string} text - the block, from its `/**` to its `*\/`
 * @param {string} indent - the whitespace before the block on its line
 * @param {BlockOptions} [options] - how to read and space the block
 * @returns {Padding[]} each place, in order
 */
export function unpadded(text, indent, options = {}) {
  if (!text.includes('\n')) return [];
  const { preformatted, spaces } = options;
  const items = itemsOf(text, indent, preformatted);
  const [plain, textOf] = [markdownLine, rawText];

  const table = new Map();
  const [tops, bottoms] = [new Set(), new Set()];
  for (const { top, delimiter, end } of tablesOf(items)) {
    for (let j = top; j <= end; j++) table.set(j, delimiter);
    if (top < delimiter && plain(items[top])) {
      tops.add(top);
      bottoms.add(end);
    }
  }

  /**
   * What the item at an index is, if it's an edge of a construct:  its top
   * edge if `edge` is `open`, and its bottom edge if it's `close`.
   *
   * @type {(k: number, edge: 'open' | 'close') => Padding['what'] | undefined}
   */
  const edgeOf = (k, edge) => {
    const it = items[k];
    if (it.type !== 'raw') return undefined;
    if (it.fence === edge) return 'code fence';
    if ((edge === 'open' ? tops : bottoms).has(k)) return 'table';
    if (!table.has(k) && plain(it) && HEADING.test(textOf(it)))
      return 'heading';
    return undefined;
  };
  // A run of lines that starts at a list item, up to a blank line.
  let chained = false;
  const listed = items.map((it) => {
    if (it.type === 'blank') return (chained = false);
    const bullet = it.type === 'para' ? it.bullet : it.bullet || it.listed;
    return (chained ||= !!bullet);
  });
  /**
   * Whether a tag says more than its head, as in `@param name -`.
   *
   * @type {(it: Para) => boolean}
   */
  const described = (it) => {
    const spaced = spacedText(it.parts.join(' '), true, it.typed, spaces);
    return spaced.head < spaced.tokens.length;
  };
  /**
   * @type {(it: Item) => boolean}
   */
  const above = (it) =>
    it.type === 'para'
      ? !it.tag || described(it)
      : it.type === 'raw' && (plain(it) || it.fence === 'close');
  /**
   * @type {(it: Item) => boolean}
   */
  const below = (it) =>
    it.type === 'para'
      ? !it.tag
      : it.type === 'raw' &&
        ((plain(it) && !UNDERLINE.test(textOf(it))) || it.fence === 'open') &&
        indentOf(it) < 4;
  /**
   * @type {Padding[]}
   */
  const out = [];
  for (let k = 1; k < items.length; k++) {
    const [a, b] = [items[k - 1], items[k]];
    const after = edgeOf(k - 1, 'close');
    const what = after ?? edgeOf(k, 'open');
    if (!what || listed[k] || !above(a) || !below(b)) continue;
    if (table.has(k - 1) && table.get(k - 1) === table.get(k)) continue;
    const at = b.type === 'raw' ? b.at : b.recs[0].at;
    const moves = b.type === 'para' && indentOf(b.recs[0]) >= 4;
    const side = after ? 'after' : 'before';
    const line = after ? /** @type {Raw} */ (a).at : at;
    out.push({ at, line, side, what, moves });
  }
  return out;
}

/**
 * Adds a blank line at each place in a block that needs one (see `unpadded`).
 * If the paragraph after one moves left, every line that `text-indent` moves
 * left is moved, as it would move them, since moving just the paragraph's
 * could change how the lines after it are read, as by taking a line into
 * indented code.
 *
 * @param {string} text - the block, from its `/**` to its `*\/`
 * @param {string} indent - the whitespace before the block on its line
 * @param {BlockOptions} [options] - how to read the block
 * @returns {string} the block with the blank lines
 */
export function padBlanks(text, indent, options) {
  const places = unpadded(text, indent, options);
  const moved = places.some((p) => p.moves)
    ? misedged(text, indent, options).filter((f) => f.kind === 'leading')
    : [];
  const ats = new Set(places.map((p) => p.at));
  return `${indent}${applyEdits(text, indent, moved)}`
    .split('\n')
    .flatMap((l, at) => (ats.has(at) ? [`${indent} *`, l] : [l]))
    .join('\n')
    .slice(indent.length);
}

/**
 * Matches a character whose width on screen isn't one column, or may not be:
 * a wide or fullwidth one, as in CJK text, an emoji or other pictograph,
 * a combining mark, a variation selector included, and a control or format
 * character, such as a zero-width joiner.  A table with one isn't aligned,
 * since counting its columns could misalign it.
 */
const UNEVEN =
  /[\p{M}\p{Cc}\p{Cf}\p{Extended_Pictographic}\u1100-\u115f\u2e80-\u303e\u3041-\u33ff\u3400-\u4dbf\u4e00-\u9fff\ua000-\ua4cf\ua960-\ua97f\uac00-\ud7a3\uf900-\ufaff\ufe10-\ufe19\ufe30-\ufe6f\uff00-\uff60\uffe0-\uffe6\u{1f000}-\u{1faff}\u{20000}-\u{3fffd}]/u;

/**
 * Matches a cell of a table's delimiter row, as GFM reads it.
 */
const DELIMITER_CELL = /^:?-+:?$/;

/**
 * @param {string} s - text, read as `plainOf` reads it
 * @returns {number} how many columns it takes, one per code point
 */
const widthOf = (s) => [...s].length;

/**
 * A table row's cells, and whether it has a `|` at its start (`lead`) and at
 * its end (`trail`).  Each cell's `text` is trimmed (see `strip`) and read as
 * `plainOf` reads it, and its `width` is that text's (see `widthOf`).
 *
 * @typedef {{ cells: { text: string, width: number }[], lead: boolean, trail: boolean }} Row
 */

/**
 * Splits a table row into its cells as GFM does, at each `|` that no `\`
 * escapes, inside a code span too.
 *
 * @param {string} row - the row's text, without the whitespace at its ends
 * @returns {Row} its cells, and whether it has edge pipes
 */
function cellsOf(row) {
  const parts = [''];
  for (let k = 0; k < row.length; k++) {
    if (row[k] === '|') {
      parts.push('');
      continue;
    }
    // A `\` escapes the character after it, so a `\|` stays in its cell.
    const from = k;
    if (row[k] === '\\') k++;
    parts[parts.length - 1] += row.slice(from, k + 1);
  }
  const lead = row.startsWith('|');
  const trail = parts.length > 1 && parts[parts.length - 1] === '';
  const inner = parts.slice(lead ? 1 : 0, trail ? -1 : undefined);
  const cells = inner.map((p) => {
    const text = plainOf(strip(p));
    return { text, width: widthOf(text) };
  });
  return { cells, lead, trail };
}

/**
 * How a column's cells are aligned, as its delimiter cell says:  `:---:` is
 * centered, `---:` is right-aligned, and any other is left-aligned.
 *
 * @param {string} cell - the delimiter cell
 * @returns {'left' | 'center' | 'right'} the alignment
 */
const alignOf = (cell) =>
  cell.endsWith(':') ? (cell.startsWith(':') ? 'center' : 'right') : 'left';

/**
 * Writes a table row with its cells padded to their columns' widths and
 * aligned in them, or, with no `widths`, with one space on either side of
 * each `|` (see `mistabled`).  The first cell of a row with no `|` at its
 * start is never padded before its text, which would indent the row,
 * and the last of a row with none at its end never after it, which would
 * leave whitespace at its end.
 *
 * @param {Row} row - the row
 * @param {('left' | 'center' | 'right')[]} aligns - each column's alignment
 * @param {number[]} [widths] - each column's width
 * @returns {string} the row's text
 */
function layRow({ cells, lead, trail }, aligns, widths) {
  const parts = cells.map(({ text, width }, j) => {
    const pad = widths ? widths[j] - width : 0;
    const align = j === 0 && !lead ? 'left' : aligns[j];
    const before =
      align === 'right' ? pad : align === 'center' ? Math.floor(pad / 2) : 0;
    const after = j === cells.length - 1 && !trail ? 0 : pad - before;
    return ' '.repeat(before) + text + ' '.repeat(after);
  });
  return `${lead ? '| ' : ''}${parts.join(' | ')}${trail ? ' |' : ''}`;
}

/**
 * Finds the table rows in a block whose columns don't line up:  each `|` that
 * no `\` escapes should be in line with those above and below it, with one
 * space or more on either side, and each cell's text placed in its column as
 * the delimiter row aligns it.  A delimiter cell is padded with spaces,
 * since a fix adds no `-`, and GFM trims a cell's whitespace, so the table
 * reads the same.  No `|` is added or removed, and a row's indentation
 * is kept.  If an aligned row would run past `width`, the table is written as
 * Prettier writes one then, with one space on either side of each `|`.
 *
 * A table is checked only if GFM would read it as one and its rows can be
 * counted in columns:  its header row has as many cells as its delimiter row,
 * which are all `:?-+:?`, no row has more, and every row has a `|` and is
 * a line of Markdown that starts no other construct.  Nor is one with
 * a character of uneven width (see `UNEVEN`).
 *
 * A row is read as `no-exotic-whitespace` and `no-trailing-space` would leave
 * it, so their fixes change neither what this one finds nor what it writes.
 * A fix makes their fixes to the row too, so it never waits a pass for
 * one of theirs.
 *
 * @param {string} text - the block, from its `/**` to its `*\/`
 * @param {string} indent - the whitespace before the block on its line
 * @param {AlignOptions} [options] - how to read the block, and the width
 * @returns {Finding[]} findings of kind `table`, one per row to fix
 */
export function mistabled(text, indent, { preformatted, width = WIDTH } = {}) {
  if (!text.includes('\n')) return [];
  const items = itemsOf(text, indent, preformatted);
  /**
   * Whether a table's line can be aligned:  its delimiter row (`rule`),
   * or a row that starts no other construct.
   *
   * @type {(it: Item, rule: boolean) => boolean}
   */
  const sound = (it, rule) => {
    const line = rawText(it);
    return (
      markdownLine(it) &&
      line.includes('|') &&
      !UNEVEN.test(line) &&
      (rule ||
        !(KEPT.test(line) || OWN_LINE.test(line) || HTML_BLOCK.test(line)))
    );
  };
  return tablesOf(items).flatMap(({ top, delimiter, end }) => {
    const lines = /** @type {Raw[]} */ (items.slice(top, end + 1));
    if (top === delimiter || !lines.every((it, k) => sound(it, k === 1)))
      return [];
    const spans = lines.map(({ raw }) => {
      const star = raw.indexOf('*');
      const start = raw.length - raw.replace(/^\s*\*[\s\u200b]*/, '').length;
      const row = strip(raw.slice(start));
      // An edit that starts where another rule's ends waits for the next
      // pass, so one that changes the whitespace before the row's text
      // starts at the `*`, and every edit runs to the end of the line.
      const gap = raw.slice(star + 1, start);
      const from = plainOf(gap) === gap ? start : star;
      return { row, start, from, end: raw.length };
    });
    const rows = spans.map(({ row }) => cellsOf(row));
    const [head, rule] = [rows[0].cells, rows[1].cells];
    if (
      head.length !== rule.length ||
      !rule.every((c) => DELIMITER_CELL.test(c.text)) ||
      rows.some((r) => !r.cells.length || r.cells.length > head.length)
    )
      return [];
    const aligns = rule.map((c) => alignOf(c.text));
    const widths = head.map((_, j) =>
      Math.max(...rows.map((r) => r.cells[j]?.width ?? 0)),
    );
    const aligned = rows.map((r) => layRow(r, aligns, widths));
    const fits = aligned.every(
      (row, k) =>
        widthOf(plainOf(lines[k].raw.slice(0, spans[k].start) + row)) <= width,
    );
    const laid = fits ? aligned : rows.map((r) => layRow(r, aligns));
    return laid.flatMap((row, k) => {
      const { row: was, start, from, end } = spans[k];
      if (row === plainOf(was)) return [];
      const { at, raw } = lines[k];
      const edit = {
        at,
        start: from,
        end,
        text: plainOf(raw.slice(from, start)) + row,
      };
      return [finding('table', [start, start + was.length], edit)];
    });
  });
}

/**
 * The block, with its tables' columns lined up (see `mistabled`).
 */
export const alignTables = fixer(mistabled);

/**
 * Matches the markers that start a blockquote's line, past the whitespace
 * before them:  a `>` for each level, up to three spaces before each nested
 * one, and the one space after the last, if there is one.
 */
const QUOTE_MARKERS = /^>(?: {0,3}>)* ?/;

/**
 * A line of a blockquote:  its index in the block (`at`), the line whole
 * (`raw`), the whitespace between its ` * ` prefix and its first `>` (`lead`),
 * how many `>` mark it (`level`), and its text past them (`text`), as written.
 * The prefix and markers are read as `no-exotic-whitespace` would leave them,
 * so its fix never changes how they're read.
 *
 * @typedef {{ at: number, raw: string, lead: string, level: number, text: string }} QuoteLine
 */

/**
 * @param {Raw} it - a kept line that starts with `>` (see `quoteRuns`)
 * @returns {QuoteLine} the line, read as a blockquote's
 */
function quoteLine({ at, raw }) {
  const plain = plainOf(raw);
  const star = plain.indexOf('*') + 1;
  const pre = star + (plain[star] === ' ' ? 1 : 0);
  const start = pre + plain.slice(pre).search(/[^ ]/);
  const markers = /** @type {string[]} */ (
    QUOTE_MARKERS.exec(plain.slice(start))
  )[0];
  return {
    at,
    raw,
    lead: plain.slice(pre, start),
    level: markers.replace(/[^>]/g, '').length,
    text: raw.slice(start + markers.length),
  };
}

/**
 * Finds a block's blockquotes:  each run of the lines kept as Markdown that
 * start with `>`, outside a table, which is `table-align`'s.  Code, as in
 * a fence or an `@example`, is never one.
 *
 * @param {Item[]} items - a block's items
 * @returns {Raw[][]} the lines of each, in order
 */
function quoteRuns(items) {
  const tabled = new Set(
    tablesOf(items).flatMap(({ top, end }) =>
      Array.from({ length: end - top + 1 }, (_, j) => top + j),
    ),
  );
  /**
   * @type {Raw[][]}
   */
  const runs = [];
  let last = -2;
  for (const [k, it] of items.entries()) {
    if (
      it.type !== 'raw' ||
      !markdownLine(it) ||
      tabled.has(k) ||
      !rawText(it).startsWith('>')
    )
      continue;
    if (last === k - 1) runs[runs.length - 1].push(it);
    else runs.push([it]);
    last = k;
  }
  return runs;
}

/**
 * Flows a blockquote's text as `reflow` flows a paragraph, inside a `> ` for
 * each level on every line.  Each run of lines with text at one level is
 * a paragraph, so a line of only markers, or a change of level,
 * keeps the paragraphs on either side of it apart, and a nested quote keeps
 * its level.  A quote is kept as it is unless each of its paragraphs is plain
 * prose, read as `parseItems` reads a block's text, so a fence, a list,
 * a heading, a table, HTML, or a tag in it keeps it whole.  So is one whose
 * lines start at different columns, or four or more past the ` * `,
 * where a `>` may not start a quote at all.
 *
 * @param {Raw[]} run - the quote's lines (see `quoteRuns`)
 * @param {string} indent - the whitespace before the block on its line
 * @param {number} width - the widest a line may be
 * @param {Limits} limits - the limits on where a line may break
 * @param {BlockOptions} options - how to read and space the block
 * @returns {string[] | null} its lines, flowed, or null if it's kept
 */
function flowQuote(run, indent, width, limits, options) {
  const lines = run.map(quoteLine);
  const { lead } = lines[0];
  if (lead.length >= 4 || lines.some((l) => l.lead !== lead)) return null;
  /**
   * @type {QuoteLine[][]}
   */
  const paras = [];
  for (const [k, l] of lines.entries()) {
    const prev = lines[k - 1];
    if (prev && strip(prev.text) && strip(l.text) && prev.level === l.level)
      paras[paras.length - 1].push(l);
    else paras.push([l]);
  }
  const out = [];
  for (const para of paras) {
    const prefix = `${indent} * ${lead}${'> '.repeat(para[0].level)}`;
    if (!strip(para[0].text)) {
      out.push(prefix.trimEnd());
      continue;
    }
    const recs = para.map(({ text }, at) => ({
      raw: ` * ${text}`,
      content: text,
      offset: 3,
      at,
    }));
    const items = parseItems(recs, options.preformatted);
    const [it] = items;
    if (items.length > 1 || it.type !== 'para' || it.tag || it.bullet)
      return null;
    out.push(...fillPara(it, prefix, prefix, width, limits, options.spaces));
  }
  return out;
}

/**
 * A blockquote of a block, flowed (see `flowQuote`):  the index in the block
 * of its first line (`at`) and of its last (`end`), its lines as `quote-flow`
 * writes them, whether they differ from the lines as written, read as
 * `no-exotic-whitespace` and `no-trailing-space` would leave them (`changed`),
 * and the span from its first `>` to the end of its text.
 *
 * @typedef {Span & { at: number, end: number, lines: string[], changed: boolean }} Quote
 */

/**
 * @param {string} text - the block, from its `/**` to its `*\/`
 * @param {string} indent - the whitespace before the block on its line
 * @param {number} nominal - the nominal line width, prefix included
 * @param {ReflowOptions} options - limits to turn off, and how to
 *                                  read the block
 * @returns {Quote[]} the block's blockquotes that it flows, in order
 */
function flowQuotes(text, indent, nominal, options) {
  const block = parseBlock(text, indent);
  if (!block) return [];
  const width = nominal - MARGIN;
  const limits = limitsOf(options, nominal);
  const items = parseItems(block.recs, options.preformatted);
  return quoteRuns(items).flatMap((run) => {
    const lines = flowQuote(run, indent, width, limits, options);
    if (!lines) return [];
    const [first, last] = [run[0], run[run.length - 1]];
    const was = run.map((it) => plainOf(it.raw).replace(TRAILING, ''));
    const changed = lines.map(plainOf).join('\n') !== was.join('\n');
    const to = last.raw.replace(TRAILING, '').length;
    const at = first.at;
    return [
      {
        ...span('quote', at, first.raw.indexOf('>'), to, last.at),
        at,
        end: last.at,
        lines,
        changed,
      },
    ];
  });
}

/**
 * Reads a block's lines as `parseItems` does, with each blockquote as one
 * line, to check that flowing its quotes changes how no other line is read.
 *
 * @param {string} text - the block, from its `/**` to its `*\/`
 * @param {string} indent - the whitespace before the block on its line
 * @param {boolean} [preformatted] - whether to keep unfenced code
 * @returns {string} what each line other than a quote's is read as
 */
function quoteShapeOf(text, indent, preformatted) {
  const items = itemsOf(text, indent, preformatted);
  const quoted = new Set(/** @type {Item[]} */ (quoteRuns(items).flat()));
  const shape = items.map((it) => {
    if (quoted.has(it)) return 'quote';
    if (it.type === 'raw') return JSON.stringify([it.raw, it.code]);
    return JSON.stringify([it.type, ...it.recs.map((r) => r.raw)]);
  });
  return shape.filter((s, k) => s !== 'quote' || shape[k - 1] !== s).join();
}

/**
 * The block, with each blockquote's line prefix and markers made a plain
 * ` * ` prefix, so the markers that flowing a quote adds to a line or drops
 * with one are read as part of the prefix (see `onlyWhitespace`).
 *
 * @param {string} text - the block, from its `/**` to its `*\/`
 * @param {string} indent - the whitespace before the block on its line
 * @param {boolean} [preformatted] - whether to keep unfenced code
 * @returns {string} the block, its quotes unmarked
 */
function unquoted(text, indent, preformatted) {
  const lines = `${indent}${text}`.split('\n');
  for (const it of quoteRuns(itemsOf(text, indent, preformatted)).flat()) {
    lines[it.at] = `${indent} * ${quoteLine(it).text}`;
  }
  return lines.join('\n').slice(indent.length);
}

/**
 * Finds the blockquotes in a block whose text isn't flowed (see `flowQuote`),
 * and whether replacing their lines with their flowed lines is safe:
 * it changes only whitespace and line prefixes, a quote's markers included
 * (see `unquoted`), changes how no other line is read (see `quoteShapeOf`),
 * and leaves quotes that it flows as they are.  A quote whose lines differ
 * only in the whitespace that `no-exotic-whitespace` and `no-trailing-space`
 * fix is left to them.  `reflow` keeps a quote's lines as they are, so it
 * never finds what this finds.
 *
 * @param {string} text - the block, from its `/**` to its `*\/`
 * @param {string} indent - the whitespace before the block on its line
 * @param {number} [nominal] - the nominal line width, prefix included
 * @param {ReflowOptions} [options] - limits to turn off, and how to
 *                                    read the block
 * @returns {{ quotes: Quote[], safe: boolean }}
 *   the quotes, in order, and whether their fix is safe
 */
export function misquoted(text, indent, nominal = WIDTH, options = {}) {
  const block = parseBlock(text, indent);
  if (block?.lines.length === 1) {
    // A one-line block is read as `single-line` and `reflow` spread it, and
    // a fix replaces its line with the spread lines.
    const [{ raw }] = block.recs;
    const spread = ['/**', raw, `${indent} */`].join('\n');
    const { quotes, safe } = misquoted(spread, indent, nominal, options);
    if (!quotes.length) return { quotes, safe };
    const [line] = block.lines;
    const lines = [`${indent}/**`, ...quotes[0].lines, `${indent} */`];
    const quote = {
      ...span('quote', 0, line.indexOf('>'), line.trimEnd().length),
      at: 0,
      end: 0,
      lines,
      changed: true,
    };
    return { quotes: [quote], safe };
  }
  const all = flowQuotes(text, indent, nominal, options);
  const quotes = all.filter((q) => q.changed);
  if (!quotes.length) return { quotes, safe: true };
  const lines = `${indent}${text}`.split('\n');
  for (const { at, end, lines: flowed } of [...quotes].reverse()) {
    lines.splice(at, end - at + 1, ...flowed);
  }
  const fixed = lines.join('\n').slice(indent.length);
  const again = flowQuotes(fixed, indent, nominal, options);
  const { preformatted } = options;
  const safe =
    onlyWhitespace(
      unquoted(text, indent, preformatted),
      unquoted(fixed, indent, preformatted),
    ) &&
    quoteShapeOf(fixed, indent, preformatted) ===
      quoteShapeOf(text, indent, preformatted) &&
    again.length === all.length &&
    again.every((q) => !q.changed);
  return { quotes, safe };
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
 * text past its ` * ` prefix, and without the whitespace after it on
 * a markdown line (see `trimsEnd`), and whether it's code.  A reflow changes
 * none of these texts, and no fix changes code.
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
      ? [
          {
            at: it.at,
            text: keptLine(it).replace(/^\s*\* ?/, ''),
            code: it.code,
          },
        ]
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
