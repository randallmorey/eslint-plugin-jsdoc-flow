import { dropBlanks, extraBlanks } from '../flow.js';
import { blockFix, blockRule, locOf, toEol } from './block.js';

/**
 * The `jsdoc-flow/no-extra-blank-lines` rule.
 */
export default blockRule(
  {
    docs: {
      description:
        'Disallow blank lines at the start or end of a JSDoc block, and ' +
        'more than one in a row',
    },
    messages: {
      extra:
        'JSDoc blocks should not have a blank line right after `/**`, ' +
        'right before `*/`, or right after another blank line.',
    },
  },
  (context) => {
    const eol = toEol(context.sourceCode);
    /**
     * Reports each extra blank line of a block (see `extraBlanks`) on its own,
     * from its `*` to its end, and fixes them all at once by dropping them,
     * which can't be done line by line, since the edits would cross
     * line breaks.  `reflow` keeps every blank line, so the two settle on
     * the same block in any order.  A fix that isn't safe as a reflow
     * (see `safeReflow`) is dropped.  The fix is written with the file's
     * line ending.
     *
     * @type {import('./block.js').OnBlock}
     */
    return (comment, text, indent, options) => {
      const extra = extraBlanks(text, indent, options);
      if (!extra.length) return [];
      const fixed = dropBlanks(text, indent, options);
      const fix = blockFix(eol, comment, text, fixed, indent, options);
      const lines = text.split('\n');
      return extra.map((at) => ({
        loc: locOf(
          comment,
          { at, column: lines[at].indexOf('*') },
          { at, column: lines[at].length },
        ),
        messageId: 'extra',
        fix,
      }));
    };
  },
);
