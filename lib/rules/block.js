/**
 * @import { AST } from 'eslint'
 */

/**
 * A comment in a file.  ESLint always sets a comment's `loc` and `range`,
 * though its types mark them optional.
 *
 * @typedef {import('estree').Comment & Located} Comment
 * @typedef {{ loc: AST.SourceLocation, range: AST.Range }} Located
 */

/**
 * What a rule calls with each JSDoc block in a file:  the block's comment,
 * its text, and the whitespace before it on its line.
 *
 * @typedef {(comment: Comment, text: string, indent: string) => void} OnBlock
 */

/**
 * @param {import('estree').Comment} comment - a comment in a file
 * @returns {comment is Comment} whether it has its `loc` and `range`,
 *                               which ESLint always sets
 */
const located = (comment) => !!comment.loc && !!comment.range;

/**
 * Calls back with every JSDoc block in a file that these rules check:
 * one alone on its lines.  Comments in a `.gts` file's `<template>` are
 * `{{!-- --}}` or `<!-- -->`, so this skips them.
 *
 * @param {import('eslint').SourceCode} sourceCode - the file
 * @param {OnBlock} fn - called with each block
 */
function eachBlock(sourceCode, fn) {
  for (const comment of sourceCode.getAllComments().filter(located)) {
    const text = sourceCode.text.slice(...comment.range);
    // `/**/` starts with `/**`, but it's an empty ordinary comment, not a
    // JSDoc block.
    if (!text.startsWith('/**') || text.length < 5) continue;
    const { start, end } = comment.loc;
    const indent = sourceCode.lines[start.line - 1].slice(0, start.column);
    const after = sourceCode.lines[end.line - 1].slice(end.column);
    if (/\S/.test(indent) || /\S/.test(after)) continue;
    fn(comment, text, indent);
  }
}

/**
 * Makes a rule that checks every JSDoc block in a file.  Its meta has
 * `type: 'layout'`, `fixable: 'whitespace'` and `schema: []` unless
 * `meta` sets them.
 *
 * @param {object} meta - the rule's meta
 * @param {(context: import('eslint').Rule.RuleContext) => OnBlock} check -
 *   called once per file, and returns what to call with each block
 * @returns {import('eslint').Rule.RuleModule} the rule
 */
export const blockRule = (meta, check) => ({
  meta: { type: 'layout', fixable: 'whitespace', schema: [], ...meta },
  create(context) {
    const onBlock = check(context);
    return { Program: () => eachBlock(context.sourceCode, onBlock) };
  },
});

/**
 * Makes a rule that reports one kind of finding in every JSDoc block,
 * and ignores the other kinds.  It reports each finding of that kind on its
 * own, highlighting its span, and the fix applies only its edit.
 *
 * @param {(text: string, indent: string) => import('../flow.js').Finding[]} find -
 *   what finds the findings in a block, such as `misspaced`
 * @param {string} kind - the kind of finding, which is the rule's `messageId`
 * @param {string} description - the rule's description
 * @param {string} message - what the rule reports for each finding
 * @returns {import('eslint').Rule.RuleModule} the rule
 */
export const findingRule = (find, kind, description, message) =>
  blockRule(
    { docs: { description }, messages: { [kind]: message } },
    (context) => (comment, text, indent) => {
      for (const finding of find(text, indent)) {
        if (finding.kind !== kind) continue;
        context.report({
          loc: locOf(comment, finding.from, finding.to),
          messageId: kind,
          fix: fixOf(context.sourceCode, comment, finding),
        });
      }
    },
  );

/**
 * @param {Comment} comment - a block's comment
 * @param {import('../flow.js').Place} from - where a span starts in the block
 * @param {import('../flow.js').Place} to - where it ends
 * @returns {import('eslint').AST.SourceLocation}
 *   the span's location in the file
 */
export const locOf = (comment, from, to) => {
  const { line } = comment.loc.start;
  return {
    start: { line: line + from.at, column: from.column },
    end: { line: line + to.at, column: to.column },
  };
};

/**
 * @param {import('eslint').SourceCode} sourceCode - the file
 * @param {Comment} comment - a block's comment
 * @param {import('../flow.js').Edit} edit - a change to the block
 * @returns {import('eslint').Rule.ReportFixer} a fix that applies the edit
 */
export const fixOf =
  (sourceCode, comment, { at, start, end, text }) =>
  (fixer) => {
    const line = comment.loc.start.line + at;
    const index = sourceCode.getIndexFromLoc({ line, column: start });
    return fixer.replaceTextRange([index, index + end - start], text);
  };
