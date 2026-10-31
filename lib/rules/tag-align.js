import { misaligned } from '../flow.js';
import { blockRule, fixOf, locOf } from './block.js';

/**
 * The `jsdoc-flow/tag-align` rule.
 */
export default blockRule(
  {
    docs: {
      description:
        "Require a JSDoc tag's continuation lines to start at its " +
        "description's column",
    },
    messages: {
      align:
        "A JSDoc tag's continuation lines should start under its " +
        'description, at column {{column}}.',
    },
  },
  (context) =>
    /**
     * Reports each misaligned line on its own, and fixes it by changing only
     * its indentation, so no word moves to another line.  The highlight runs
     * to the end of the line's text.  It starts where the text starts if
     * that's left of the column, or at the column if the text starts right of
     * it, so the extra whitespace is highlighted too.
     *
     * @type {import('./block.js').OnBlock}
     */
    (comment, text, indent) => {
      for (const edit of misaligned(text, indent)) {
        const { at, end: cut, column } = edit;
        const line = comment.loc.start.line + at;
        const start = Math.min(cut, column);
        const end = context.sourceCode.lines[line - 1].trimEnd().length;
        context.report({
          loc: locOf(comment, { at, column: start }, { at, column: end }),
          messageId: 'align',
          data: { column: column + 1 },
          fix: fixOf(context.sourceCode, comment, edit),
        });
      }
    },
);
