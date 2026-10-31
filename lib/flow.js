/**
 * The text engine behind the rules.  Text is split into tokens at spaces,
 * and tokens are glued into units that a line never breaks inside
 * (see `fillPara`).  Lines are then filled greedily with units, and a break
 * moves earlier only where it would break a rule.  A token is wide if two or
 * more spaces follow it in the source.
 *
 * Reflow doesn't report a block whose only problems are the spaces between
 * words, which the spacing rules `sentence-spacing`, `colon-spacing`,
 * `word-spacing`, `no-extra-punctuation-space` and `tag-spacing` report
 * (`bullet-spacing` checks list items' lines, which reflow keeps as they are),
 * the whitespace at the edges of its lines, which the edge rules `star-align`,
 * `text-indent` and `no-trailing-space` report, the indentation of tag
 * continuation lines, which `tag-align` reports, the indentation of a list
 * item's wrapped lines, which `bullet-align` reports, or the whitespace
 * characters that aren't plain spaces, which `no-exotic-whitespace` reports.
 * A reflow fixes all of them again, and its output is spaced, edged and
 * aligned, so `--fix` with `reflow` and those rules settles on the same block
 * in any order.  For that, `tag-align` finds a description's column from its
 * head as the spacing rules would space it, not as it is spaced,
 * and `bullet-align` finds an item's text column as `bullet-spacing` would
 * space its marker.
 *
 * The spacing and edge rules check how wide whitespace is,
 * and `no-exotic-whitespace` checks what it's made of, so a tab where one
 * space belongs is reported only by `no-exotic-whitespace`.
 */

/**
 * The widest a JSDoc line may be by default, prefix included.
 */
export const WIDTH = 78;

/**
 * The widest a tag's head may be, from its `@` through the space before its
 * description, and still have its description begin on the same line.
 * A wider head (a long `{Type}`, say) keeps its description on its line only
 * if the whole tag fits there.  Otherwise the head takes a line of its own,
 * and its whole description is filled below it, indented two spaces.
 * Most heads are well under it.
 */
const MAX_HEAD = 45;

/**
 * The whitespace that may sit inside a non-breaking span, other than a line
 * break:  a space, a tab, a vertical tab, a form feed, and the Unicode spaces.
 */
const SPACES =
  ' \t\v\f\u00a0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007' +
  '\u2008\u2009\u200a\u202f\u205f\u3000\ufeff';

/**
 * Represent each of `SPACES` inside a non-breaking span while splitting,
 * so the span's whitespace comes back as it was.  They're control characters
 * from `\u0001`, skipping the tab, line breaks and the other control
 * characters `\s` matches, since a block's text never holds the rest.
 */
const MASKS = [...SPACES]
  .map((_, i) => String.fromCharCode(i < 8 ? i + 1 : i + 6))
  .join('');

/**
 * Matches a whitespace character other than a plain space:  a tab, a no-break
 * space, another of Unicode's spaces, or a zero-width space
 * (U+200B, which `\s` doesn't match, or U+FEFF).  A block's lines have no
 * line ends in them.  Joiners such as U+200C, U+200D and U+2060 aren't spaces,
 * so they're left alone.
 */
const EXOTIC = /[^\S ]|\u200b/g;

/**
 * Matches a token that ends in a common abbreviation, such as `e.g.`,
 * `vs.` or `Dr.`, which ends in a period but may not end a sentence
 * (see `abbrInSentence`).  `al` stands for the `al.` of `et al.`, since `et`
 * and `al.` are separate words.  Matching ignores case, so `E.G.` and `A.D.`
 * match too, and a dotted form such as `b.c.e.` matches as a whole.
 * The match must start the token or follow a character that isn't a letter,
 * so `first.` isn't taken for `st.`.
 */
const ABBR =
  /(^|[^a-z])(e\.g|i\.e|etc|al|a\.k\.a|w\.r\.t|esp|incl|vs|cf|fig|eq|sec|ch|vol|pp|a\.m|p\.m|a\.d|b\.c|a\.c\.e|b\.c\.e|dr|mr|mrs|ms|prof|st)\.$/i;

/**
 * The abbreviations in `ABBR` that can come right before or after a name,
 * so a capitalized word after one may be part of that name, and doesn't show
 * that a sentence ended.  `Dr.`, `Mr.`, `Mrs.`, `Ms.` and `Prof.` come before
 * a name.  `St.` comes before a name when it means Saint ("St. Paul"),
 * and after one when it means Street ("Elm St."), where the next word may be
 * capitalized either way ("Elm St. Station").  `vs.` and `cf.` often come
 * before the name of a thing, as in "vs. Foo" or "cf. Bar".
 * See `abbrInSentence` for when one ends a sentence, and `fillPara` for how
 * it's glued to the name.
 */
const BESIDE_NAME = new Set('dr mr mrs ms prof st vs cf'.split(' '));

/**
 * Matches a short word that `limits.shortWords` keeps off the end of a line:
 * `a`, `an`, `the`, or any one-letter word such as `I`, in any case,
 * after any opening brackets, quotes and emphasis.  A word with punctuation
 * after it doesn't match, as the `B` and `A` of `plan B.` and `vitamin A,`
 * don't, since it ends its sentence or clause rather than leading into
 * the next word.
 */
