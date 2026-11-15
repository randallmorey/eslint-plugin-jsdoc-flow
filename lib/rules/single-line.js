import { isDirective, leadingTag, safeReflow } from '../flow.js';
import { TAG_NAME } from '../settings.js';
import { blockRule, toEol } from './block.js';

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
    const [{ allowTags }] = context.options;
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
      const body = text.slice(3, -2).trim();
      if (!body || isDirective(body) || allowed.has(leadingTag(body))) {
        return [];
      }
      const fixed = ['/**', `${indent} * ${body}`, `${indent} */`].join('\n');
      /**
       * @type {import('eslint').Rule.ReportFixer}
       */
      const fix = (fixer) => fixer.replaceTextRange(comment.range, eol(fixed));
      const safe = safeReflow(text, fixed, indent, options);
      return [
        { loc: comment.loc, messageId: 'single', fix: safe ? fix : null },
      ];
    };
  },
);
