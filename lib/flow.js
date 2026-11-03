/**
 * The text engine behind the rules.  Text is split into tokens at spaces,
 * and tokens are glued into units that a line never breaks inside
 * (see `fillPara`).  Lines are then filled greedily with units, and a break
 * moves earlier only where it would break a rule.  A token is wide if two or
 * more spaces follow it in the source, which only counts with two spaces
 * after a sentence end (see `wideIn`).
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
 * The nominal width of a JSDoc line by default, prefix included:  the width
 * of the editor it's read in.
 */
export const WIDTH = 80;

/**
 * The columns kept free at the right of the nominal width, so a line that
 * hangs punctuation past its working width still ends short of
 * the editor's edge.  The working width, the widest a line may be,
 * is the nominal width less this.
 */
const MARGIN = 2;

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
 * so `first.` isn't taken for `st.`.  `Inc.`, `Ltd.`, `Corp.`, `Co.`,
 * `Jr.` and `Sr.` close the name before them, so a capitalized word after one
 * more likely starts a sentence than goes on with that name, as in
 * "Foo Inc.  Then".
 */
const ABBR =
  /(^|[^a-z])(e\.g|i\.e|etc|al|a\.k\.a|w\.r\.t|esp|incl|approx|vs|cf|fig|eq|sec|ch|vol|pp|no|nos|a\.m|p\.m|a\.d|b\.c|a\.c\.e|b\.c\.e|dr|mr|mrs|ms|prof|st|jr|sr|inc|ltd|corp|co)\.$/i;

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
 * The abbreviations in `ABBR` that are ordinary words too, so only a number
 * right after one shows that it's an abbreviation, as in "No. 5".
 * Before anything else, it's a word ending a sentence, as in "The answer
 * is no.  Then".
 */
const BEFORE_NUMBER = new Set('no nos'.split(' '));

/**
 * Matches a token that ends in a dotted initialism:  two or more capitals,
 * each with its period, as in `U.S.` or `U.K.`.  A capitalized word after one
 * may be part of a name ("The U.S. Government"), as after `St.`, so it stays
 * inside its sentence unless it's wide (see `abbrInSentence`).  The match
 * must start the token or follow a character that can't be in an identifier
 * or a path, so `Foo.A.B.` isn't one.  One that `ABBR` matches too, such as
 * `A.D.`, counts as that instead.
 */
const INITIALISM = /(?:^|[^\p{L}\p{N}_$.])(?:\p{Lu}\.){2,}$/u;

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
 * @property {boolean} [preformatted] - whether to keep what looks like
 *                                      unfenced code (see `parseItems`),
 *                                      which isn't a limit, but the block's
 *                                      parse, so the rule takes it from
 *                                      the shared settings
 * @property {1 | 2} [spaces] - how many spaces follow a sentence end or
 *                              a colon on a line (see `sepAfter`),
 *                              which isn't a limit either, so the rule takes
 *                              it from the shared settings too
 */

/**
 * The options of the functions that read a block, which the rules take from
 * the shared settings, so they all read and space a block the same way.
 * A function that never spaces a gap ignores `spaces`.
 *
 * @typedef {object} BlockOptions
 * @property {boolean} [preformatted] - whether to keep what looks like
 *                                      unfenced code (see `parseItems`),
 *                                      unless `false`
 * @property {1 | 2} [spaces] - how many spaces follow a sentence end or
 *                              a colon on a line (see `sepAfter`),
 *                              `2` unless it's set
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
 * Finds the tag a one-line block begins with.  Only the first word counts,
 * since these rules see a tag only at the start of a line, so in
 * `@type {Foo} @deprecated` the `@deprecated` is the first tag's text.
 * A zero-width space counts as whitespace, as `no-exotic-whitespace` makes it.
 *
 * @param {string} text - the block's text
 * @returns {string | undefined} the tag's name, without its `@`, if any
 */
export const leadingTag = (text) =>
  /^@([A-Za-z][\w-]*)/.exec(text.replace(EXOTIC, ' ').trimStart())?.[1];

/**
 * Whether a one-line block is a `@ts-*` directive, such as `@ts-expect-error`.
 * TypeScript reads a directive only from a block's last line, so one spread
 * over three lines stops working, and it has to stay on one line however wide.
 *
 * @param {string} text - the block's text
 * @returns {boolean} whether it begins with a `@ts-*` tag
 */
export const isDirective = (text) => !!leadingTag(text)?.startsWith('ts-');

/**
 * Whether the `*` and `_` after a token's text close emphasis, rather than
 * being part of what it says, as in `.eslintrc.*`, `foo._` or `s3:*`.
 * Only the token can show that, since a gap's kind depends on nothing further
 * away (see `misspaced`).  So they must mirror the ones that open the token,
 * before a letter, a digit or a code span, as in `*Done.*`,
 * which `*.*` doesn't.  Only `**` and longer runs of `*` may close what
 * an earlier word opened, as in `**Note this.**`, if a word's end comes
 * before them, since they mean little else there.  A single `*` or a `_` that
 * an earlier word opened doesn't count.
 *
 * @param {string} base - a token, up to its closing brackets,
 *                        quotes and emphasis
 * @param {string} marks - the `*` and `_` among those, in order
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
 * @param {string} t - a token
 * @returns {string} the token without closing brackets,
 *                   quotes (straight or curly) and emphasis, so `end.)`,
 *                   `end.”` and `**end.**` are seen to end in a period.
 *                   A `*` or `_` that doesn't close emphasis
 *                   (see `closesEmphasis`) stays, with what's before it,
 *                   so `foo.*` and `foo_` aren't.
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
 * @param {string | undefined} t - a token, or undefined at the end
 *                                 of a paragraph
 * @returns {boolean} whether the token starts with a digit, after any opening
 *                    brackets, quotes and emphasis
 */
