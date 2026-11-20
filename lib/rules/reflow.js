import {
  alignBullets,
  alignTags,
  fixEdges,
  fixPunctuation,
  fixSpacing,
  fixWhitespace,
  indentBullets,
  misflowed,
  reflowComment,
  safeReflow,
  spaceBullets,
} from '../flow.js';
import { blockRule, locOf, toEol } from './block.js';

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
          orphans: {
            description:
              "Whether a sentence's first two and last two words stay " +
              'together (`sentence`), a single word after `, ; :` may not ' +
              'end a line or be a line alone (`clause`), and the first and ' +
              'last words inside parentheses stay with their neighbors ' +
              '(`paren`).  Each is `true` unless set.',
            type: 'object',
            properties: {
              sentence: { type: 'boolean' },
              clause: { type: 'boolean' },
              paren: { type: 'boolean' },
            },
            additionalProperties: false,
          },
          names: {
            description:
              'Whether an abbreviation beside a name stays with it, as in ' +
              '`Mr. Smith`, `true` unless set.',
            type: 'boolean',
          },
          shortWords: {
            description:
              'Whether `a`, `an`, `the` and one-letter words such as `I` ' +
              'stay with the word after them, `true` unless set.',
            type: 'boolean',
          },
          hang: {
            description:
              'Whether a line may go one column past the width when its ' +
              'last character is closing punctuation, `true` unless set.',
            type: 'boolean',
          },
          widows: {
            description:
              "The shortest a paragraph's last line's text may be, as " +
              'a fraction of the width, `0.15` unless set, and off at `0`.',
            type: 'number',
            minimum: 0,
            maximum: 1,
          },
        },
        additionalProperties: false,
      },
    ],
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
    const [options = {}] = context.options;
    const eol = toEol(context.sourceCode);
    /**
     * Reports where a block's line breaks go wrong, highlighting the two
     * words around each, and fixes the whole block by reflowing it.  A block
     * whose reflow isn't safe (see `safeReflow`) is reported whole,
     * without a fix.  The fix is written with the file's line ending.
     *
     * @type {import('./block.js').OnBlock}
     */
    return (comment, text, indent, format) => {
      const fixed = reflowComment(text, indent, format.width, {
        ...options,
        ...format,
      });
      if (fixed === null || fixed === text) return [];
      // A block whose only problems are its spacing, its lines' edges, its
      // tag or list alignment or its whitespace characters, so that its
      // reflow is exactly the spaced, edged and aligned text with plain
      // spaces, is left to the spacing rules, the edge rules, `tag-align`,
      // the list rules and `no-exotic-whitespace` (see the header of
      // `flow.js`).  Reflow keeps the lines it doesn't flow, apart from
      // the whitespace after a markdown line's text, and a zero-width space,
      // so those are made plain on both sides.
      const plain = fixWhitespace(text, indent, format);
      const spaced = fixPunctuation(
        fixSpacing(plain, indent, format),
        indent,
        format,
      );
      const tidy = fixEdges(spaced, indent, format);
      const listed = indentBullets(
        spaceBullets(tidy, indent, format),
        indent,
        format,
      );
      const aligned = alignBullets(
        alignTags(listed, indent, format),
        indent,
        format,
      );
      if (fixWhitespace(fixed, indent, format) === aligned) return [];
      if (!safeReflow(text, fixed, indent, format)) {
        return [{ loc: comment.loc, messageId: 'unsafe' }];
      }
      return misflowed(text, fixed, indent).map(({ kind, from, to }) => ({
        loc: locOf(comment, from, to),
        messageId: kind,
        fix: (fixer) => fixer.replaceTextRange(comment.range, eol(fixed)),
      }));
    };
  },
);
