import { misnested } from '../flow.js';
import { blockRule, fixesOf, linesFix, locOf, toEol } from './block.js';

/**
 * The `jsdoc-flow/list-nesting` rule.
 */
export default blockRule(
  {
    docs: {
      description:
        'Require a nested JSDoc list item to start at or past its ' +
        "parent's text, so it renders as a child",
    },
    messages: {
      nest:
        "A nested list item should start under its parent's text, at " +
        'column {{column}}, or it renders as a sibling.',
      follow:
        'A list item should move with the nested list it is in, to ' +
        'column {{column}}.',
    },
  },
  (context) => {
    const eol = toEol(context.sourceCode);
    /**
     * Reports each item that moves (see `misnested`) on its own:  a misnested
     * item, or another item of its list, which moves with it or lines up
     * with it.  The fix changes only the prefixes of the item's line and its
     * wrapped lines, which it replaces together, written with the file's line
     * ending, so they stay hung under its text.  The highlight runs to
     * the end of the item's line's text, from where the marker starts or from
     * the column, whichever is further left.
     *
     * @type {import('./block.js').OnBlock}
     */
    return (comment, text, indent, options) => {
      const nests = misnested(text, indent, options);
      const edits = nests.flatMap((n) => [n, ...n.hung]);
      const safe = fixesOf(comment, text, indent, options, edits).every(
        (fix) => fix !== null,
      );
      const lines = `${indent}${text}`.split('\n');
      return nests.map((n) => {
        const { at, end: cut, column, hung } = n;
        const last = hung.length ? hung[hung.length - 1].at : at;
        const fixed = lines.slice(at, last + 1);
        for (const e of [n, ...hung]) {
          const l = fixed[e.at - at];
          fixed[e.at - at] = l.slice(0, e.start) + e.text + l.slice(e.end);
        }
        const change = { at, end: last, lines: fixed };
        return {
          loc: locOf(
            comment,
            { at, column: Math.min(cut, column) },
            { at, column: lines[at].trimEnd().length },
          ),
          messageId: n.misnested ? 'nest' : 'follow',
          data: { column: column + 1 },
          fix: safe ? linesFix(eol, comment, text, indent, change) : null,
        };
      });
    };
  },
);
