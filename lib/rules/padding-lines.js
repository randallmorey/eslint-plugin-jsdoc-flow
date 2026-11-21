import { padBlanks, unpadded } from '../flow.js';
import { blockFix, blockRule, locOf, toEol } from './block.js';

/**
 * The `jsdoc-flow/padding-lines` rule.
 */
export default blockRule(
  {
    docs: {
      description:
        'Require a blank line before and after a fenced code block, ' +
        'a heading, and a table in a JSDoc block',
    },
    messages: {
      before: 'A JSDoc {{what}} should have a blank line before it.',
      after: 'A JSDoc {{what}} should have a blank line after it.',
    },
  },
  (context) => {
    const eol = toEol(context.sourceCode);
    /**
     * Reports each place that needs a blank line (see `unpadded`) on its own,
     * on the line of the construct it sets off.  Each fix adds just its line,
     * so other rules' fixes to the block can be made in the same pass,
     * unless some place needs lines moved left too, when each fix replaces
     * the whole block with all of them made.  None is fixed if making them
     * all isn't safe as a reflow (see `blockFix`).  The fix is written with
     * the file's line ending.
     *
     * @type {import('./block.js').OnBlock}
     */
    return (comment, text, indent, options) => {
      const places = unpadded(text, indent, options);
      if (!places.length) return [];
      const fixed = padBlanks(text, indent, options);
      const whole = blockFix(eol, comment, text, fixed, indent, options);
      const lines = `${indent}${text}`.split('\n');
      // The text has LF line breaks, and the comment as written has CRLF ones
      // if they're all CRLF (see `eachBlock`).
      const size = comment.value.includes('\r\n') ? 2 : 1;
      const starts = [comment.range[0] - indent.length];
      for (const l of lines) {
        starts.push(starts[starts.length - 1] + l.length + size);
      }
      const blank = eol(`${indent} *\n`);
      const moves = places.some((p) => p.moves);
      return places.map(({ at, line, side, what }) => {
        const l = lines[line];
        const from = l.length - l.replace(/^\s*\*[\s\u200b]*/, '').length;
        /**
         * @type {import('eslint').Rule.ReportFixer}
         */
        const add = (fixer) =>
          fixer.replaceTextRange([starts[at], starts[at]], blank);
        return {
          loc: locOf(
            comment,
            { at: line, column: from },
            { at: line, column: l.trimEnd().length },
          ),
          messageId: side,
          data: { what },
          fix: moves ? whole : whole && add,
        };
      });
    };
  },
);
