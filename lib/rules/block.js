/**
 * @import { AST } from 'eslint'
 */
import { hasVerbatimTag } from '../flow.js';
import { settingsOf } from '../settings.js';

/**
 * A comment in a file.  ESLint always sets a comment's `loc` and `range`,
 * though its types mark them optional.
 *
 * @typedef {import('estree').Comment & Located} Comment
 * @typedef {{ loc: AST.SourceLocation, range: AST.Range }} Located
 */

/**
 * What a rule calls with each JSDoc block in a file:  the block's comment,
 * its text, the whitespace before it on its line, and the `preformatted`
 * setting, which every rule must pass on to `flow.js` so they read a block
 * the same way.
 *
 * @typedef {(comment: Comment, text: string, indent: string, preformatted: boolean) => void} OnBlock
 */

/**
 * @param {import('estree').Comment} comment - a comment in a file
 * @returns {comment is Comment} whether it has its `loc` and `range`,
 *                               which ESLint always sets
 */
const located = (comment) => !!comment.loc && !!comment.range;

/**
 * Matches the start of the comment that makes the rules skip the next block.
 * Text may follow the marker, but it has to be the marker's whole name.
 */
const IGNORE = /^(?:\/\/|\/\*)\s*jsdoc-flow-ignore(?![\w-])/;

/**
 * @param {import('eslint').SourceCode} sourceCode - the file
 * @param {Comment} comment - a comment in it
 * @returns {boolean} whether nothing else is on the comment's lines
 */
const alone = ({ lines }, { loc: { start, end } }) =>
  !/\S/.test(lines[start.line - 1].slice(0, start.column)) &&
  !/\S/.test(lines[end.line - 1].slice(end.column));

/**
 * Finds the lines of a file's ignore comments, each of which must be on
 * a line of its own.  A block is ignored if one is on the line right above it,
 * so only the next block is, and a blank line or code between them breaks
 * the link.  No fix can change that, since fixes change only a block's text.
 *
 * @param {import('eslint').SourceCode} sourceCode - the file
 * @param {Comment[]} comments - its comments
 * @returns {Set<number>} the line of each
 */
const ignoreLines = (sourceCode, comments) =>
  new Set(
    comments
      .filter(
        (c) =>
          c.loc.start.line === c.loc.end.line &&
          alone(sourceCode, c) &&
          IGNORE.test(sourceCode.text.slice(...c.range)),
      )
      .map((c) => c.loc.start.line),
  );

/**
 * Calls back with every JSDoc block in a file that these rules check:
 * one alone on its lines, with no ignore comment above it (see `ignoreLines`)
 * and no verbatim tag in it (see `hasVerbatimTag`).  Every rule gets its
 * blocks here, so they all skip the same ones, and `--fix` can't disagree
 * about them.  Comments in a `.gts` file's `<template>` are `{{!-- --}}` or
 * `<!-- -->`, so this skips them.
 *
 * @param {import('eslint').SourceCode} sourceCode - the file
 * @param {import('../settings.js').Settings} settings - the shared settings
 * @param {OnBlock} fn - called with each block
 */
function eachBlock(sourceCode, { verbatimTags, preformatted }, fn) {
  const comments = sourceCode.getAllComments().filter(located);
  const ignores = ignoreLines(sourceCode, comments);
  for (const comment of comments) {
    const text = sourceCode.text.slice(...comment.range);
    // `/**/` starts with `/**`, but it's an empty ordinary comment, not a
    // JSDoc block.
    if (!text.startsWith('/**') || text.length < 5) continue;
    if (!alone(sourceCode, comment)) continue;
    if (ignores.has(comment.loc.start.line - 1)) continue;
    const { line, column } = comment.loc.start;
    const indent = sourceCode.lines[line - 1].slice(0, column);
    if (hasVerbatimTag(text, indent, verbatimTags, preformatted)) continue;
    fn(comment, text, indent, preformatted);
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
    const settings = settingsOf(context);
    const onBlock = check(context);
    return {
      Program: () => eachBlock(context.sourceCode, settings, onBlock),
    };
  },
});

/**
 * Makes a rule that reports one kind of finding in every JSDoc block,
 * and ignores the other kinds.  It reports each finding of that kind on its
 * own, highlighting its span, and the fix applies only its edit.
 *
 * @param {(text: string, indent: string, preformatted: boolean) => import('../flow.js').Finding[]} find -
 *   what finds the findings in a block, such as `misspaced`
 * @param {string} kind - the kind of finding, which is the rule's `messageId`
 * @param {string} description - the rule's description
 * @param {string} message - what the rule reports for each finding
 * @returns {import('eslint').Rule.RuleModule} the rule
 */
export const findingRule = (find, kind, description, message) =>
  blockRule(
    { docs: { description }, messages: { [kind]: message } },
    (context) => (comment, text, indent, preformatted) => {
      for (const finding of find(text, indent, preformatted)) {
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
