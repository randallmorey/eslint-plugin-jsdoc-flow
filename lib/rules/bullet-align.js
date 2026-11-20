import { mishung } from '../flow.js';
import { blockRule, fixesOf, locOf } from './block.js';

/**
 * The `jsdoc-flow/bullet-align` rule.
 */
export default blockRule(
  {
    docs: {
      description:
        "Require a JSDoc list item's wrapped lines to start under its text",
    },
    messages: {
      align:
        "A list item's wrapped lines should start under its text, at " +
        'column {{column}}.',
    },
  },
  () =>
    /**
     * Reports each misaligned line on its own, and fixes it by changing only
     * its indentation, as `tag-align` does, so no word moves to another line.
     * The highlight runs to the end of the line's text, from where the text
     * starts or from the column, whichever is further left.
     *
     * @type {import('./block.js').OnBlock}
     */
    (comment, text, indent, options) => {
      const edits = mishung(text, indent, options);
      const fixes = fixesOf(comment, text, indent, options, edits);
      const lines = `${indent}${text}`.split('\n');
      return edits.map((edit, k) => {
        const { at, end: cut, column } = edit;
        const start = Math.min(cut, column);
        const end = lines[at].trimEnd().length;
        return {
          loc: locOf(comment, { at, column: start }, { at, column: end }),
          messageId: 'align',
          data: { column: column + 1 },
          fix: fixes[k],
        };
      });
    },
);
