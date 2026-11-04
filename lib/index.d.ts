import type { ESLint, Linter, Rule } from 'eslint';

declare const plugin: ESLint.Plugin & {
  meta: { name: string; version: string };
  rules: {
    reflow: Rule.RuleModule;
    'sentence-spacing': Rule.RuleModule;
    'colon-spacing': Rule.RuleModule;
    'word-spacing': Rule.RuleModule;
    'no-extra-punctuation-space': Rule.RuleModule;
    'tag-spacing': Rule.RuleModule;
    'bullet-spacing': Rule.RuleModule;
    'no-exotic-whitespace': Rule.RuleModule;
    'star-align': Rule.RuleModule;
    'text-indent': Rule.RuleModule;
    'no-trailing-space': Rule.RuleModule;
    'tag-align': Rule.RuleModule;
    'bullet-align': Rule.RuleModule;
    'single-line': Rule.RuleModule;
  };
  configs: { recommended: Linter.Config };
};

export default plugin;

/**
 * How the exported functions read and space a block.  Neither is an option of
 * a rule, since the rules take both from the shared settings, so that they
 * all agree.
 */
export interface BlockOptions {
  /**
   * Whether what looks like unfenced code or a diagram is kept as it is, which
   * it is unless set to `false`.
   */
  preformatted?: boolean;
  /**
   * How many spaces follow a sentence end or a colon on a line, `2` unless
   * set.  With `2`, two spaces after an abbreviation can show that a sentence
   * ended, and with `1`, they can't.  `fixEdges` spaces no such gap, so it
   * ignores this.
   */
  spaces?: 1 | 2;
}

/**
 * The limits on where a line may break that `reflowComment` and the `reflow`
 * rule can turn on or off.  Each is on unless set to `false`, except
 * `widows`, which is `0.15` unless set, and off at `0`, and `maxHead`, which
 * is `0.55` unless set, and which the rule takes from the shared settings.
 * `reflowComment` also takes the `BlockOptions`.
 */
export interface ReflowOptions extends BlockOptions {
  /**
   * Whether a sentence's first two and last two words stay together
   * (`sentence`), a single word after `, ; :` may not end a line or be a line
   * alone (`clause`), and the first and last words inside parentheses stay
   * with their neighbors (`paren`).
   */
  orphans?: { sentence?: boolean; clause?: boolean; paren?: boolean };
  /**
   * Whether an abbreviation beside a name stays with it, as in `Mr. Smith`.
   */
  names?: boolean;
  /**
   * Whether `a`, `an`, `the` and one-letter words such as `I` stay with the
   * word after them, so they never end a line.
   */
  shortWords?: boolean;
  /**
   * Whether a line may go one column past the width when its last character
   * is closing punctuation:  `. , ; : ! ? ) ]` or a closing quote.
   */
  hang?: boolean;
  /**
   * The shortest a paragraph's last line's text may be, as a fraction of the
   * width from `0` to `1`.  Words move down from the line before it until it's
   * long enough, but never so far that it ends right of that line.
   */
  widows?: number;
  /**
   * The widest a tag's head may be and still have its description begin beside
   * it, as a fraction of the width from `0` to `1`.  A wider head takes a line
   * of its own, unless the whole tag fits on one.
   */
  maxHead?: number;
}

/**
 * How `alignTags` reads and spaces a block, and which heads are wide, which
 * must match what `reflowComment` is given for the two to agree.  The rules
 * take these from the shared settings, so that they always do.
 */
export interface AlignOptions extends BlockOptions {
  /**
   * The width that `maxHead` is a fraction of, `80` unless set.
   */
  width?: number;
  /**
   * The widest a tag's head may be and still have its later lines hang under
   * its description, as a fraction of the width from `0` to `1`, `0.55` unless
   * set.
   */
  maxHead?: number;
}

/**
 * Reflows one JSDoc block.
 *
 * @param text - the block, from its `/**` to its `*\/`
 * @param indent - the whitespace before the block on its line
 * @param width - the widest a line may be, prefix included (default 80)
 * @param options - the limits on where a line may break to turn off, and how
 *   to read and space the block
 * @returns the reflowed block, or null if its form isn't one this handles
 */
export function reflowComment(
  text: string,
  indent: string,
  width?: number,
  options?: ReflowOptions,
): string | null;

/**
 * @param text - the block, from its `/**` to its `*\/`
 * @param indent - the whitespace before the block on its line
 * @param options - how to read and space the block, and which heads are wide
 * @returns the block, with its tag continuation lines aligned
 */
export function alignTags(
  text: string,
  indent: string,
  options?: AlignOptions,
): string;

/**
 * @param text - the block, from its `/**` to its `*\/`
 * @param indent - the whitespace before the block on its line
 * @param options - how to read and space the block
 * @returns the block, with two spaces after each sentence end or colon
 *   followed by more text on its line, or one if `options.spaces` is `1`,
 *   one on either side of a tag's `-`,
 *   and one between other words, except that the spaces before
 *   `, . ; : ) ]` and after `( [` are left as they are, and so is a gap
 *   that's already as wide as it should be, even if it's a tab
 */
export function fixSpacing(
  text: string,
  indent: string,
  options?: BlockOptions,
): string;

/**
 * @param text - the block, from its `/**` to its `*\/`
 * @param indent - the whitespace before the block on its line
 * @param options - how to read and space the block
 * @returns the block, with the whitespace at its lines' edges fixed:  each
 *   `*` under the `/**`, one space between it and the text, and no
 *   whitespace after the text
 */
export function fixEdges(
  text: string,
  indent: string,
  options?: BlockOptions,
): string;
