import { looseBlanks, tightenLists } from '../flow.js';
import { blockFix, blockRule, dropFixes, locOf, toEol } from './block.js';

/**
 * The `jsdoc-flow/list-spacing` rule.
 */
export default blockRule(
  {
    docs: {
      description:
        'Disallow blank lines between the items of a JSDoc list, which ' +
        'make it render loose',
    },
    messages: {
      loose:
        'A list should be tight:  a blank line between its items makes ' +
        'every item render as a paragraph.',
    },
  },
  (context) => {
    const eol = toEol(context.sourceCode);
    /**
     * Reports the first blank line between two items of a list
     * (see `looseBlanks`), from its `*` to its end,
     * since `no-extra-blank-lines` reports the others.  The fix drops them
     * all (see `dropFixes`), so a list is tight after one pass of this
     * rule alone.  None is fixed if dropping all of the block's isn't safe as
     * a reflow (see `blockFix`).
     *
     * @type {import('./block.js').OnBlock}
     */
    return (comment, text, indent, options) => {
      const gaps = looseBlanks(text, indent, options);
      if (!gaps.length) return [];
      const fixed = tightenLists(text, indent, options);
      const safe = !!blockFix(eol, comment, text, fixed, indent, options);
      const fixes = dropFixes(comment, text, indent, gaps.flat());
      const lines = text.split('\n');
      return gaps.map(([at]) => ({
        loc: locOf(
          comment,
          { at, column: lines[at].indexOf('*') },
          { at, column: lines[at].length },
        ),
        messageId: 'loose',
        fix: safe ? fixes.get(at) : null,
      }));
    };
  },
);
