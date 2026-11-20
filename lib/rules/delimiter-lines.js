import { delimiterText, safeSpread, spreadDelimiters } from '../flow.js';
import { blockRule, locOf } from './block.js';

/**
 * The `jsdoc-flow/delimiter-lines` rule.
 */
export default blockRule(
  {
    docs: {
      description:
        'Require the `/**` and `*/` of a multi-line JSDoc block to be on ' +
        'lines of their own',
    },
    messages: {
      opening:
        'JSDoc text should not be on the `/**` line:  move it to a line of ' +
        'its own.',
      closing:
        'JSDoc text should not be on the `*/` line:  move the `*/` to a line ' +
        'of its own.',
    },
  },
  () =>
    /**
     * Reports the text on each delimiter line of a multi-line block
     * (see `delimiterText`), and fixes each by spreading its delimiter onto
     * a line of its own (see `spreadDelimiters`):  a line break goes right
     * after the `/**`, or in place of the whitespace before the `*\/`.
     * The fixes change no other part of the block, so other rules' fixes to
     * it can be made in the same pass.  It reads each block as it's written,
     * unlike the other rules, which read such a block as it will be once
     * spread (see `eachBlock`).  A block that still isn't one the rules
     * handle once spread (see `safeSpread`), as when a line has no `*`,
     * is skipped, as every rule skips it:  adding a `*` would change more
     * than whitespace, and it's `jsdoc/require-asterisk-prefix`'s to report.
     * A line break is written as the block's own.
     *
     * @type {import('./block.js').OnBlock}
     */
    (comment, text, indent) => {
      const fixed = spreadDelimiters(text, indent);
      if (fixed === null || !safeSpread(text, fixed, indent)) return [];
      const eol = comment.value.includes('\r\n') ? '\r\n' : '\n';
      const last = text.length - text.lastIndexOf('\n') - 1;
      const [start, end] = comment.range;
      /**
       * @type {(kind: string, to: import('../flow.js').Place) => import('eslint').Rule.ReportFixer}
       */
      const fixOf = (kind, to) =>
        kind === 'opening'
          ? (fixer) =>
              fixer.insertTextAfterRange(
                [start, start + 3],
                `${eol}${indent} *${/^\s/.test(text.slice(3)) ? '' : ' '}`,
              )
          : (fixer) =>
              fixer.replaceTextRange(
                [end - (last - to.column), end - 2],
                `${eol}${indent} `,
              );
      return delimiterText(text, indent).map(({ kind, from, to }) => ({
        loc: locOf(comment, from, to),
        messageId: kind,
        fix: fixOf(kind, to),
      }));
    },
  { asWritten: true },
);
