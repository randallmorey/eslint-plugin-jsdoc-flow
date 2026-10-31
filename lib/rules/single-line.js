import { blockRule } from './block.js';

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
    messages: {
      single:
        'JSDoc blocks should not be on a single line:  put `/**`, the content, ' +
        'and `*/` on lines of their own.',
    },
  },
  (context) => {
    const eol = context.sourceCode.text.match(/\r?\n/)?.[0] ?? '\n';
    /**
     * Reports each JSDoc block on a single line, and fixes it by spreading it
     * over three:  its `/**`, its text, and its `*\/`, each indented as
     * the block was.  The text is kept as it is, except the whitespace around
     * it, so a line that ends up too wide is left to `reflow`.  A block
     * without text is left alone.
     *
     * @type {import('./block.js').OnBlock}
     */
    return (comment, text, indent) => {
      if (comment.loc.start.line !== comment.loc.end.line) return;
      const body = text.slice(3, -2).trim();
      if (!body) return;
      const lines = ['/**', `${indent} * ${body}`, `${indent} */`];
      context.report({
        loc: comment.loc,
        messageId: 'single',
        fix: (fixer) => fixer.replaceTextRange(comment.range, lines.join(eol)),
      });
    };
  },
);
