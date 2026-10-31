import {
  WIDTH,
  alignBullets,
  alignTags,
  fixEdges,
  fixPunctuation,
  fixSpacing,
  fixWhitespace,
  misflowed,
  reflowComment,
  wordsOf,
} from '../flow.js';
import { blockRule, locOf } from './block.js';

/**
 * The `jsdoc-flow/reflow` rule.
 */
export default blockRule(
  {
    docs: {
      description:
        'Require JSDoc text to be flowed with consistent line breaks',
    },
    schema: [
      {
        type: 'object',
        properties: {
          width: { type: 'integer', minimum: 1 },
          orphans: {
            type: 'object',
            properties: {
              sentence: { type: 'boolean' },
              clause: { type: 'boolean' },
              paren: { type: 'boolean' },
            },
            additionalProperties: false,
          },
          names: { type: 'boolean' },
          shortWords: { type: 'boolean' },
          hang: { type: 'boolean' },
          widows: { type: 'number', minimum: 0, maximum: 1 },
        },
        additionalProperties: false,
      },
    ],
    defaultOptions: [{ width: WIDTH }],
    messages: {
      reflow: "JSDoc text isn't flowed.",
      break:
        "JSDoc text isn't flowed:  the line should break between these words.",
      join: "JSDoc text isn't flowed:  these words should be on one line.",
      unsafe:
        "JSDoc text isn't flowed, and reflowing it would change more " +
        'than whitespace, so it has no fix.',
    },
  },
  (context) => {
    const [{ width, ...options }] = context.options;
    /**
     * Reports where a block's line breaks go wrong, highlighting the two
     * words around each, and fixes the whole block by reflowing it.  A block
     * whose reflow would change a word is reported whole, without a fix.
     *
     * @type {import('./block.js').OnBlock}
     */
    return (comment, text, indent) => {
      const fixed = reflowComment(text, indent, width, options);
      if (fixed === null || fixed === text) return;
      // A block whose only problems are its spacing, its lines' edges, its
      // tag or list alignment or its whitespace characters, so that its
      // reflow is exactly the spaced, edged and aligned text with plain
      // spaces, is left to the spacing rules, the edge rules, `tag-align`,
      // `bullet-align` and `no-exotic-whitespace` (see the header of
      // `flow.js`).  Reflow keeps
      // the lines it doesn't flow, and a zero-width space, so those are made
      // plain on both sides.
      const plain = fixWhitespace(text, indent);
      const spaced = fixPunctuation(fixSpacing(plain, indent), indent);
      const tidy = fixEdges(spaced, indent);
      const aligned = alignBullets(alignTags(tidy, indent), indent);
      if (fixWhitespace(fixed, indent) === aligned) return;
      if (wordsOf(fixed).join(' ') !== wordsOf(text).join(' ')) {
        context.report({ loc: comment.loc, messageId: 'unsafe' });
        return;
      }
      for (const { kind, from, to } of misflowed(text, fixed, indent)) {
        context.report({
          loc: locOf(comment, from, to),
          messageId: kind,
          fix: (fixer) => fixer.replaceTextRange(comment.range, fixed),
        });
      }
    };
  },
);
