import { misindented } from '../flow.js';
import { blockRule, fixesOf, locOf } from './block.js';

/**
 * The `jsdoc-flow/bullet-indent` rule.
 */
export default blockRule(
  {
    docs: {
      description:
        'Require the items at the same level of a JSDoc list to start at ' +
        'the same column',
    },
    messages: {
      indent:
        'A list item should start in line with the other items at its ' +
        'level, at column {{column}}.',
    },
  },
  () =>
    /**
     * Reports each misplaced item on its own, and fixes it by changing only
     * its line's prefix, so it renders as the same list.  Its wrapped lines
     * are left to `bullet-align`, which hangs them under the item where it
     * moves to.  The highlight runs to the end of the line's text, from where
     * the marker starts or from the column, whichever is further left.
     *
     * @type {import('./block.js').OnBlock}
     */
    (comment, text, indent, options) => {
      const edits = misindented(text, indent, options);
      const fixes = fixesOf(comment, text, indent, options, edits);
      const lines = `${indent}${text}`.split('\n');
      return edits.map((edit, k) => {
        const { at, end: cut, column } = edit;
        const start = Math.min(cut, column);
        const end = lines[at].trimEnd().length;
        return {
          loc: locOf(comment, { at, column: start }, { at, column: end }),
          messageId: 'indent',
          data: { column: column + 1 },
          fix: fixes[k],
        };
      });
    },
);