const SHORT = /^[("'[*_]*(?:an|the|\p{L})$/iu;

/**
 * Matches a token that ends in closing punctuation, which `limits.hang` lets
 * hang one column past the width at the end of a line:  a period, comma,
 * semicolon, colon, `!`, `?`, `)`, `]`, or a closing quote, straight or curly.
 * Only that last character hangs, so a line ending in `).` may be one column
 * too wide, not two.
 */
const HANG = /[.,;:!?)\]'"\u2019\u201d]$/;

/**
 * Tags whose head includes a name, as in `@param name -`.
 */
const NAMED_TAGS = new Set(
  'param property prop template typedef arg argument'.split(' '),
);

/**
 * The options of `reflowComment` and the `reflow` rule that turn some of
 * the limits on where a line may break on or off.  Each limit is on unless
 * its option is `false`, except `widows`, which is `0.15` unless it's set,
 * and off at `0`.
 *
 * @typedef {object} ReflowOptions
 * @property {{ sentence?: boolean, clause?: boolean, paren?: boolean }} [orphans] -
 *   whether a sentence's first two and last two words stay together
 *   (`sentence`), a single word after `, ; :` may not end a line or be a line
 *   alone (`clause`), and the first and last words inside parentheses stay
 *   with their neighbors (`paren`)
 * @property {boolean} [names] - whether an abbreviation beside a name stays
 *                               with it, as in `Mr. Smith`, `St. Paul`,
 *                               `Elm St.` and `et al.`
 * @property {boolean} [shortWords] - whether a short word (see `SHORT`) stays
 *                                    with the word after it, so it
 *                                    never ends a line
 * @property {boolean} [hang] - whether a line may go one column past
 *                              the width when its last character is closing
 *                              punctuation (see `HANG`)
 * @property {number} [widows] - the shortest a paragraph's last line's text
 *                               may be, as a fraction of the width from `0`
 *                               to `1` (see `fillPara`)
 */

/**
 * The limits on where a line may break that `ReflowOptions` can turn on or
 * off, each `true` if it's on, except `widows`, which is `0` if it's off.
 *
 * @typedef {{ sentence: boolean, clause: boolean, paren: boolean, names: boolean, shortWords: boolean, hang: boolean, widows: number }} Limits
 */

/**
 * @param {ReflowOptions} options - the options
 * @returns {Limits} the limits they leave on
 */
const limitsOf = ({
  orphans = {},
  names = true,
  shortWords = true,
  hang = true,
  widows = 0.15,
}) => ({
  sentence: orphans.sentence ?? true,
  clause: orphans.clause ?? true,
  paren: orphans.paren ?? true,
  names,
  shortWords,
  hang,
  widows,
});

/**
 * @param {string} s - a trimmed body line or token
 * @returns {boolean} whether it starts a block tag such as `@param`
 */
const isTag = (s) => /^@[A-Za-z]/.test(s);

/**
 * @param {string} t - a token
 * @returns {string} the token without closing brackets and quotes, so `end.)`
 *                   is seen to end in a period
 */
const stripClose = (t) => t.replace(/[)"'\]]+$/, '');

/**
 * A word starts with a capital if its first letter is one, after any opening
 * brackets, quotes and emphasis, as in `(Foo` or `"Bar`.  A word that starts
 * with a code span, a `{...}`, a digit or other punctuation doesn't,
 * since code and numbers are cased the same anywhere in a sentence.
 *
 * @param {string | undefined} t - a token, or undefined at the end
 *                                 of a paragraph
 * @returns {boolean} whether the token starts with a capital letter
 */
const capitalized = (t) => /^[("'[*_]*\p{Lu}/u.test(t ?? '');

/**
 * @param {string} t - a token
 * @returns {string | undefined} the abbreviation the token ends in,
 *                               lowercase and without its last period, as in
 *                               `mr` or `b.c.e`, or undefined if it
 *                               ends in none
 */
const abbrOf = (t) => ABBR.exec(t)?.[2].toLowerCase();

/**
 * Whether a token that `ABBR` matches stays inside its sentence, as `e.g.`
 * does in "e.g. this one", rather than ending it, as `etc.` does in "and so
 * on, etc.  Then".  One in `BESIDE_NAME` other than `St.` always stays inside,
 * even when it's wide, so one space always follows it.  `St.` stays inside
 * unless it's wide, as in "on Elm St.  Then", since it may mean Saint or
 * Street, and nothing else shows which.  Any other abbreviation stays inside
 * unless it's wide or the word after it starts with a capital, so two spaces
 * after one are how an author marks a sentence end.  A word that starts with
 * code or a digit counts as lowercase (see `capitalized`), so `Fig.`,
 * `Vol.` and the like before a number stay inside.  So does an abbreviation
 * at the end of a paragraph, where nothing follows it.
 *
 * @param {string} t - a token ending in `.`
 * @param {string} [next] - the token after it
 * @param {boolean} [wide] - whether the token is wide
 * @returns {boolean} whether the token is an abbreviation that the sentence
 *                    goes on past
 */
const abbrInSentence = (t, next, wide) => {
  const word = abbrOf(t);
  if (word === 'st') return !wide;
  return !!word && (BESIDE_NAME.has(word) || (!wide && !capitalized(next)));
};

/**
 * Whether a token ending in `.` stays inside its sentence because `St.`
 * follows it and the token isn't wide, as in "Mt. St. Helens".  Since `St.`
 * may mean Saint or Street, the word before it may be part of the whole name,
 * so only two spaces after that word can unambiguously show that a sentence
 * ended there.
 *
 * @param {string} t - a token
 * @param {string} [next] - the token after it
 * @param {boolean} [wide] - whether the token is wide
 * @returns {boolean} whether the token ends in `.`, isn't wide,
 *                    and `St.` follows it
 */
const beforeSt = (t, next, wide) =>
  !wide && t.endsWith('.') && abbrOf(next ?? '') === 'st';

/**
 * A token ending in `.`, `!` or `?` ends a sentence unless it's
 * an abbreviation that the sentence goes on past (see `abbrInSentence`),
 * or a word that one space and `St.` follow (see `beforeSt`).
 *
 * @param {string} t - a token
 * @param {string} [next] - the token after it
 * @param {boolean} [wide] - whether the token is wide
 * @returns {boolean} whether the token ends a sentence
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
 * @param {string} [next] - the token after it
 * @param {boolean} [wide] - whether the token is wide
 * @returns {string} the space that follows the token on a line:  two after
 *                   a sentence end or a colon, one otherwise
 */
const sepAfter = (t, next, wide) =>
  endsSentence(t, next, wide) || /:$/.test(stripClose(t)) ? '  ' : ' ';

/**
 * @param {string} t - a token
 * @returns {string} the token with the text of each code span removed,
 *                   so the punctuation inside it doesn't count
 */
const codeless = (t) => t.replace(/`[^`]*`/g, '``');

/**
 * Whether no space belongs between two words:  before a word that's only
 * closing punctuation (one of `, . ; :`, or one or more `)` and `]`, with or
 * without one of those after them), or after a word that ends in `(` or `[`.
 * An ellipsis, a word such as `.js` or `:hover`, and an emoticon such as `:)`
 * or `:(` aren't punctuation that a space can't come before or after.
 * Reflow joins two such words into one token, so its output has no space
 * between them, and `no-extra-punctuation-space` removes the space between
 * them on a line.
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
 * @returns {string[]} for each word, the token it's part of once the words
 *                     that `tight` says no space belongs between are joined
 */
function wholeWords(words) {
  /**
   * @type {string[][]}
   */
  const groups = [];
  words.forEach((w, k) => {
    if (k > 0 && tight(words[k - 1], w)) groups[groups.length - 1].push(w);
    else groups.push([w]);
  });
  return groups.flatMap((g) => g.map(() => g.join('')));
}

/**
 * Finds the punctuation a line break must not strand a word next to.
 * Closing quotes and emphasis are skipped, code spans are blanked, and a `)`
 * after a `(` (a call or a link) is not punctuation.  Nor is the period of
 * an abbreviation or of a word before `St.` that the sentence goes on past.
 *
 * @param {string} t - a token
 * @param {string} [next] - the token after it
 * @param {boolean} [wide] - whether the token is wide
 * @returns {string} one character, or `''` if there is none
 */
const tailPunct = (t, next, wide) => {
  const bare = codeless(t.replace(/["'*_]+$/, ''));
  const last = bare.slice(-1);
  if (last === ')' && bare.includes('(', 1)) return '';
  if (last === '.' && abbrInSentence(bare, next, wide)) return '';
  if (beforeSt(t, next, wide)) return '';
  return /[,;:.!?)]/.test(last) ? last : '';
};

/**
 * `reflow` and `tag-align` both find a tag's description column with this,
 * so they agree on it.
 *
 * @param {string[]} tokens - a tag's masked tokens, from its `@`
 * @returns {number} how many of them make up its head, which stays together:
 *                   `@param name -`, `@returns`, or `@returns {Type}`, say
 */
function headSize(tokens) {
  let head = 1;
  const name = tokens[0].slice(1);
  if (tokens[head]?.startsWith('{')) head++;
  if (NAMED_TAGS.has(name) && tokens[head] && tokens[head] !== '-') head++;
  if (tokens[head] === '-') head++;
  return Math.min(head, tokens.length);
}

/**
 * Finds the `-` that ends a tag's head, as in `@param name - the name`.
 * One space goes on either side of it, whatever the word before it ends in,
 * and `tag-spacing` owns those two gaps.  A `-` glued to a word, as in
 * `name- the name` or `name -1 or more`, is part of that word,
 * not a separator.
 *
 * @param {string[]} words - a paragraph's masked words, in order
 * @returns {number} the index of the separator among the words, or -1 if
 *                   the paragraph isn't a tag or its head has no `-`
 */
function separatorOf(words) {
  if (!isTag(words[0] ?? '')) return -1;
  // The words joined as reflow joins them (see `wholeWords`), and the index
  // of each token's last word.
  /**
   * @type {string[]}
   */
  const tokens = [];
  /**
   * @type {number[]}
   */
  const last = [];
  words.forEach((w, k) => {
    if (k > 0 && tight(words[k - 1], w)) tokens[tokens.length - 1] += w;
    else tokens.push(w);
    last[tokens.length - 1] = k;
  });
  const head = headSize(tokens);
  return tokens[head - 1] === '-' ? last[head - 1] : -1;
}

/**
 * @param {number} column - a tag's head width, from its `@` through the space
 *                          before its description
 * @returns {number} how far past ` * ` its description's later lines start
 */
const hangOf = (column) => (column <= MAX_HEAD ? column : 2);

/**
 * @param {string} s - masked text
 * @returns {string} the text with its masked whitespace restored
 */
const unmask = (s) => [...s].map((c) => SPACES[MASKS.indexOf(c)] ?? c).join('');

/**
 * Matches a code span, a markdown link, a `{@link ...}` or `{Type}`,
 * or an `[optional]` name, whichever starts first.  A code span is matched
 * whole, so a bracket inside one never pairs with a bracket outside it,
 * as the `[` of `` `[` `` doesn't with the `]` of a later `` `[...]` ``.
 * The others may hold code spans, and a bracket inside one doesn't close them.
 * A backtick that no other follows starts no code span.  A `{Type}` may hold
 * one level of braces, as in `{{ a: number }[] | null}`.
 */
const SPANS = (() => {
  const code = '`[^`]*`';
  /**
   * @type {(stop: string) => string}
   */
  const atom = (stop) => `(?:${code}|\`(?![^\`]*\`)|[^${stop}\`])`;
  return new RegExp(
    [
      code,
      `\\[${atom('\\]')}*\\]\\([^)]*\\)`,
      `\\{(?:${atom('{}')}|\\{${atom('{}')}*\\})*\\}`,
      `\\[${atom('\\]')}*\\]`,
    ].join('|'),
    'g',
  );
})();

/**
 * Makes the spans `SPANS` matches unbreakable, by masking their inner
 * whitespace (see `MASKS`).  A line break inside one stays, so the text still
 * splits into its lines.
 *
 * @param {string} s - a paragraph's text
 * @returns {string} the text, with that whitespace masked
 */
function mask(s) {
  return s.replace(SPANS, (m) =>
    m.replace(/[^\S\n\r]/g, (c) => MASKS[SPACES.indexOf(c)]),
  );
}

/**
 * A body line of a block.
 *
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
 * @property {Bullet} [bullet] - the marker of the list item whose wrapped
 *                               lines it is, if it's those
 */

/**
 * Matches the start of a list item's body line, without its ` * ` prefix:
 * any indentation, the item's marker (`-`, `*`, or a number and `.`),
 * the whitespace after it, and the first word of its text.
 */
const BULLET = /^(\s*)([-*]|\d+\.)(\s+)(\S+)/;

/**
 * A list item's marker on its line:  the line's index in the block (`at`),
 * the column the `marker` starts at (`start`), the whitespace after it
 * (`gap`), and the column the first word after that ends at (`end`).
 * Its text starts one space after the marker once `bullet-spacing` spaces it.
 *
 * @typedef {{ at: number, start: number, marker: string, gap: string, end: number }} Bullet
 */

/**
 * @param {BodyLine} r - a body line
 * @returns {Bullet | undefined} its marker, if it starts a list item
 */
function bulletOf(r) {
  const m = BULLET.exec(r.content);
  if (!m) return undefined;
  const [, before, marker, gap, word] = m;
  const start = r.offset + before.length;
  const end = start + marker.length + gap.length + word.length;
  return { at: r.at, start, marker, gap, end };
}

/**
 * A list item's wrapped lines start under its text, one space after its
 * marker as `bullet-spacing` spaces it, whatever the space after the marker
 * is now.  So `reflow` and `bullet-align` agree on where they start,
 * whether or not that space is fixed first.  They start at least one space
 * after their `*`, so they stay body lines.
 *
 * @param {Bullet} bullet - the item's marker
 * @param {string} indent - the whitespace before the block on its line
 * @returns {string} what starts each of the item's wrapped lines,
 *                   up to its text
 */
const hangPrefix = (bullet, indent) =>
  `${indent} *`.padEnd(
    Math.max(bullet.start + bullet.marker.length + 1, indent.length + 3),
  );

/**
 * An item of a block (see `parseItems`).  A raw item keeps its line's index
 * in the block (`at`) and whether it's code (`code`), and one that's a list
 * item keeps its marker (`bullet`).
 *
 * @typedef {{ type: 'blank', recs: BodyLine[] }} Blank
 * @typedef {{ type: 'raw', raw: string, at: number, code: boolean, bullet?: Bullet }} Raw
 * @typedef {Blank | Raw | Para} Item
 */

/**
 * Turns the body lines of a block into items:  blank, raw (kept as is),
 * or para (a paragraph, or a tag with its continuation lines).
 * Bullets, numbered lists, tables, fenced code, `@example` and indented code
 * are raw, though a bullet's wrapped lines are flowed as a paragraph.  As in
 * Markdown, the lines right after a list item are its wrapped lines unless
 * a blank line, a tag or another raw line comes first, and that para keeps
 * the item's marker.  A blank or a para keeps its lines' records, too.
 * The indentation of a para's later lines doesn't change its items.
 *
 * @param {BodyLine[]} recs - the body lines
 * @returns {Item[]} the items, in order
 */
function parseItems(recs) {
  /**
   * @type {Item[]}
   */
  const items = [];
  /**
   * The paragraph being read, if any.
   *
   * @type {Para | null}
   */
  let cur = null;
  /**
   * What's being kept as is:  'code', 'fence' or 'example'.
   *
   * @type {string | null}
   */
  let mode = null;
  const flush = () => {
    if (cur) items.push(cur);
    cur = null;
  };
  /**
   * Adds a body line as a raw item, with its marker if it's a list item.
   * It's code if it's kept as is for a `mode`.
   *
   * @type {(r: BodyLine, bullet?: Bullet) => void}
   */
  const raw = (r, bullet) => {
    const it = { raw: r.raw, at: r.at, code: !!mode };
    items.push(
      bullet ? { type: 'raw', ...it, bullet } : { type: 'raw', ...it },
    );
  };

  for (const r of recs) {
    const s = r.content.trim();
    const indented = /^ {4,}\S/.test(r.content);

    // Indented code is kept as is until a line that's neither indented nor
    // blank, a fence is kept through its closing line, and `@example` until
    // the next tag, which may be another `@example`.
    if (
      (mode === 'code' && (s === '' || indented)) ||
      mode === 'fence' ||
      (mode === 'example' && !isTag(s))
    ) {
      raw(r);
      if (mode === 'fence' && /^```/.test(s)) mode = null;
      continue;
    }

    // Indented code (4+ spaces) starts only at the block's start or after
    // a blank line, and not inside a paragraph.  So the line after a list
    // item, table row or closing fence, which follows a raw item, isn't taken
    // as indented code.  A list item or table row is raw too, but it sets
    // no mode, so the line after it is read afresh, which is how a bullet's
    // wrapped lines become a paragraph.
    mode = null;
    if (indented && !cur && (!items.length || items.at(-1)?.type === 'blank'))
      mode = 'code';
    else if (/^@example\b/.test(s)) mode = 'example';
    else if (/^```/.test(s)) mode = 'fence';
    const bullet = mode ? undefined : bulletOf(r);
    if (mode || bullet || /^\|/.test(s)) {
      flush();
      raw(r, bullet);
      continue;
    }

    // A blank line or a tag ends the paragraph before it.
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
 * Splits a paragraph into units (glued runs of tokens), then fills each line
 * greedily with as many units as fit.  A break that breaks a rule moves
 * earlier, one unit at a time, until it doesn't.  The rules that `limits`
 * turns off don't glue tokens or move breaks.  With `limits.widows`, the last
 * break may then move earlier too, so the last line isn't too short
 * (see `widowless`).
 *
 * @param {{ tag: boolean, parts: string[] }} item - the paragraph
 * @param {string} firstPrefix - what starts its first line
 * @param {string} contPrefix - what starts each later line, before a tag's
 *                              hanging indent
 * @param {number} width - the widest a line may be
 * @param {Limits} limits - the limits on where a line may break
 * @returns {string[]} the lines, each already prefixed
 */
function fillPara(item, firstPrefix, contPrefix, width, limits) {
  // The lines are joined with one space, so a line break never counts as two
  // spaces after a token.  wide[k] is whether tokens[k] is wide.  The
  // whitespace inside a masked span doesn't count, and it stays as it is in
  // the tokens, so a code span's text never changes.  The whitespace between
  // tokens becomes plain spaces.  Words that no space belongs between
  // (see `tight`) are joined into one token, dropping the gap between them.
  const text = mask(item.parts.join(' ')).replace(/\s/g, ' ').trim();
  const words = text.split(/ +/);
  const gaps = (text.match(/ +/g) ?? []).map((gap) => gap.length > 1);
  const tokens = [words[0]];
  /**
   * @type {boolean[]}
   */
  const wide = [];
  for (let k = 1; k < words.length; k++) {
    if (tight(words[k - 1], words[k])) tokens[tokens.length - 1] += words[k];
    else {
      tokens.push(words[k]);
      wide.push(gaps[k - 1]);
    }
  }
  const n = tokens.length;
  // Whether each token ends a sentence, and the space that follows it on
  // a line, given the token after it and the spaces between them.
  const ends = tokens.map((t, k) => endsSentence(t, tokens[k + 1], wide[k]));
  const sep = tokens.map((t, k) => sepAfter(t, tokens[k + 1], wide[k]));
  // One space goes before a tag's `-`, whatever the word before it ends in.
  const dash = item.tag ? separatorOf(tokens) : -1;
  if (dash > 0) sep[dash - 1] = ' ';
  // The punctuation each token ends in (see `tailPunct`), and whether it is
  // `, ; :`.  The token after it and the spaces between them only ever hide
  // a period, so they never change whether a token ends in `, ; :`.
  const tail = tokens.map((t, k) => tailPunct(t, tokens[k + 1], wide[k]));
  const mark = tail.map((p) => /[,;:]/.test(p));
  /**
   * Whether tokens[k] may end a line alone after the mark that ends tokens[j]:
   * it may if it ends a sentence, or if it follows a comma and ends in
   * a comma or semicolon itself, as in a list.
   *
   * @type {(j: number, k: number) => boolean}
   */
  const mayEnd = (j, k) => ends[k] || (tail[j] === ',' && /[,;]/.test(tail[k]));

  const head = item.tag ? headSize(tokens) : 0;

  /**
   * The column of each token in the unbroken line, spaced by `sep`.
   *
   * @type {number[]}
   */
  const col = [];
  let full = '';
  for (let k = 0; k < n; k++) {
    col.push(full.length);
    full += tokens[k] + sep[k];
  }
  /**
   * The text of the tokens a to b, each followed by its space except the last.
   *
   * @type {(a: number, b: number) => string}
   */
  const textOf = (a, b) => full.slice(col[a], col[b] + tokens[b].length);
  /**
   * The widest a line ending in token t may be:  `width`, or one more with
   * `limits.hang` if t ends in closing punctuation.
   *
   * @type {(t: string) => number}
   */
  const room = (t) => width + (limits.hang && HANG.test(t) ? 1 : 0);

  // A head wider than `MAX_HEAD` takes a line of its own unless the whole tag
  // fits on one, and its description is filled below it as a paragraph.
  // The description keeps the spaces `sep` gives it, so its sentence ends
  // stay where they are.
  const oneLine =
    firstPrefix.length + col[n - 1] + tokens[n - 1].length <=
    room(tokens[n - 1]);
  if (head < n && col[head] > MAX_HEAD && !oneLine) {
    const below = `${contPrefix}  `;
    const desc = { tag: false, parts: [unmask(textOf(head, n - 1))] };
    return [
      unmask(firstPrefix + textOf(0, head - 1)),
      ...fillPara(desc, below, below, width, limits),
    ];
  }

  /**
   * Whether tokens[k] and tokens[k + 1] stay together, with no line break
   * between them.
   *
   * @type {(k: number) => boolean}
   */
  const glued = (k) => {
    const [prev, t, next] = [tokens[k - 1], tokens[k], tokens[k + 1]];
    // A tag's head stays together, and with the first word of its
    // description.
    if (k < head) return true;
    // A token that starts with `@`, `*` or `|`, or is a lone `-` or a number
    // and `.` such as `2.`, never starts a line, where it would read as a tag,
    // a list item or a table row.
    if (/^[@*|]/.test(next) || next === '-' || /^\d+\.$/.test(next))
      return true;
    // An abbreviation that ends a sentence only because two spaces follow it,
    // as in `Elm St.  Then`, is glued to the next word.  At a line break,
    // those two spaces would be lost, and the sentence end with them.
    if (ends[k] && !endsSentence(t, next)) return true;
    // No other glue crosses a sentence end.
    if (ends[k]) return false;
    // The first two words of a tag's description stay together.
    if (k === head) return true;
    // With `limits.shortWords`, a short word is glued to the next word.
    if (limits.shortWords && SHORT.test(t)) return true;
    // With `limits.sentence`, the first two and last two words of every
    // sentence stay together, and a word ending in `. ! ?` is glued to the
    // word before it.
    if (
      limits.sentence &&
      (ends[k - 1] || ends[k + 1] || k === n - 2 || /[.!?]/.test(tail[k + 1]))
    )
      return true;
    // With `limits.names`, an abbreviation in `BESIDE_NAME`, as in
    // `Mr. Smith`, is glued to the next word.  `St.` is glued to the word
    // after it only if that word is capitalized, as in `St. Paul`.  `St.` is
    // glued to the word before it if that word is capitalized, as in
    // `Elm St.`, and the `al.` of `et al.` to the `et` before it.
    const abbr = abbrOf(t);
    if (
      limits.names &&
      ((abbr === 'st' ? capitalized(next) : !!abbr && BESIDE_NAME.has(abbr)) ||
        (abbrOf(next) === 'st' && capitalized(t)) ||
        (abbrOf(next) === 'al' && /(^|[^a-z])et$/i.test(t)))
    )
      return true;
    // With `limits.paren`, the first word after `(` is glued to the next
    // word, and the last word before `)` to the word before it, but a whole
    // `(word)` token is glued to neither neighbor.  After a lone `(` token,
    // the word after it counts as the first word.
    if (
      limits.paren &&
      ((t.startsWith('(') && !codeless(t).includes(')')) ||
        (k > 0 && /^\(+$/.test(prev)) ||
        /^[^(]*\)/.test(codeless(next)))
    )
      return true;
    // With `limits.clause`, a single word after `, ; :` is glued to the next
    // word, so it can't end a line alone, unless `mayEnd` allows it.
    return limits.clause && k > 0 && mark[k - 1] && !mayEnd(k - 1, k);
  };

  // Units are runs of glued tokens, and lines break only between them.
  // cuts[i] is the first token of unit i, and cuts[m] is n.
  const cuts = [...tokens.keys()].filter((k) => k === 0 || !glued(k - 1));
  cuts.push(n);
  const m = cuts.length - 1;

  // A tag's later lines hang at its description's column.
  if (head < n) contPrefix += ' '.repeat(col[head]);

  /**
   * A line is units [a, b), which is tokens [T0, T1].
   *
   * @type {(a: number, b: number) => [number, number]}
   */
  const range = (a, b) => [cuts[a], cuts[b] - 1];
  /**
   * The column the line [a, b) ends at, its prefix included.
   *
   * @type {(a: number, b: number) => number}
   */
  const reach = (a, b) => {
    const [T0, T1] = range(a, b);
    const prefix = a === 0 ? firstPrefix : contPrefix;
    return prefix.length + col[T1] + tokens[T1].length - col[T0];
  };
  /**
   * Whether the line [a, b) fits in `width`, or in the column past it that
   * `room` gives a line ending in closing punctuation.
   *
   * @type {(a: number, b: number) => boolean}
   */
  const fits = (a, b) => reach(a, b) <= room(tokens[range(a, b)[1]]);
  /**
   * Whether the line [a, b) keeps the rules:  with `limits.clause`, it isn't
   * a single word right after a line ending in `, ; :`, and it doesn't end on
   * a single word after `, ; :` unless `mayEnd` allows it.  A sentence's last
   * two words need no check here, since the glue already keeps them together.
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

  const failed = new Set();
  /**
   * Lays out the lines from unit a, each as its units [a, b).  For each line,
   * it tries breaks from the latest that fits back to the earliest, and takes
   * the first one that is valid and lets the lines after it keep every
   * rule too.  If no break does, it returns null, and the unit is remembered
   * (in `failed`), so it isn't tried again.
   *
   * @type {(a: number) => [number, number][] | null}
   */
  const layout = (a) => {
    if (a === m) return [];
    if (failed.has(a)) return null;
    for (let b = greedy(a); b > a; b--) {
      const rest = valid(a, b) ? layout(b) : null;
      if (rest) return [[a, b], ...rest];
    }
    failed.add(a);
    return null;
  };
  /**
   * Lays out the lines from unit a like `layout`, except that where no layout
   * keeps every rule, it ends the line at the latest valid break, or else at
   * the greedy break, and goes on from there.
   *
   * @type {(a: number) => [number, number][]}
   */
  const lenient = (a) => {
    const lines = layout(a);
    if (lines) return lines;
    const max = greedy(a);
    let b = max;
    while (b > a && !valid(a, b)) b--;
    const end = b > a ? b : max;
    return [[a, end], ...lenient(end)];
  };
  /**
   * With `limits.widows`, moves the last break earlier, one unit at a time,
   * while the last line's text is shorter than that fraction of `width`.
   * A move must keep both lines valid and in `width`, and the last line may
   * never end right of the line before it.  If the last line can't get long
   * enough, it gets as long as those allow.  Only the last two lines change,
   * so the lines before them keep every rule they kept.
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
  return widowless(lenient(0)).map(([a, b], i) => {
    const prefix = i === 0 ? firstPrefix : contPrefix;
    return unmask(prefix + textOf(...range(a, b)));
  });
}

/**
 * @param {Item[]} items - a block's items, from `parseItems`
 * @param {string} indent - what precedes the block's `/**` on its line
 * @param {number} width - the widest a line may be
 * @param {Limits} limits - the limits on where a line may break
 * @returns {string[]} the block's body lines
 */
function renderItems(items, indent, width, limits) {
  const pre = `${indent} * `;
  return items.flatMap((it) => {
    if (it.type === 'blank') return `${indent} *`;
    if (it.type === 'raw') return it.raw;
    const hang = it.bullet ? hangPrefix(it.bullet, indent) : pre;
    return fillPara(it, hang, hang, width, limits);
  });
}

/**
 * Reflows one JSDoc block.  A block on one line stays on one line if its text
 * fits, ` *\/ ` included, and expands otherwise.  A longer block keeps its
 * first and last lines, and its body is laid out again.
 *
 * @param {string} text - the block, from its `/**` to its `*\/`
 * @param {string} indent - the whitespace before the block on its line
 * @param {number} [width] - the widest a line may be, prefix included
 * @param {ReflowOptions} [options] - the limits on where a line may
 *                                    break to turn off
 * @returns {string | null} the reflowed block, or null if its form isn't one
 *                          this handles (text after `/**` on a line of its
 *                          own, a body line without a leading `*`, or text
 *                          before the closing `*\/`)
 */
export function reflowComment(text, indent, width = WIDTH, options = {}) {
  const block = parseBlock(text, indent);
  if (!block) return null;
  const limits = limitsOf(options);
  const { lines, recs } = block;
  const items = parseItems(recs);
  const one = lines.length === 1;
  // Keep a one-liner on one line when its text fits (` */` is 3 columns).
  if (one && items.length === 1 && items[0].type === 'para') {
    const l = fillPara(
      items[0],
      `${indent}/** `,
      `${indent} * `,
      width - 3,
      limits,
    );
    if (l.length === 1 && l[0].length + 3 <= width) {
      return `${l[0]} */`.slice(indent.length);
    }
  }
  // A one-liner that doesn't fit is expanded.  A longer block keeps its first
  // and last lines.
  const open = one ? `${indent}/**` : lines[0];
  const close = one ? `${indent} */` : lines.at(-1);
  return [open, ...renderItems(items, indent, width, limits), close]
    .join('\n')
    .slice(indent.length);
}

/**
 * Splits a block into its lines and finds its body lines.  A block on one
 * line has one body line, its text between the `/**` and the `*\/`.  A block
 * with a `\r`, `\u2028` or `\u2029` in it isn't handled, since those end
 * lines too, and only `\n` is split on.
 *
 * @param {string} text - the block, from its `/**` to its `*\/`
 * @param {string} indent - the whitespace before the block on its line
 * @returns {{ lines: string[], recs: BodyLine[] } | null}
 *   the block's `lines`, the first with its indent, and its body lines
 *   (`recs`), or null if the block's form isn't one these rules handle
 *   (see `reflowComment`).  A one-line block's `raw` is its text with a ` * `
 *   prefix, as it would be on a line of its own.
 */
function parseBlock(text, indent) {
  if (/[\r\u2028\u2029]/.test(text)) return null;
  const lines = `${indent}${text}`.split('\n');
  if (lines.length === 1) {
    const one = lines[0].match(/^(\s*\/\*\*\s)(.+?)\s*\*\/\s*$/);
    if (!one) return null;
    const [, open, content] = one;
    const raw = `${indent} * ${content}`;
    return { lines, recs: [{ raw, content, offset: open.length, at: 0 }] };
  }
  const body = lines.slice(1, -1);
  if (!/^\s*\/\*\*\s*$/.test(lines[0])) return null;
  if (!/^\s*\*\/\s*$/.test(lines[lines.length - 1])) return null;
  if (!body.every((l) => /^\s*\*(\s|$)/.test(l))) return null;
  const recs = body.map((raw, i) => {
    const content = raw.replace(/^\s*\* ?/, '');
    return { raw, content, offset: raw.length - content.length, at: i + 1 };
  });
  return { lines, recs };
}

/**
 * A change to a block:  it replaces the columns `start` to `end` on line `at`
 * of the block with `text`.
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
 * Finds a block's tag continuation lines that don't start at their tag's
 * description column.  That column is where the first word after the head
 * goes, with the head spaced as the spacing rules would space it, or two
 * spaces in when the head is wider than `MAX_HEAD`.  A tag with a wide head
 * may also belong on one line, or need its description moved below the head,
 * but moving words is reflow's job, so this checks only the lines after
 * the head's own.  A tag on one line has none.  A tag whose own line doesn't
 * start with the block's ` * ` is left to reflow, which rewrites that
 * prefix anyway.
 *
 * @param {string} text - the block, from its `/**` to its `*\/`
 * @param {string} indent - the whitespace before the block on its line
 * @returns {Alignment[]} for each such line, an `Edit` that replaces its
 *                        prefix, from column 0 to its text, with the aligned
 *                        prefix, and the `column` that prefix ends at
 */
export function misaligned(text, indent) {
  const pre = `${indent} * `;
  const out = [];
  for (const it of parseItems(parseBlock(text, indent)?.recs ?? [])) {
    if (it.type !== 'para' || !it.tag) continue;
    if (!it.recs[0].raw.startsWith(pre + '@')) continue;
    const line = mask(it.recs[0].raw.slice(pre.length));
    const words = line.match(/\S+/g) ?? [];
    const gaps = line.match(/\s+/g) ?? [];
    const dash = separatorOf(words);
    /**
     * @type {(t: string, k: number) => string}
     */
    const sep = (t, k) =>
      k === dash - 1 ? ' ' : sepAfter(t, words[k + 1], gaps[k]?.length > 1);
    const headWidth = words
      .slice(0, headSize(words))
      .reduce((a, t, k) => a + t.length + sep(t, k).length, 0);
    const column = pre.length + hangOf(headWidth);
    const prefix = `${indent} *`.padEnd(column);
    for (const r of it.recs.slice(1)) {
      // The line's prefix, up to its text.  Every body line has one, since
      // `parseBlock` checks that each starts with a `*`.
      const end = r.raw.match(/^\s*\*\s*/)?.[0].length ?? 0;
      if (end !== column)
        out.push({ at: r.at, start: 0, end, text: prefix, column });
    }
  }
  return out;
}

/**
 * @param {string} text - the block, from its `/**` to its `*\/`
 * @param {string} indent - the whitespace before the block on its line
 * @returns {string} the block, with its tag continuation lines aligned
 */
export function alignTags(text, indent) {
  return applyEdits(text, indent, misaligned(text, indent));
}

/**
 * Finds the lines of a list item's wrapped lines that don't start under its
 * text (see `hangPrefix`).  The item's own line is kept as it is, so its
 * marker's column is the author's, and only the lines after it are checked.
 * In a tag's description, that column is where the item's marker puts it,
 * not the description's column.
 *
 * @param {string} text - the block, from its `/**` to its `*\/`
 * @param {string} indent - the whitespace before the block on its line
 * @returns {Alignment[]} for each such line, an `Edit` that replaces its
 *                        prefix, from column 0 to its text, with the aligned
 *                        prefix, and the `column` that prefix ends at
 */
export function mishung(text, indent) {
  const out = [];
  for (const it of parseItems(parseBlock(text, indent)?.recs ?? [])) {
    if (it.type !== 'para' || !it.bullet) continue;
    const prefix = hangPrefix(it.bullet, indent);
    const column = prefix.length;
    for (const r of it.recs) {
      const end = r.raw.match(/^\s*\*\s*/)?.[0].length ?? 0;
      if (end !== column)
        out.push({ at: r.at, start: 0, end, text: prefix, column });
    }
  }
  return out;
}

/**
 * @param {string} text - the block, from its `/**` to its `*\/`
 * @param {string} indent - the whitespace before the block on its line
 * @returns {string} the block, with its list items' wrapped lines aligned
 */
export function alignBullets(text, indent) {
  return applyEdits(text, indent, mishung(text, indent));
}

/**
 * Finds the gaps between words on a line that aren't the space reflow puts
 * there:  two after a sentence end or a colon, one otherwise.  A gap of two
 * or more spaces after `.`, `!` or `?` makes a sentence end
 * (see `endsSentence`), so it should be two.  Only the text reflow modifies
 * is checked, so lists, tables, code and `@example` are skipped, and so are
 * the spaces inside code spans, links, `{...}` and `[...]`.  Indentation and
 * trailing whitespace are left to the other rules, and so is what a gap is
 * made of (see `exoticSpaces`), since only its width is checked.
 *
 * A gap that no space belongs in (see `tight`) is left to `mispunctuated`.
 * The two gaps around a tag's `-` (see `separatorOf`) are one space each,
 * and their kind is `tag`, whatever the words beside them.
 *
 * Each spacing rule fixes only the gaps of its own `kind`, and no fix changes
 * the kind of any gap, so the rules are independent:  any of them may be on
 * without the others, and they settle on the same block in any order.
 * A gap's kind depends only on the tokens on either side of it, as reflow
 * joins them (see `wholeWords`), and whether it's wide.  A fix to two spaces
 * leaves a sentence end or a colon wide, so it still ends a sentence or
 * follows a colon.  A fix to one space makes a gap narrow, and a narrow gap
 * ends a sentence only where a wide one would (see `endsSentence`), so it
 * still separates other words.  A `tag` gap's kind comes from where it is,
 * not how wide it is, and its width changes no other gap's kind.
 * And removing the gaps that `mispunctuated` finds doesn't change the tokens.
 *
 * @param {string} text - the block, from its `/**` to its `*\/`
 * @param {string} indent - the whitespace before the block on its line
 * @returns {Finding[]} for each such gap, a `Finding` whose span runs from
 *                      the start of the word before it to the end of the word
 *                      after it, whose edit replaces it with the space it
 *                      should be, and whose `kind` is `sentence`, `colon`,
 *                      `word` or `tag`
 */
export function misspaced(text, indent) {
  /**
   * @type {Finding[]}
   */
  const out = [];
  for (const it of parseItems(parseBlock(text, indent)?.recs ?? [])) {
    if (it.type !== 'para') continue;
    const words = placeParaWords(it);
    const whole = wholeWords(words.map((w) => w.word));
    const dash = separatorOf(words.map((w) => w.word));
    words.slice(1).forEach((b, k) => {
      const a = words[k];
      if (a.at !== b.at || tight(a.word, b.word)) return;
      const wide = b.gap.length > 1;
      const tag = dash > 0 && (k === dash - 1 || k === dash);
      const space = tag ? ' ' : sepAfter(whole[k], whole[k + 1], wide);
      // A gap of the right width is left as it is, even if it's a tab, which
      // `exoticSpaces` finds.
      if (b.gap.length === space.length) return;
      const ends = endsSentence(whole[k], whole[k + 1], wide);
      let kind = space === ' ' ? 'word' : ends ? 'sentence' : 'colon';
      if (tag) kind = 'tag';
      out.push({
        ...span(kind, a.at, a.start, b.end),
        at: a.at,
        start: a.end,
        end: b.start,
        text: space,
      });
    });
  }
  return out;
}

/**
 * Finds the gaps on a line between words that no space belongs between
 * (see `tight`):  before `, . ; : ) ]`, and after `(` and `[`.
 * Like `misspaced`, it checks only the text reflow modifies, and skips
 * the spaces inside code spans, links, `{...}` and `[...]`.  A line break
 * between two such words is left to reflow, which joins them.
 *
 * @param {string} text - the block, from its `/**` to its `*\/`
 * @param {string} indent - the whitespace before the block on its line
 * @returns {Finding[]} for each such gap, a `Finding` of `kind` `punctuation`
 *                      whose span runs from the start of the word before it
 *                      to the end of the word after it, and whose
 *                      edit removes it
 */
export function mispunctuated(text, indent) {
  /**
   * @type {Finding[]}
   */
  const out = [];
  for (const it of parseItems(parseBlock(text, indent)?.recs ?? [])) {
    if (it.type !== 'para') continue;
    const words = placeParaWords(it);
    words.slice(1).forEach((b, k) => {
      const a = words[k];
      if (a.at !== b.at || !tight(a.word, b.word)) return;
      out.push({
        ...span('punctuation', a.at, a.start, b.end),
        at: a.at,
        start: a.end,
        end: b.start,
        text: '',
      });
    });
  }
  return out;
}

/**
 * @param {string} text - the block, from its `/**` to its `*\/`
 * @param {string} indent - the whitespace before the block on its line
 * @returns {string} the block, with no space before `, . ; : ) ]` or after
 *                   `(` and `[` on a line
 */
export function fixPunctuation(text, indent) {
  return applyEdits(text, indent, mispunctuated(text, indent));
}

/**
 * Finds the list items whose marker (`-`, `*`, or a number and `.`) isn't
 * followed by exactly one space, as when two spaces follow it.  Only that
 * gap's width is checked, so a tab there is left to `exoticSpaces`.
 * The indentation before the marker, which nests a list, is the author's,
 * and the item's line is otherwise kept as it is, as reflow keeps it.
 * Since the spacing rules skip that line, a number's `.` there is never taken
 * for a sentence end.  A word always follows the gap, so a line keeps being
 * a list item when it's fixed, and the fix changes no other rule's findings.
 *
 * @param {string} text - the block, from its `/**` to its `*\/`
 * @param {string} indent - the whitespace before the block on its line
 * @returns {Finding[]} for each such item, a `Finding` of `kind` `bullet`
 *                      whose span runs from the start of its marker to
 *                      the end of the word after it, and whose edit leaves
 *                      one space between them
 */
export function misbulleted(text, indent) {
  /**
   * @type {Finding[]}
   */
  const out = [];
  for (const it of parseItems(parseBlock(text, indent)?.recs ?? [])) {
    if (it.type !== 'raw' || !it.bullet || it.bullet.gap.length === 1) continue;
    const { at, start, marker, gap, end } = it.bullet;
    const after = start + marker.length;
    out.push({
      ...span('bullet', at, start, end),
      at,
      start: after,
      end: after + gap.length,
      text: ' ',
    });
  }
  return out;
}

/**
 * Finds the whitespace in a block's text that isn't plain spaces
 * (see `EXOTIC`).  A line is checked from just after its `*` (or a one-line
 * block's `/**`) through its last word, so the whitespace that indents its
 * `*`, which may be tabs, is left as it is, and so is the whitespace after
 * its text, which `no-trailing-space` removes whatever it is.  A one-line
 * block's space before its `*\/` stays, so it's checked too.  Fenced code,
 * indented code and `@example` are skipped, since a tab may belong there,
 * but code spans aren't, since reflow joins their words with plain spaces.
 *
 * Each such character becomes one space, so the fix changes no gap's width,
 * and the spacing and edge rules, which check only widths, find the same gaps
 * before and after it.  A zero-width space inside a word converts to a space,
 * creating two words.
 *
 * @param {string} text - the block, from its `/**` to its `*\/`
 * @param {string} indent - the whitespace before the block on its line
 * @returns {Finding[]} for each run of whitespace with such a character in it,
 *                      a `Finding` of `kind` `exotic` whose span runs from
 *                      the start of the word (or `*`) before it to the end of
 *                      the word (or `*\/`) after it, and whose edit makes
 *                      each of its exotic spaces a plain space
 */
export function exoticSpaces(text, indent) {
  const block = parseBlock(text, indent);
  if (!block) return [];
  const { lines } = block;
  const one = lines.length === 1;
  // The lines whose text is checked:  every body line but code.
  const checked = parseItems(block.recs).flatMap((it) => {
    if (it.type !== 'raw') return it.recs.map((r) => r.at);
    return it.code ? [] : [it.at];
  });
  /**
   * @type {Finding[]}
   */
  const out = [];
  for (const at of checked) {
    const l = lines[at];
    const from = one ? l.indexOf('/**') + 3 : l.indexOf('*') + 1;
    const to = one ? l.lastIndexOf('*/') : l.trimEnd().length;
    for (const m of l.slice(from, to).matchAll(/[\s\u200b]+/g)) {
      if (!/[^ ]/.test(m[0])) continue;
      const start = from + m.index;
      const end = start + m[0].length;
      const before = l.slice(0, start).search(/[^\s\u200b]*$/);
      const after = end + l.slice(end).search(/[\s\u200b]|$/);
      out.push({
        ...span('exotic', at, before, after),
        at,
        start,
        end,
        text: m[0].replace(EXOTIC, ' '),
      });
    }
  }
  return out;
}

/**
 * @param {string} text - the block, from its `/**` to its `*\/`
 * @param {string} indent - the whitespace before the block on its line
 * @returns {string} the block, with the whitespace in its text made of
 *                   plain spaces
 */
export function fixWhitespace(text, indent) {
  return applyEdits(text, indent, exoticSpaces(text, indent));
}

/**
 * Finds each word of a paragraph, masked (see `mask`).  A span may cross
 * lines, so the paragraph is masked as a whole, then split into lines.
 *
 * @param {Para} it - the paragraph
 * @returns {{ at: number, start: number, end: number, word: string, gap: string }[]}
 *   each word's line's index in the block, its `start` and `end` columns on
 *   that line, the `word` itself, and the `gap` of whitespace before
 *   it on its line
 */
function placeParaWords(it) {
  const masked = mask(it.recs.map((r) => r.content).join('\n')).split('\n');
  return it.recs.flatMap((r, i) =>
    [...masked[i].matchAll(/(\s*)(\S+)/g)].map((m) => {
      const start = r.offset + m.index + m[1].length;
      const end = start + m[2].length;
      return { at: r.at, start, end, word: m[2], gap: m[1] };
    }),
  );
}

/**
 * @param {string} text - the block, from its `/**` to its `*\/`
 * @param {string} indent - the whitespace before the block on its line
 * @returns {string} the block, with the gaps between its words spaced
 */
export function fixSpacing(text, indent) {
  return applyEdits(text, indent, misspaced(text, indent));
}

/**
 * Applies edits to a block's lines.  They're applied from the last to
 * the first, so an edit doesn't move the columns of an earlier one
 * on its line.
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
 * A word that `placeWords` finds:  the index in the block of the line it
 * starts on (`at`) and of the line it ends on (`endAt`), its `start` and
 * `end` columns on those lines, and the `word` itself.
 *
 * @typedef {{ at: number, endAt: number, start: number, end: number, word: string }} PlacedWord
 */

/**
 * Finds each word in a block, without its delimiters and line prefixes,
 * plus the `/**` before them and the `*\/` after them.  Words that no space
 * belongs between (see `tight`) are found as one, even across a line break,
 * since reflow joins them.
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
  /**
   * @type {PlacedWord[]}
   */
  const out = [{ at: 0, endAt: 0, start, end: start + 3, word: '/**' }];
  let prev = '';
  lines.forEach((l, at) => {
    // Blank out the delimiters and line prefixes, keeping the columns.
    if (at === last) l = l.slice(0, close);
    if (at === 0)
      l = ' '.repeat(indent.length + 3) + l.slice(indent.length + 3);
    else l = l.replace(/^\s*\*(?!\S)/, (m) => ' '.repeat(m.length));
    for (const m of l.matchAll(/\S+/g)) {
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
 * Finds the lines of a block that reflow fixes whose whitespace is off before
 * their first word or after their last:  a `*` that isn't under the `/**`,
 * extra whitespace between the `*` and the text, or whitespace after the text.
 * A one-line block's text should have one space on either side.
 * Only the lines that reflow fixes are checked, so it skips the opening and
 * closing lines and the lines reflow keeps verbatim (lists, code and
 * the like).  It also leaves the indentation of a tag's continuation lines to
 * `tag-align`, and of a list item's wrapped lines to `bullet-align`.
 * Each kind fixes a different part of a line, so the edge rules are
 * independent, like the spacing rules.  The whitespace before the text is
 * checked by its width, so a tab there is left to `exoticSpaces`.
 *
 * @param {string} text - the block, from its `/**` to its `*\/`
 * @param {string} indent - the whitespace before the block on its line
 * @returns {Finding[]} for each, a `Finding` of `kind` `star`, from the start
 *                      of the line to the end of the first word after the `*`,
 *                      whose edit puts the `*` under the `/**`;
 *                      `leading`, from the `*` (or `/**`) to the end of
 *                      the word after it, whose edit leaves one space between
 *                      them; or `trailing`, from the start of the last word
 *                      to the end of the line, whose edit removes
 *                      the whitespace after that word (or leaves one space
 *                      before the `*\/`)
 */
export function misedged(text, indent) {
  const block = parseBlock(text, indent);
  if (!block) return [];
  /**
   * @type {Finding[]}
   */
  const out = [];
  /**
   * @type {(m: { 0: string, index: number }) => number}
   */
  const endOf = (m) => m.index + m[0].length;
  if (block.lines.length === 1) {
    // This matches the whole line rather than the body line from
    // `parseBlock`, so `/**  */` has no word to check, and in `/**  foo*\/`
    // the highlight runs through the `*\/`, since no space separates it from
    // the word.
    const l = block.lines[0];
    const one = l.match(/^\s*\/\*\*\s(\s*)\S.*?(\s*)\*\/$/);
    if (!one) return [];
    // The words, between the `/**` and `*\/` tokens.
    const words = [...l.matchAll(/\S+/g)];
    const [open, first] = words;
    const last = words[words.length - 2];
    if (one[1]) {
      const edit = {
        at: 0,
        start: open.index + 3,
        end: first.index,
        text: ' ',
      };
      out.push({ ...span('leading', 0, open.index, endOf(first)), ...edit });
    }
    if (one[2].length > 1) {
      const edit = { at: 0, start: endOf(last), end: l.length - 2, text: ' ' };
      out.push({ ...span('trailing', 0, last.index, l.length), ...edit });
    }
    return out;
  }
  for (const it of parseItems(block.recs)) {
    if (it.type === 'raw') continue;
    it.recs.forEach((r, i) => {
      const { at, raw: l } = r;
      // The `*`, then the words.
      const words = [...l.matchAll(/\S+/g)];
      const [star, first = star] = words;
      const last = words[words.length - 1];
      // A tag's continuation lines and a list item's wrapped lines are
      // indented by `tag-align` and `bullet-align`.
      if (it.type === 'blank' || (!it.bullet && (!it.tag || i === 0))) {
        if (star.index !== indent.length + 1) {
          const edit = { at, start: 0, end: star.index, text: `${indent} ` };
          out.push({ ...span('star', at, 0, endOf(first)), ...edit });
        }
        if (first.index - star.index > 2) {
          const edit = {
            at,
            start: star.index + 1,
            end: first.index,
            text: ' ',
          };
          out.push({
            ...span('leading', at, star.index, endOf(first)),
            ...edit,
          });
        }
      }
      if (/\s$/.test(l)) {
        const edit = { at, start: endOf(last), end: l.length, text: '' };
        out.push({ ...span('trailing', at, last.index, l.length), ...edit });
      }
    });
  }
  return out;
}

/**
 * @param {string} text - the block, from its `/**` to its `*\/`
 * @param {string} indent - the whitespace before the block on its line
 * @returns {string} the block, with the whitespace at its lines' edges fixed
 */
export function fixEdges(text, indent) {
  return applyEdits(text, indent, misedged(text, indent));
}

/**
 * Finds where a block's line breaks differ from its reflow's, given that both
 * have the same words.  The two are compared at each gap between words,
 * where each one either breaks a line or doesn't.  The first gap where they
 * differ is reported.  Later differences aren't reported until both break
 * a line at the same gap again, since those differences follow from the first.
 * If none is found, it reports each line that differs, or the whole block if
 * the two have different numbers of lines.
 *
 * @param {string} text - the block, from its `/**` to its `*\/`
 * @param {string} fixed - its reflow, with the same words
 * @param {string} indent - the whitespace before the block on its line
 * @returns {Span[]} for each difference, a `Span` of `kind` `break` if a line
 *                   should break between two words, `join` if they should be
 *                   on one line, or `reflow` for a line
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
 * keep these as they are, so it only changes whitespace.  Words that no space
 * belongs between (see `tight`) count as one, so reflow may join them.
 *
 * @param {string} text - a JSDoc block
 * @returns {string[]} its words, in order
 */
export function wordsOf(text) {
  return placeWords(text, '')
    .slice(1, -1)
    .map((w) => w.word);
}