const numeric = (t) => /^[("'[*_]*\d/.test(t ?? '');

/**
 * @param {string} t - a token
 * @returns {string | undefined} the abbreviation the token ends in,
 *                               lowercase and without its last period, as in
 *                               `mr` or `b.c.e`, or undefined if it
 *                               ends in none
 */
const abbrOf = (t) => ABBR.exec(t)?.[2].toLowerCase();

/**
 * Whether a token that `ABBR` or `INITIALISM` matches stays inside its
 * sentence, as `e.g.` does in "e.g. this one", rather than ending it,
 * as `etc.` does in "and so on, etc.  Then".  One in `BESIDE_NAME` other than
 * `St.` always stays inside, even when it's wide, so one space always
 * follows it.  `St.` and an initialism stay inside unless they're wide, as in
 * "on Elm St.  Then" and "in the U.S.  Then", since nothing else shows
 * whether the capitalized word after one goes on with a name.  One in
 * `BEFORE_NUMBER` stays inside only if it isn't wide and a number follows it.
 * Any other abbreviation stays inside unless it's wide or the word after it
 * starts with a capital, so two spaces after one are how an author marks
 * a sentence end.  A word that starts with code or a digit counts as
 * lowercase (see `capitalized`), so `Fig.`, `Vol.` and the like before
 * a number stay inside.  So does an abbreviation at the end of a paragraph,
 * where nothing follows it.
 *
 * @param {string} t - a token ending in `.`
 * @param {string} [next] - the token after it
 * @param {boolean} [wide] - whether the token is wide
 * @returns {boolean} whether the token is an abbreviation that the sentence
 *                    goes on past
 */
const abbrInSentence = (t, next, wide) => {
  const word = abbrOf(t);
  if (word === 'st' || (!word && INITIALISM.test(t))) return !wide;
  if (word && BEFORE_NUMBER.has(word)) return !wide && numeric(next);
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
 * @returns {boolean} whether the token ends in a colon
 */
const endsColon = (t) => /:$/.test(stripClose(t));

/**
 * @param {string} t - a token
 * @param {string} [next] - the token after it
 * @param {boolean} [wide] - whether the token is wide
 * @param {1 | 2} [spaces] - how many spaces follow a sentence end or a colon
 * @returns {string} the space that follows the token on a line:  two after
 *                   a sentence end or a colon, unless `spaces` is `1`,
 *                   and one otherwise
 */
const sepAfter = (t, next, wide, spaces) =>
  spaces !== 1 && (endsSentence(t, next, wide) || endsColon(t)) ? '  ' : ' ';

/**
 * Whether a gap makes the token before it wide, and so may show that
 * a sentence ended (see `endsSentence`).  With two spaces, a gap at
 * a sentence end stays wide when it's fixed.  With one space, every gap is
 * fixed to the same width, so a gap's width can't count:  a token would stop
 * ending a sentence once its gap was fixed.  So no token is wide then,
 * and what a gap is depends only on the words beside it.
 *
 * @param {string} gap - the whitespace after a token
 * @param {1 | 2} [spaces] - how many spaces follow a sentence end or a colon
 * @returns {boolean} whether the token is wide
 */
const wideIn = (gap, spaces) => spaces !== 1 && gap.length > 1;

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
  const bare = codeless(t.replace(/["'\u2019\u201d*_]+$/, ''));
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
 * @param {string[]} tokens - a tag's masked tokens, from its `@`, or from
 *                            the end of its multi-line `{Type}`
 * @param {string} [typed] - the tag's name, if `tokens` start from the end of
 *                           its multi-line `{Type}` (see `typeSpan`)
 * @returns {number} how many of them make up its head, which stays together:
 *                   `@param name -`, `@returns`, or `@returns {Type}`, say
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
 * Finds the `-` that ends a tag's head, as in `@param name - the name`.
 * One space goes on either side of it, whatever the word before it ends in,
 * and `tag-spacing` owns those two gaps.  A `-` glued to a word, as in
 * `name- the name` or `name -1 or more`, is part of that word,
 * not a separator.
 *
 * @param {string[]} words - a paragraph's masked words, in order
 * @param {string} [typed] - the tag's name, if `words` start from the end of
 *                           its multi-line `{Type}` (see `typeSpan`)
 * @returns {number} the index of the separator among the words, or -1 if
 *                   the paragraph isn't a tag or its head has no `-`
 */
function separatorOf(words, typed) {
  if (!typed && !isTag(words[0] ?? '')) return -1;
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
  const head = headSize(tokens, typed);
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
 * Matches a code span, a markdown link, the `{` of a `{@link ...}` or
 * `{Type}`, or an `[optional]` name, whichever starts first.  A code span is
 * matched whole, so a bracket inside one never pairs with a bracket outside
 * it, as the `[` of `` `[` `` doesn't with the `]` of a later `` `[...]` ``.
 * The others may hold code spans, and a bracket inside one doesn't close them.
 * A backtick that no other follows starts no code span.  A `{Type}` may hold
 * braces to any depth, so `braceEnd` finds where it ends.
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
      '\\{',
      `\\[${atom('\\]')}*\\]`,
    ].join('|'),
    'g',
  );
})();

/**
 * @param {string} s - text
 * @param {number} open - the index of a `{` in it
 * @returns {number} the index just past the `}` that closes it, or -1 if
 *                   none does.  A brace in a code span doesn't count.
 */
function braceEnd(s, open) {
  let depth = 0;
  for (const m of s.slice(open).matchAll(/`[^`]*`|[{}]/g)) {
    if (m[0] === '{') depth++;
    else if (m[0] === '}' && --depth === 0) return open + m.index + 1;
  }
  return -1;
}

/**
 * @param {string} s - text
 * @returns {string} the text, with its whitespace masked (see `MASKS`),
 *                   other than its line breaks
 */
const hide = (s) => s.replace(/[^\S\n\r]/g, (c) => MASKS[SPACES.indexOf(c)]);

/**
 * Makes the spans `SPANS` matches unbreakable, by masking their
 * inner whitespace.  A line break inside one stays, so the text still splits
 * into its lines.  A `{` that nothing closes starts no span.
 *
 * @param {string} s - a paragraph's text
 * @returns {string} the text, with that whitespace masked
 */
function mask(s) {
  let out = '';
  let done = 0;
  SPANS.lastIndex = 0;
  for (let m = SPANS.exec(s); m; m = SPANS.exec(s)) {
    const end = m[0] === '{' ? braceEnd(s, m.index) : SPANS.lastIndex;
    if (end < 0) continue;
    out += s.slice(done, m.index) + hide(s.slice(m.index, end));
    done = SPANS.lastIndex = end;
  }
  return out + s.slice(done);
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
 * @property {string} [typed] - the tag's name, if the paragraph starts on
 *                              the line that closes its multi-line `{Type}`.
 *                              That line's text through the closing brace is
 *                              masked, so it's the paragraph's first word.
 */

/**
 * Matches the start of a list item's body line, without its ` * ` prefix:
 * any indentation, the item's marker (`-`, `*`, `+`, or a number and `.`
 * or `)`), the whitespace after it, and the first word of its text.
 */
const BULLET = /^(\s*)([-*+]|\d+[.)])(\s+)(\S+)/;

/**
 * The HTML elements whose block runs to their closing tag, blank lines and
 * all, as in Markdown.
 */
const VERBATIM_HTML = /^<(pre|script|style|textarea)(?:[\s>]|$)/i;

/**
 * The names of the HTML elements that start a block, or close one.
 * They're the block-level ones of Markdown's list that a doc comment might
 * hold, without those such as `<title>` and `<link>`, which are likelier to
 * be placeholders in prose.
 */
const HTML_NAMES =
  'pre|script|style|textarea|address|article|aside|blockquote|center|dd|' +
  'details|dialog|div|dl|dt|fieldset|figcaption|figure|footer|form|' +
  'h[1-6]|header|hr|li|main|menu|nav|ol|p|section|summary|table|tbody|td|' +
  'tfoot|th|thead|tr|ul';

/**
 * Matches a trimmed line that starts or closes an HTML block, or a token that
 * would if it started a line.
 */
const HTML_BLOCK = new RegExp(`^</?(?:${HTML_NAMES})(?:[\\s/>]|$)`, 'i');

/**
 * Matches a trimmed line that's a table's delimiter row, which has a `|` in
 * it, and otherwise only `-`, `:` and spaces, with at least one `-`.
 */
const DELIMITER = /^(?=.*\|)[|:\s-]*-[|:\s-]*$/;

/**
 * Matches a trimmed line that makes the line before it a heading or a table's
 * header:  `=` or two or more `-`, or a table's delimiter row.
 */
const UNDERLINE = new RegExp(`^=+$|^-{2,}$|${DELIMITER.source}`);

/**
 * Matches a trimmed line that's a construct only if it's the whole line:
 * a thematic break (three or more of `-`, `*` or `_`, perhaps spaced),
 * an underline (see `UNDERLINE`), a list marker with nothing after it,
 * which would start a list item if the next line joined it, or a link
 * reference definition, which holds a URL and perhaps a title.  A space
 * before the colon doesn't count, since `no-extra-punctuation-space`
 * removes it.
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
 * Matches a trimmed line that's kept as it is, whatever else is on it:
 * an ATX heading (up to six `#`, then a space or nothing), a blockquote
 * (a `>`, which Markdown doesn't require a space after), or a number with
 * whitespace before its `.` or `)`, which `no-extra-punctuation-space` would
 * make a list item.
 */
const KEPT = /^(?:#{1,6}(?:\s|$)|>|\d+\s+[.)](?:\s|$))/;

/**
 * Matches a token that a wrap must never put at the start of a line, where it
 * would read as a block construct:  anything starting with `@`, `*`, `|`, `>`,
 * a fence's three backticks or `~~~`, an HTML block's tag or `<!--`,
 * or a link reference's `[ref]:`, or anything that's only `#`s, a list marker
 * (`+`, or a number and `.` or `)`), a run of `=` or `_`, the `^` and `~` of
 * a pointer line, or the `-`, `:` and `|` of a thematic break, an underline,
 * a delimiter row or a `-` list marker.
 */
const NO_START = new RegExp(
  `^(?:${[
    '[@*|>]',
    '```',
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
 * Matches text that ends in a hard break:  a `<br>` or a backslash.
 * Two spaces at the end of a line aren't one here, since `no-trailing-space`
 * removes them.
 */
const HARD_BREAK = /(?:<br\s*\/?>|\\)$/i;

/**
 * Matches a trimmed line made only of runs of `^` and `~` with whitespace
 * between them, which point at the line above.  Three or more `~` at its
 * start open a fence instead, as in Markdown.
 */
const POINTER = /^[\^~]+(?:\s+[\^~]+)*$/;

/**
 * The most characters other than whitespace that a line ending in `:` may
 * have and still be a label (see `isLabel`).  Whitespace doesn't count,
 * so a fix to the spaces on a line never changes what kind of line it is.
 */
const SHORT_LABEL = 24;

/**
 * The most characters other than whitespace that a line after a label may
 * have and still be line-oriented (see `parseItems`), which is too few for
 * a full line of prose wrapped at about 70 columns or more.
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
 * @param {string} s - a trimmed body line
 * @returns {RegExp | undefined} what a line closing the fence it opens
 *                               matches, if it opens one.  A fence of
 *                               backticks closes on a line starting with
 *                               three of them, and a closing `~~~` is at
 *                               least as long as the one that opened it,
 *                               alone on its line, as in Markdown.
 */
const fenceEnd = (s) => {
  if (s.startsWith('```')) return /^```/;
  const tildes = /^~{3,}/.exec(s)?.[0];
  return tildes ? new RegExp(`^${tildes}~*$`) : undefined;
};

/**
 * @param {string} s - a trimmed body line
 * @returns {RegExp | undefined} what a line closing the verbatim HTML it
 *                               opens matches, if it opens any:  an element
 *                               that `VERBATIM_HTML` matches, or a comment
 */
const verbatimEnd = (s) => {
  const name = VERBATIM_HTML.exec(s)?.[1];
  if (name) return new RegExp(`</${name}\\s*>`, 'i');
  return s.startsWith('<!--') ? /-->/ : undefined;
};

/**
 * A list item's marker on its line:  the line's index in the block (`at`),
 * the column the `marker` starts at (`start`), the whitespace after it
 * (`gap`), and the column the first word after that ends at (`end`).
 * Its text starts one space after the marker once `bullet-spacing` spaces it.
 *
 * @typedef {{ at: number, start: number, marker: string, gap: string, end: number }} Bullet
 */

/**
 * A body line's text, read as `no-exotic-whitespace` would leave it, so a fix
 * to its whitespace never changes what kind of line it is.  A zero-width
 * space matters here, since `\s` doesn't match it.
 *
 * @param {string} content - a body line's text
 * @returns {string} the text, with each exotic space a plain one
 */
const plainOf = (content) => content.replace(EXOTIC, ' ');

/**
 * How far a body line's text is indented past the one space after its `*`,
 * read as `no-exotic-whitespace` would leave it, which makes each exotic
 * space one plain space.  So it's read from the whole line, since a tab right
 * after the `*` is that one space.
 *
 * @param {BodyLine} r - a body line
 * @returns {number} the indentation
 */
const indentOf = ({ raw }) =>
  plainOf(raw)
    .replace(/^\s*\* ?/, '')
    .search(/[^ ]|$/);

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
 * Finds a tag's `{Type}` that spans several lines.  It starts right after
 * the tag's name, perhaps on the next line, and may hold blank lines, but it
 * ends before the next tag.  A `{@link ...}` isn't a type, and a `{` that
 * doesn't close before the next tag starts no span.
 *
 * @param {BodyLine[]} recs - the body lines
 * @param {number} i - the index among them of a line that starts a tag
 * @returns {{ at: number, kept: number, name: string } | null}
 *   the index in the block of the line it closes on (`at`), how much of that
 *   line's text is inside it (`kept`), and the tag's `name`, or null if
 *   the tag has no such type
 */
function typeSpan(recs, i) {
  const next = recs.findIndex((r, k) => k > i && isTag(r.content.trim()));
  const text = recs
    .slice(i, next < 0 ? undefined : next)
    .map((r) => r.content)
    .join('\n');
  const m = /^\s*@([A-Za-z]\S*)(?!\s*\n\s*\n)\s+\{(?!@)/.exec(text);
  if (!m) return null;
  const end = braceEnd(text, m[0].length - 1);
  if (end < 0) return null;
  const lines = text.slice(0, end).split('\n');
  if (lines.length === 1) return null;
  const at = recs[i + lines.length - 1].at;
  return { at, kept: lines[lines.length - 1].length, name: m[1] };
}

/**
 * An item of a block (see `parseItems`).  A raw item keeps its line's index
 * in the block (`at`), whether it's code (`code`), and the name of the tag
 * that begins it (`tag`), though a line of code has one only if it's
 * an `@example`'s.  One that's a list item keeps its marker (`bullet`).
 *
 * @typedef {{ type: 'blank', recs: BodyLine[] }} Blank
 * @typedef {{ type: 'raw', raw: string, at: number, code: boolean, tag: string | undefined, bullet?: Bullet }} Raw
 * @typedef {Blank | Raw | Para} Item
 */

/**
 * Turns the body lines of a block into items:  blank, raw (kept as is),
 * or para (a paragraph, or a tag with its continuation lines).
 * Bullets, numbered lists, tables, headings, a heading's or table header's
 * line above its underline, blockquotes, thematic breaks, link reference
 * definitions, fenced code, HTML blocks, `@example` and indented code are raw,
 * though a bullet's wrapped lines are flowed as a paragraph.  As in Markdown,
 * the lines right after a list item are its wrapped lines unless a blank line,
 * a tag or another raw line comes first, and that para keeps
 * the item's marker.  A blank or a para keeps its lines' records, too.
 * Apart from `preformatted` below, the indentation of a para's later lines
 * doesn't change its items.  A tag's multi-line `{Type}` is raw through
 * the line before it closes, and the line it closes on starts a para
 * (see `Para`), so the name and description after it are flowed.
 *
 * With `preformatted`, what looks like unfenced code or a diagram is raw too,
 * and code, as indented code is.  A run of such lines starts at a pointer
 * line (see `POINTER`) under a line that isn't blank, at a line indented at
 * least two more than the paragraph line above it, or any more if that line
 * is a short label (see `isLabel`), or at line-oriented lines:  two or more
 * short lines (see `SHORT_LINE`) that none of `.`, `!` or `?` ends,
 * from right after a label that starts its paragraph through that
 * paragraph's end.  A run ends at a blank line, a tag, a fence or verbatim
 * HTML, or a line no more indented than the paragraph line above it.
 * A pointer line's run ends at a line less indented than it, or at one that
 * isn't indented.  A label in the middle of a paragraph, right above a run,
 * becomes a paragraph of its own, so it stays on its own line.
 *
 * All this reads a reflow's output the same way the next time.
 * Only a pointer line starts a run in a tag's description or among a list
 * item's wrapped lines, since these rules set the indentation there.
 * A paragraph's flowed lines aren't indented, a wrap never starts a line with
 * a pointer (see `NO_START`), and when a wrap makes line-oriented lines,
 * keeping them gives back the same lines.  A fix can't change how a block is
 * read either.  Spacing fixes change no line's size, since `sizeOf`
 * skips whitespace.  `text-indent` moves every paragraph line a run doesn't
 * keep to the left edge at once, which only lowers the indentation that lines
 * in a run are past.
 *
 * @param {BodyLine[]} recs - the body lines
 * @param {boolean} [preformatted] - whether to guess at unfenced code and
 *                                   diagrams, as it does unless it's `false`
 * @returns {Item[]} the items, in order
 */
function parseItems(recs, preformatted = true) {
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
   * What's being kept as is:  'code', 'fence', 'html',
   * 'example' or 'preformatted'.
   *
   * @type {string | null}
   */
  let mode = null;
  /**
   * What closes the fence or verbatim HTML being kept as is.
   *
   * @type {RegExp | undefined}
   */
  let closer;
  /**
   * The preformatted run being kept as is:  the indentation a line must be
   * past to stay in it (`above`), and the index among the body lines that it
   * ends at, whatever the indentation (`end`).
   *
   * @type {{ above: number, end: number }}
   */
  let run = { above: 0, end: 0 };
  /**
   * Whether this is a table with no `|` at the start of its delimiter row,
   * so its rows can't be told from text by how they start.  Its lines are
   * kept until a blank line or a tag, so a paragraph that wraps never moves
   * a `|` onto a line that would read as a row.
   */
  let table = false;
  /**
   * The multi-line `{Type}` being kept as is, if any.
   *
   * @type {ReturnType<typeof typeSpan>}
   */
  let type = null;
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
    const tag = !mode || mode === 'example' ? leadingTag(r.content) : undefined;
    const it = { raw: r.raw, at: r.at, code: !!mode, tag };
    items.push(
      bullet ? { type: 'raw', ...it, bullet } : { type: 'raw', ...it },
    );
  };
  /**
   * Whether the line after the body line at an index is an underline.
   *
   * @type {(i: number) => boolean}
   */
  const aboveUnderline = (i) =>
    UNDERLINE.test(plainOf(recs[i + 1]?.content ?? '').trim());
  /**
   * Whether a trimmed line opens something that a run mustn't swallow.
   *
   * @type {(line: string) => boolean}
   */
  const endsRun = (line) =>
    line === '' || isTag(line) || !!fenceEnd(line) || !!verbatimEnd(line);
  /**
   * Whether the body line at an index is kept as is whatever is around it.
   *
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
   * it if it's indented at all, as the `|` of a diagram is, however far
   * the paragraph is indented.  Otherwise, it would leave the run only until
   * `text-indent` moved the paragraph left.  Any other line that leaves
   * the run moves left with the paragraph, so it never comes back.
   *
   * @type {(i: number, line: string) => boolean}
   */
  const inRun = (i, line) =>
    i < run.end &&
    !endsRun(line) &&
    indentOf(recs[i]) > (standsAlone(i) ? 0 : run.above);
  /**
   * Finds where a paragraph's lines from a body line stop, at a line that
   * ends a run or stands alone.
   *
   * @type {(i: number) => number}
   */
  const paraEnd = (i) => {
    const end = recs.findIndex(
      (l, k) =>
        k >= i && (endsRun(plainOf(l.content).trim()) || standsAlone(k)),
    );
    return end < 0 ? recs.length : end;
  };
  /**
   * Finds the preformatted run that a line starts, if any (see above).
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
    if (type && r.at < type.at) {
      raw(r);
      continue;
    }
    // The line that closes a type, above an underline, is kept like any other
    // line there (see below).
    if (type && aboveUnderline(i)) {
      raw(r);
      type = null;
      continue;
    }
    if (type) {
      const { kept, name } = type;
      const content = hide(r.content.slice(0, kept)) + r.content.slice(kept);
      const parts = [content.trimEnd()];
      const rec = { ...r, content };
      cur = { type: 'para', tag: true, typed: name, parts, recs: [rec] };
      type = null;
      continue;
    }

    const s = r.content.trim();
    const line = plainOf(s).trim();
    const indented = /^ {4,}\S/.test(r.content);

    // Indented code is kept as is until a line that's neither indented nor
    // blank, a fence or closed verbatim HTML through its closing line, other
    // HTML until a blank line or a tag, `@example` until the next tag, which
    // may be another `@example`, and a preformatted run as `runFrom` says.
    if (
      (mode === 'code' && (s === '' || indented)) ||
      mode === 'fence' ||
      (mode === 'html' && s !== '' && !isTag(s)) ||
      (mode === 'example' && !isTag(s)) ||
      (mode === 'preformatted' && inRun(i, line))
    ) {
      raw(r);
      if (mode === 'fence' && closer?.test(s)) mode = null;
      continue;
    }

    // Indented code (4+ spaces) starts only at the block's start or after
    // a blank line, and not inside a paragraph.  So the line after a list
    // item, table row or closing fence, which follows a raw item, isn't taken
    // as indented code.  A list item or table row is raw too, but it sets
    // no mode, so the line after it is read afresh, which is how a bullet's
    // wrapped lines become a paragraph.
    mode = null;
    if (s === '' || isTag(s)) table = false;
    else if (DELIMITER.test(line) && !line.startsWith('|')) table = true;
    // Verbatim HTML that no later line closes ends like other HTML, so
    // a stray `<pre>` doesn't keep the rest of the block as is.
    const fence = fenceEnd(line);
    const verbatim = verbatimEnd(line);
    if (indented && !cur && (!items.length || items.at(-1)?.type === 'blank'))
      mode = 'code';
    else if (/^@example\b/.test(s)) mode = 'example';
    else if (fence) {
      mode = 'fence';
      closer = fence;
    } else if (
      verbatim &&
      recs.slice(i).some((l) => verbatim.test(l.content))
    ) {
      mode = 'fence';
      closer = verbatim;
    } else if (verbatim || HTML_BLOCK.test(line)) mode = 'html';
    type = !mode && isTag(s) ? typeSpan(recs, i) : null;
    if (type) {
      flush();
      raw(r);
      continue;
    }
    // A line that's a construct on its own isn't a list item, even if it
    // starts like one, as `- - -` does.  The line above an underline is kept,
    // even a tag's, which doesn't make it a heading or a table's header, since
    // otherwise a tag's wrapped last line would be read that way next time.
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
      if (cur && cur.recs.length > 1 && !cur.tag && !cur.bullet) {
        /**
         * @type {Para}
         */
        const above = cur;
        if (
          isLabel(plainOf(above.recs[above.recs.length - 1].content).trim())
        ) {
          const label = {
            parts: above.parts.splice(-1),
            recs: above.recs.splice(-1),
          };
          flush();
          cur = { type: 'para', tag: false, ...label };
        }
      }
      flush();
      run = started;
      mode = 'preformatted';
      raw(r);
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
 * @param {string[]} parts - a paragraph's lines' text
 * @returns {number} how many of them run through the first that ends in
 *                   a hard break, or all of them if none but perhaps
 *                   the last does.  A line that ends inside a span, as a code
 *                   span that goes on to the next line, doesn't end in one.
 */
function throughBreak(parts) {
  const masked = mask(parts.join(' '));
  let at = -1;
  const cut = parts.findIndex((p) => {
    at += p.length + 1;
    return HARD_BREAK.test(p) && masked[at] === ' ';
  });
  return cut < 0 ? parts.length : cut + 1;
}

/**
 * Splits a paragraph into units (glued runs of tokens), then fills each line
 * greedily with as many units as fit.  A break that breaks a rule moves
 * earlier, one unit at a time, until it doesn't.  The rules that `limits`
 * turns off don't glue tokens or move breaks.  With `limits.widows`, the last
 * break may then move earlier too, so the last line isn't too short
 * (see `widowless`).  The text after a line that ends in a hard break is
 * filled on its own, under what comes before it, so the break stays.
 *
 * @param {{ tag: boolean, parts: string[], typed?: string }} item -
 *   the paragraph
 * @param {string} firstPrefix - what starts its first line
 * @param {string} contPrefix - what starts each later line, before a tag's
 *                              hanging indent
 * @param {number} width - the widest a line may be
 * @param {Limits} limits - the limits on where a line may break
 * @param {1 | 2} [spaces] - how many spaces follow a sentence end or a colon
 * @returns {string[]} the lines, each already prefixed
 */
function fillPara(item, firstPrefix, contPrefix, width, limits, spaces) {
  // The lines are joined with one space, so a line break never counts as two
  // spaces after a token.  wide[k] is whether tokens[k] is wide.  The
  // whitespace inside a masked span doesn't count, and it stays as it is in
  // the tokens, so a code span's text never changes.  The whitespace between
  // tokens becomes plain spaces.  Words that no space belongs between
  // (see `tight`) are joined into one token, dropping the gap between them.
  const cut = throughBreak(item.parts);
  const later = item.parts.slice(cut);
  const text = mask(item.parts.slice(0, cut).join(' '))
    .replace(/\s/g, ' ')
    .trim();
  const words = text.split(/ +/);
  const gaps = (text.match(/ +/g) ?? []).map((gap) => wideIn(gap, spaces));
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
  const sep = tokens.map((t, k) => sepAfter(t, tokens[k + 1], wide[k], spaces));
  // One space goes before a tag's `-`, whatever the word before it ends in.
  const dash = item.tag ? separatorOf(tokens, item.typed) : -1;
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

  const head = item.tag ? headSize(tokens, item.typed) : 0;

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

  /**
   * The lines of the text after a hard break, if any.
   *
   * @type {(prefix: string) => string[]}
   */
  const after = (prefix) =>
    later.length
      ? fillPara(
          { tag: false, parts: later },
          prefix,
          prefix,
          width,
          limits,
          spaces,
        )
      : [];

  // A head wider than `MAX_HEAD` takes a line of its own unless the whole tag
  // fits on one, and its description is filled below it as a paragraph.
  // The description keeps the spaces `sep` gives it, so its sentence ends
  // stay where they are.  A description that would read as a block construct
  // if it started a line stays on the head's line, and so does one after
  // a head that would read as ending in a hard break.
  const oneLine =
    firstPrefix.length + col[n - 1] + tokens[n - 1].length <=
    room(tokens[n - 1]);
  if (
    head < n &&
    col[head] > MAX_HEAD &&
    !oneLine &&
    !NO_START.test(tokens[head]) &&
    !HARD_BREAK.test(tokens[head - 1])
  ) {
    const below = `${contPrefix}  `;
    const desc = { tag: false, parts: [unmask(textOf(head, n - 1))] };
    return [
      unmask(firstPrefix + textOf(0, head - 1)),
      ...fillPara(desc, below, below, width, limits, spaces),
      ...after(below),
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
    // A token that would read as a tag or a block construct at the start of
    // a line never starts one (see `NO_START`).
    if (NO_START.test(next)) return true;
    // A token that ends in a hard break, inside a line, never ends one, where
    // it would become a real break.
    if (HARD_BREAK.test(t)) return true;
    // A paragraph's first line never ends where it would read as a construct
    // that's only one if it's the whole line, as `--- then` would at `---`.
    if (OWN_LINE.test(textOf(0, k)) || POINTER.test(textOf(0, k))) return true;
    // An abbreviation that ends a sentence only because two spaces follow it,
    // as in `Elm St.  Then`, is glued to the next word.  At a line break,
    // those two spaces would be lost, and the sentence end with them.  With
    // `spaces` at 1, no token is wide, so this never applies.
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

  // A tag's later lines hang at its description's column.  A description may
  // start only after a hard break, past the head.
  contPrefix += ' '.repeat(hangOf(head < n ? col[head] : full.length));

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
  return [
    ...widowless(lenient(0)).map(([a, b], i) => {
      const prefix = i === 0 ? firstPrefix : contPrefix;
      return unmask(prefix + textOf(...range(a, b)));
    }),
    ...after(contPrefix),
  ];
}

/**
 * @param {Item[]} items - a block's items, from `parseItems`
 * @param {string} indent - what precedes the block's `/**` on its line
 * @param {number} width - the widest a line may be
 * @param {Limits} limits - the limits on where a line may break
 * @param {1 | 2} [spaces] - how many spaces follow a sentence end or a colon
 * @returns {string[]} the block's body lines
 */
function renderItems(items, indent, width, limits, spaces) {
  const pre = `${indent} * `;
  return items.flatMap((it) => {
    if (it.type === 'blank') return `${indent} *`;
    if (it.type === 'raw') return it.raw;
    const hang = it.bullet ? hangPrefix(it.bullet, indent) : pre;
    // The line that closes a multi-line `{Type}` keeps its own prefix.
    const [{ raw, offset }] = it.recs;
    const first = it.typed ? raw.slice(0, offset) : hang;
    return fillPara(it, first, hang, width, limits, spaces);
  });
}

/**
 * Whether a block has a line that begins with one of some tags, which makes
 * the rules leave the whole block as it is.  The parser finds those lines,
 * so a tag in a fence or other code isn't one.  Nor is a word later in
 * a paragraph, and a wrap never moves a word starting with `@` to the start
 * of a line (see `NO_START`), so fixing a block doesn't make it verbatim.
 * A line is read as `no-exotic-whitespace` would leave it, as in `leadingTag`,
 * so fixing a zero-width space before a tag doesn't either.  A block whose
 * form these rules don't handle has no lines to check, since they skip it
 * anyway, unless it's on one line, which `single-line` spreads out
 * whatever its form.
 *
 * @param {string} text - the block, from its `/**` to its `*\/`
 * @param {string} indent - the whitespace before the block on its line
 * @param {Set<string>} names - the tags' names, without their `@`s
 * @param {BlockOptions} [options] - how to read and space the block
 * @returns {boolean} whether a line of the block begins with one of them
 */
export function hasVerbatimTag(text, indent, names, { preformatted } = {}) {
  const tags = text.includes('\n')
    ? parseItems(parseBlock(text, indent)?.recs ?? [], preformatted).flatMap(
        (it) =>
          it.type === 'raw'
            ? it.tag
            : it.recs.map((r) => leadingTag(r.content)),
      )
    : [leadingTag(text.slice(3, -2))];
  return tags.some((tag) => !!tag && names.has(tag));
}

/**
 * Reflows one JSDoc block.  A block on one line stays on one line if its text
 * fits, ` *\/ ` included, or if it's a `@ts-*` directive (see `isDirective`),
 * and expands otherwise.  A longer block keeps its first and last lines,
 * and its body is laid out again.
 *
 * @param {string} text - the block, from its `/**` to its `*\/`
 * @param {string} indent - the whitespace before the block on its line
 * @param {number} [nominal] - the nominal width of a line, prefix included,
 *                             from which the working width is derived
 *                             (see `MARGIN`)
 * @param {ReflowOptions} [options] - the limits on where a line may break to
 *                                    turn off, and how to read and
 *                                    space the block
 * @returns {string | null} the reflowed block, or null if its form isn't one
 *                          this handles (text after `/**` on a line of its
 *                          own, a body line without a leading `*`, or text
 *                          before the closing `*\/`)
 */
export function reflowComment(text, indent, nominal = WIDTH, options = {}) {
  const block = parseBlock(text, indent);
  if (!block) return null;
  const width = nominal - MARGIN;
  const limits = limitsOf(options);
  const { spaces } = options;
  const { lines, recs } = block;
  const items = parseItems(recs, options.preformatted);
  const one = lines.length === 1;
  // Keep a one-liner on one line when its text fits (` */` is 3 columns),
  // and a directive however wide it is.
  if (one && items.length === 1 && items[0].type === 'para') {
    const room = isDirective(recs[0].content) ? Infinity : width;
    const l = fillPara(
      items[0],
      `${indent}/** `,
      `${indent} * `,
      room - 3,
      limits,
      spaces,
    );
    if (l.length === 1 && l[0].length + 3 <= room) {
      return `${l[0]} */`.slice(indent.length);
    }
  }
  // A one-liner that doesn't fit is expanded.  A longer block keeps its first
  // and last lines.
  const open = one ? `${indent}/**` : lines[0];
  const close = one ? `${indent} */` : lines.at(-1);
  return [open, ...renderItems(items, indent, width, limits, spaces), close]
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
 *   prefix, as it would be on a line of its own.  The extra whitespace before
 *   a tag there is the block's edge, not the indentation of code.
 */
function parseBlock(text, indent) {
  if (/[\r\u2028\u2029]/.test(text)) return null;
  const lines = `${indent}${text}`.split('\n');
  if (lines.length === 1) {
    const one = lines[0].match(/^(\s*\/\*\*\s(?:\s+(?=@))?)(.+?)\s*\*\/\s*$/);
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
 * @param {BlockOptions} [options] - how to read and space the block
 * @returns {Alignment[]} for each such line, an `Edit` that replaces its
 *                        prefix, from column 0 to its text, with the aligned
 *                        prefix, and the `column` that prefix ends at
 */
export function misaligned(text, indent, { preformatted, spaces } = {}) {
  const pre = `${indent} * `;
  const out = [];
  for (const it of parseItems(
    parseBlock(text, indent)?.recs ?? [],
    preformatted,
  )) {
    if (it.type !== 'para' || !it.tag) continue;
    if (!it.typed && !it.recs[0].raw.startsWith(pre + '@')) continue;
    const line = mask(it.recs[0].content);
    const words = line.match(/\S+/g) ?? [];
    const gaps = line.match(/\s+/g) ?? [];
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
 * @param {BlockOptions} [options] - how to read and space the block
 * @returns {string} the block, with its tag continuation lines aligned
 */
export function alignTags(text, indent, options) {
  return applyEdits(text, indent, misaligned(text, indent, options));
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
 * @param {BlockOptions} [options] - how to read and space the block
 * @returns {Alignment[]} for each such line, an `Edit` that replaces its
 *                        prefix, from column 0 to its text, with the aligned
 *                        prefix, and the `column` that prefix ends at
 */
export function mishung(text, indent, { preformatted } = {}) {
  const out = [];
  for (const it of parseItems(
    parseBlock(text, indent)?.recs ?? [],
    preformatted,
  )) {
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
 * @param {BlockOptions} [options] - how to read and space the block
 * @returns {string} the block, with its list items' wrapped lines aligned
 */
export function alignBullets(text, indent, options) {
  return applyEdits(text, indent, mishung(text, indent, options));
}

/**
 * Finds the gaps between words on a line that aren't the space reflow puts
 * there:  two after a sentence end or a colon, unless `spaces` is `1`,
 * and one otherwise.  With two spaces, a gap of two or more spaces after `.`,
 * `!` or `?` makes a sentence end (see `endsSentence`), so it should be two.
 * Only the text reflow modifies is checked, so lists, tables, code,
 * `@example` and multi-line `{Type}`s are skipped, and so are the spaces
 * inside code spans, links, `{...}` and `[...]`.  Indentation and trailing
 * whitespace are left to the other rules, and so is what a gap is made of
 * (see `exoticSpaces`), since only its width is checked.
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
 * With `spaces` at `1`, a gap's kind depends only on those tokens, since no
 * token is wide (see `wideIn`).  A gap that's too wide after a sentence end
 * or a colon is still `sentence` or `colon`, so `word-spacing` leaves
 * it alone.  Two spaces after an abbreviation that the sentence goes on past
 * are `word`, since they can't show that a sentence ended.
 *
 * @param {string} text - the block, from its `/**` to its `*\/`
 * @param {string} indent - the whitespace before the block on its line
 * @param {BlockOptions} [options] - how to read and space the block
 * @returns {Finding[]} for each such gap, a `Finding` whose span runs from
 *                      the start of the word before it to the end of the word
 *                      after it, whose edit replaces it with the space it
 *                      should be, and whose `kind` is `sentence`, `colon`,
 *                      `word` or `tag`
 */
export function misspaced(text, indent, { preformatted, spaces } = {}) {
  /**
   * @type {Finding[]}
   */
  const out = [];
  for (const it of parseItems(
    parseBlock(text, indent)?.recs ?? [],
    preformatted,
  )) {
    if (it.type !== 'para') continue;
    const words = placeParaWords(it);
    const whole = wholeWords(words.map((w) => w.word));
    const dash = separatorOf(
      words.map((w) => w.word),
      it.typed,
    );
    words.slice(1).forEach((b, k) => {
      const a = words[k];
      if (a.at !== b.at || tight(a.word, b.word)) return;
      const wide = wideIn(b.gap, spaces);
      const tag = dash > 0 && (k === dash - 1 || k === dash);
      const space = tag ? ' ' : sepAfter(whole[k], whole[k + 1], wide, spaces);
      // A gap of the right width is left as it is, even if it's a tab, which
      // `exoticSpaces` finds.
      if (b.gap.length === space.length) return;
      const ends = endsSentence(whole[k], whole[k + 1], wide);
      let kind = ends ? 'sentence' : endsColon(whole[k]) ? 'colon' : 'word';
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
 * @param {BlockOptions} [options] - how to read and space the block
 * @returns {Finding[]} for each such gap, a `Finding` of `kind` `punctuation`
 *                      whose span runs from the start of the word before it
 *                      to the end of the word after it, and whose
 *                      edit removes it
 */
export function mispunctuated(text, indent, { preformatted } = {}) {
  /**
   * @type {Finding[]}
   */
  const out = [];
  for (const it of parseItems(
    parseBlock(text, indent)?.recs ?? [],
    preformatted,
  )) {
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
 * @param {BlockOptions} [options] - how to read and space the block
 * @returns {string} the block, with no space before `, . ; : ) ]` or after
 *                   `(` and `[` on a line
 */
export function fixPunctuation(text, indent, options) {
  return applyEdits(text, indent, mispunctuated(text, indent, options));
}

/**
 * Finds the list items whose marker (`-`, `*`, `+`, or a number and `.`
 * or `)`) isn't followed by exactly one space, as when two spaces follow it.
 * Only that gap's width is checked, so a tab there is left to `exoticSpaces`.
 * The indentation before the marker, which nests a list, is the author's,
 * and the item's line is otherwise kept as it is, as reflow keeps it.
 * Since the spacing rules skip that line, a number's `.` there is never taken
 * for a sentence end.  A word always follows the gap, so a line keeps being
 * a list item when it's fixed, and the fix changes no other rule's findings.
 *
 * @param {string} text - the block, from its `/**` to its `*\/`
 * @param {string} indent - the whitespace before the block on its line
 * @param {BlockOptions} [options] - how to read and space the block
 * @returns {Finding[]} for each such item, a `Finding` of `kind` `bullet`
 *                      whose span runs from the start of its marker to
 *                      the end of the word after it, and whose edit leaves
 *                      one space between them
 */
export function misbulleted(text, indent, { preformatted } = {}) {
  /**
   * @type {Finding[]}
   */
  const out = [];
  for (const it of parseItems(
    parseBlock(text, indent)?.recs ?? [],
    preformatted,
  )) {
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
 * HTML blocks, indented code and `@example` are skipped, since a tab may
 * belong there, but code spans aren't, since reflow joins their words with
 * plain spaces.
 *
 * Each such character becomes one space, so the fix changes no gap's width,
 * and the spacing and edge rules, which check only widths, find the same gaps
 * before and after it.  A zero-width space inside a word converts to a space,
 * creating two words.
 *
 * @param {string} text - the block, from its `/**` to its `*\/`
 * @param {string} indent - the whitespace before the block on its line
 * @param {BlockOptions} [options] - how to read and space the block
 * @returns {Finding[]} for each run of whitespace with such a character in it,
 *                      a `Finding` of `kind` `exotic` whose span runs from
 *                      the start of the word (or `*`) before it to the end of
 *                      the word (or `*\/`) after it, and whose edit makes
 *                      each of its exotic spaces a plain space
 */
export function exoticSpaces(text, indent, { preformatted } = {}) {
  const block = parseBlock(text, indent);
  if (!block) return [];
  const { lines } = block;
  const one = lines.length === 1;
  // The lines whose text is checked:  every body line but code.
  const checked = parseItems(block.recs, preformatted).flatMap((it) => {
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
 * @param {BlockOptions} [options] - how to read and space the block
 * @returns {string} the block, with the whitespace in its text made of
 *                   plain spaces
 */
export function fixWhitespace(text, indent, options) {
  return applyEdits(text, indent, exoticSpaces(text, indent, options));
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
 * @param {BlockOptions} [options] - how to read and space the block
 * @returns {string} the block, with the gaps between its words spaced
 */
export function fixSpacing(text, indent, options) {
  return applyEdits(text, indent, misspaced(text, indent, options));
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
 * closing lines and the lines reflow keeps verbatim (lists, code,
 * multi-line `{Type}`s and the like).  It also leaves the indentation of
 * a tag's continuation lines to `tag-align`, and of a list item's wrapped
 * lines to `bullet-align`.  Each kind fixes a different part of a line,
 * so the edge rules are independent, like the spacing rules.  The whitespace
 * before the text is checked by its width, so a tab there is left
 * to `exoticSpaces`.
 *
 * @param {string} text - the block, from its `/**` to its `*\/`
 * @param {string} indent - the whitespace before the block on its line
 * @param {BlockOptions} [options] - how to read and space the block
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
export function misedged(text, indent, { preformatted } = {}) {
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
  for (const it of parseItems(block.recs, preformatted)) {
    if (it.type === 'raw') continue;
    it.recs.forEach((r, i) => {
      const { at, raw: l } = r;
      // The `*`, then the words.
      const words = [...l.matchAll(/\S+/g)];
      const [star, first = star] = words;
      const last = words[words.length - 1];
      // A tag's continuation lines and a list item's wrapped lines are
      // indented by `tag-align` and `bullet-align`, and the line that closes
      // a multi-line `{Type}` keeps its prefix.
      if (
        it.type === 'blank' ||
        (!it.bullet && !it.typed && (!it.tag || i === 0))
      ) {
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
 * @param {BlockOptions} [options] - how to read and space the block
 * @returns {string} the block, with the whitespace at its lines' edges fixed
 */
export function fixEdges(text, indent, options) {
  return applyEdits(text, indent, misedged(text, indent, options));
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
