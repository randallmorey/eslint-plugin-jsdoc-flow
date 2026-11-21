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
     * from its `*` to its end.  Each run of them is fixed by dropping it with
     * the line break before it, so other rules' fixes to the block's other
     * lines can be made in the same pass, and a run's lines share their fix.
     * `reflow` keeps every blank line, so the two settle on the same block in
     * any order.  None is fixed if dropping them all isn't safe as a reflow
     * (see `blockFix`).
     *
     * @type {import('./block.js').OnBlock}
     */
    return (comment, text, indent, options) => {
      const extra = extraBlanks(text, indent, options);
      if (!extra.length) return [];
      const fixed = dropBlanks(text, indent, options);
      const safe = !!blockFix(eol, comment, text, fixed, indent, options);
      const lines = text.split('\n');
      // The text has LF line breaks, and the comment as written has CRLF ones
      // if they're all CRLF (see `eachBlock`).
      const size = comment.value.includes('\r\n') ? 2 : 1;
      // Where each line's line break is, and the one before the first line
      // would be.
      const ends = [comment.range[0] - indent.length - size];
      for (const l of `${indent}${text}`.split('\n')) {
        ends.push(ends[ends.length - 1] + l.length + size);
      }
      /**
       * @type {[number, number][]}
       */
      const runs = [];
      for (const at of extra) {
        const run = runs[runs.length - 1];
        if (run && run[1] === at - 1) run[1] = at;
        else runs.push([at, at]);
      }
      /**
       * @type {Map<number, import('eslint').Rule.ReportFixer>}
       */
      const fixes = new Map();
      for (const [first, last] of runs) {
        /**
         * @type {import('eslint').Rule.ReportFixer}
         */
        const fix = (fixer) =>
          fixer.replaceTextRange([ends[first], ends[last + 1]], '');
        for (let at = first; at <= last; at++) fixes.set(at, fix);
      }
      return extra.map((at) => ({
        loc: locOf(
          comment,
          { at, column: lines[at].indexOf('*') },
          { at, column: lines[at].length },
        ),
        messageId: 'extra',
        fix: safe ? fixes.get(at) : null,
      }));
    };
  },
);
