/**
 * @import { AST, Rule } from 'eslint'
 */
import { hasVerbatimTag, inkOf, keepsCode } from '../flow.js';
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
 * its text, the whitespace before it on its line, and the `preformatted`,
 * `spaces`, `width` and `maxHead` settings, which every rule must pass on to
 * `flow.js` so they read, space and align a block the same way.  It returns
 * what to report on the block, so all of it is found before any is reported.
 *
 * @typedef {(comment: Comment, text: string, indent: string, options: import('../flow.js').AlignOptions) => Rule.ReportDescriptor[]} OnBlock
 */

/**
 * @param {import('estree').Comment} comment - a comment in a file
 * @returns {comment is Comment} whether it has its `loc` and `range`,
 *                               which ESLint always sets
 */
const located = (comment) => !!comment.loc && !!comment.range;

/**
 * Matches the start of a JSDoc block.  As in JSDoc itself, a comment that
 * opens with more than two stars, as a banner does, isn't one.
 */
const JSDOC = /^\/\*\*(?!\*)/;

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
 * and no verbatim tag in it (see `hasVerbatimTag`), and reports what
 * it returns.  Every rule gets its blocks here, so they all skip the same
 * ones, and `--fix` can't disagree about them.  Comments in a `.gts` file's
 * `<template>` are `{{!-- --}}` or `<!-- -->`, so this skips them.
 *
 * A block that throws is reported once, without a fix, and the rest of
 * the file is still checked, unless `JSDOC_FLOW_STRICT=1` is set,
 * as the tests set it, so the error is thrown.
 *
 * @param {Rule.RuleContext} context - the rule's context
 * @param {import('../settings.js').Settings} settings - the shared settings
 * @param {OnBlock} fn - called with each block
 */
function eachBlock(context, { verbatimTags, ...options }, fn) {
  const { sourceCode } = context;
  const comments = sourceCode.getAllComments().filter(located);
  const ignores = ignoreLines(sourceCode, comments);
  for (const comment of comments) {
    const text = sourceCode.text.slice(...comment.range);
    // `/**/` starts with `/**`, but it's an empty ordinary comment, not a
    // JSDoc block.
    if (!JSDOC.test(text) || text.length < 5) continue;
    if (!alone(sourceCode, comment)) continue;
    if (ignores.has(comment.loc.start.line - 1)) continue;
    const { line, column } = comment.loc.start;
    const indent = sourceCode.lines[line - 1].slice(0, column);
    try {
      if (hasVerbatimTag(text, indent, verbatimTags, options)) continue;
      for (const report of fn(comment, text, indent, options)) {
        context.report(report);
      }
    } catch (error) {
      if (process.env.JSDOC_FLOW_STRICT === '1') throw error;
      context.report({ loc: comment.loc, messageId: 'internal' });
    }
  }
}

/**
 * What a rule reports on a block that it fails to check.
 */
const INTERNAL =
  'jsdoc-flow could not process this block (internal error).  Run ESLint ' +
  'with JSDOC_FLOW_STRICT=1 to see the error.';

/**
 * Makes a rule that checks every JSDoc block in a file.  Its meta has
 * `type: 'layout'`, `fixable: 'whitespace'` and `schema: []` unless `meta`
 * sets them, and the `internal` message (see `eachBlock`).
 *
 * @param {Rule.RuleMetaData} meta - the rule's meta
 * @param {(context: import('eslint').Rule.RuleContext) => OnBlock} check -
 *   called once per file, and returns what to call with each block
 * @returns {import('eslint').Rule.RuleModule} the rule
 */
export const blockRule = (meta, check) => ({
  meta: {
    type: 'layout',
    fixable: 'whitespace',
    schema: [],
    ...meta,
    messages: { ...meta.messages, internal: INTERNAL },
  },
  create(context) {
    const settings = settingsOf(context);
    const onBlock = check(context);
    return {
      Program: () => eachBlock(context, settings, onBlock),
    };
  },
});

/**
 * Makes a rule that reports one kind of finding in every JSDoc block,
 * and ignores the other kinds.  It reports each finding of that kind on its
 * own, highlighting its span, and the fix applies only its edit.  A message
 * may say `{{gap}}` for the gap that the `spaces` setting puts after
 * a sentence end or a colon.
 *
 * @param {(text: string, indent: string, options: import('../flow.js').BlockOptions) => import('../flow.js').Finding[]} find -
 *   what finds the findings in a block, such as `misspaced`
 * @param {string} kind - the kind of finding, which is the rule's `messageId`
 * @param {string} description - the rule's description
 * @param {string} message - what the rule reports for each finding
 * @returns {import('eslint').Rule.RuleModule} the rule
 */
export const findingRule = (find, kind, description, message) =>
  blockRule(
    { docs: { description }, messages: { [kind]: message } },
    (context) => (comment, text, indent, options) => {
      const gap = options.spaces === 1 ? 'One space' : 'Two spaces';
      const findings = find(text, indent, options).filter(
        (finding) => finding.kind === kind,
      );
      const { sourceCode } = context;
      const fixes = fixesOf(
        sourceCode,
        comment,
        text,
        indent,
        options,
        findings,
      );
      return findings.map((finding, k) => ({
        loc: locOf(comment, finding.from, finding.to),
        messageId: kind,
        data: { gap },
        fix: fixes[k],
      }));
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
 * Makes the fixes of a block's edits.  Every rule declares
 * `fixable: 'whitespace'`, so an edit that changes more than whitespace on
 * its line is a bug, and gets no fix, and if the edits together change
 * the block's code (see `keepsCode`), none does.  Each edit is placed in
 * the file at once, so a bad one throws before anything is reported.
 *
 * @param {import('eslint').SourceCode} sourceCode - the file
 * @param {Comment} comment - a block's comment
 * @param {string} text - the block's text
 * @param {string} indent - the whitespace before the block on its line
 * @param {import('../flow.js').BlockOptions} options - how to read the block
 * @param {import('../flow.js').Edit[]} edits - changes to the block, in order
 * @returns {(Rule.ReportFixer | null)[]} the fix of each edit, if it's safe
 */
export function fixesOf(sourceCode, comment, text, indent, options, edits) {
  const safe = !edits.length || keepsCode(text, indent, edits, options);
  return edits.map(({ at, start, end, text: to }) => {
    const line = comment.loc.start.line + at;
    const index = sourceCode.getIndexFromLoc({ line, column: start });
    /**
     * @type {AST.Range}
     */
    const range = [index, index + end - start];
    const from = sourceCode.text.slice(...range);
    if (
      !safe ||
      inkOf(from) !== inkOf(to) ||
      /[\n\r\u2028\u2029]/.test(from + to)
    )
      return null;
    return (fixer) => fixer.replaceTextRange(range, to);
  });
}
