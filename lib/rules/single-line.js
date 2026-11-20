import { isDirective, leadingTag, strip } from '../flow.js';
import { TAG_NAME } from '../settings.js';
import { blockFix, blockRule, toEol } from './block.js';

/**
 * The `jsdoc-flow/single-line` rule.
 */
export default blockRule(
  {
    docs: {
      description:
        'Disallow single-line JSDoc blocks, which are harder to scan than ' +
        'a block whose text is on lines of its own',
    },
    schema: [
      {
        type: 'object',
        properties: {
          allowTags: {
            description:
              'The names of the tags, without the `@`, that let a block ' +
              'that begins with one stay on a single line, none unless set.',
            type: 'array',
            items: { type: 'string', pattern: TAG_NAME },
            uniqueItems: true,
          },
        },
        additionalProperties: false,
      },
    ],
    defaultOptions: [{ allowTags: [] }],
    messages: {
      single:
        'JSDoc blocks should not be on a single line:  put `/**`, the content, ' +
        'and `*/` on lines of their own.',
    },
  },
  (context) => {
    const eol = toEol(context.sourceCode);
    // ESLint before 9.15 ignores `defaultOptions`, so an option may be unset.
    const { allowTags = [] } = context.options[0] ?? {};
    const allowed = new Set(allowTags);
    /**
     * Reports each JSDoc block on a single line, and fixes it by spreading it
     * over three:  its `/**`, its text, and its `*\/`, each indented as
     * the block was.  The text is kept as it is, except the whitespace around
     * it, so a line that ends up too wide is left to `reflow`.  A block
     * without text is left alone, and so is a `@ts-*` directive, which stops
     * working when it's spread out, and a block that begins with
     * an allowed tag.  A fix that isn't safe as a reflow (see `safeReflow`)
     * is dropped.  The fix is written with the file's line ending.
     *
     * @type {import('./block.js').OnBlock}
     */
    return (comment, text, indent, options) => {
      if (comment.loc.start.line !== comment.loc.end.line) return [];
      const body = strip(text.slice(3, -2));
      if (!body || isDirective(body) || allowed.has(leadingTag(body))) {
        return [];
      }
      const fixed = ['/**', `${indent} * ${body}`, `${indent} */`].join('\n');
      const fix = blockFix(eol, comment, text, fixed, indent, options);
      return [{ loc: comment.loc, messageId: 'single', fix }];
    };
  },
);
