import { misquoted } from '../flow.js';
import { blockRule, linesFix, locOf, toEol } from './block.js';
import { FLOW_OPTIONS } from './reflow.js';

/**
 * The `jsdoc-flow/quote-flow` rule.
 */
export default blockRule(
  {
    docs: {
      description:
        'Require the text of a blockquote in a JSDoc block to be flowed ' +
        'with consistent line breaks inside its `>` markers',
    },
    schema: [FLOW_OPTIONS],
    messages: {
      quote: "Blockquote text isn't flowed.",
      unsafe:
        "Blockquote text isn't flowed, and flowing it would change more " +
        'than whitespace, so it has no fix.',
    },
  },
  (context) => {
    const [options = {}] = context.options;
    const eol = toEol(context.sourceCode);
    /**
     * Reports each blockquote in a block whose text isn't flowed, from its
     * first `>` to the end of its text, and fixes it by replacing its lines
     * with its flowed lines (see `misquoted`), which are written with
     * the file's line ending.  If that isn't safe, there's no fix.
     *
     * @type {import('./block.js').OnBlock}
     */
    return (comment, text, indent, format) => {
      const { quotes, safe } = misquoted(text, indent, format.width, {
        ...options,
        ...format,
      });
      return quotes.map((quote) => ({
        loc: locOf(comment, quote.from, quote.to),
        messageId: safe ? 'quote' : 'unsafe',
        fix: safe ? linesFix(eol, comment, text, indent, quote) : null,
      }));
    };
  },
);
