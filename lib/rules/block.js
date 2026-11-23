/**
 * @import { AST, Rule } from 'eslint'
 */
import {
  hasVerbatimTag,
  inkOf,
  keepsCode,
  safeReflow,
  safeSpread,
  spreadDelimiters,
  writtenPlace,
} from '../flow.js';
import { settingsOf } from '../settings.js';

/**
 * A comment in a file.  ESLint always sets a comment's `loc` and `range`,
 * though its types mark them optional.
 *
 * @typedef {import('estree').Comment & Located} Comment
 * @typedef {{ loc: AST.SourceLocation, range: AST.Range }} Located
 * @typedef {AST.SourceLocation['start']} Position
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
 * @param {string} text - a block's text, as it is in the file
 * @returns {string} the text with LF line breaks if its breaks are all CRLF,
 *                   and otherwise as it is, so `flow.js`, which reads only LF,
 *                   skips it if it has a `\r`
 */
const lfOf = (text) =>
  /\r(?!\n)|(?<!\r)\n/.test(text) ? text : text.replaceAll('\r\n', '\n');

/**
 * @param {import('eslint').SourceCode} sourceCode - the file
 * @returns {(text: string) => string} what turns a block's text with LF line
 *                                     breaks into text with the file's line
 *                                     ending, as a fix that replaces a whole
 *                                     block writes it
 */
export const toEol = ({ text }) => {
  const eol = text.match(/\r?\n/)?.[0] ?? '\n';
  return (t) => t.replaceAll('\n', eol);
};

/**
 * Makes the fix that replaces a whole block with its fixed text, written with
 * the file's line ending, unless that isn't safe as a reflow
 * (see `safeReflow`).
 *
 * @param {(text: string) => string} eol - what writes the file's line ending
 *                                         (see `toEol`)
 * @param {Comment} comment - the block's comment
 * @param {string} text - the block's text
 * @param {string} fixed - the block's text after the fix
 * @param {string} indent - the whitespace before the block on its line
 * @param {import('../flow.js').BlockOptions} options - how to read the block
 * @returns {Rule.ReportFixer | null} the fix, if it's safe
 */
export function blockFix(eol, comment, text, fixed, indent, options) {
  if (!safeReflow(text, fixed, indent, options)) return null;
  return (fixer) => fixer.replaceTextRange(comment.range, eol(fixed));
}

/**
 * The fixer that `spreadReports` hands a rule's fixes, which gives back each
 * edit as it is, to be applied to the spread block rather than the file.
 *
 * @type {Rule.RuleFixer}
 */
const EDITS = /** @type {Rule.RuleFixer} */ (
  /** @type {unknown} */ ({
    /**
     * @param {AST.Range} range - where the edit is in the spread block
     * @param {string} text - what replaces it
     * @returns {Rule.Fix} the edit
     */
    replaceTextRange: (range, text) => ({ range, text }),
  })
);

/**
 * @param {string} text - a block's text, with LF line breaks
 * @param {string} indent - the whitespace before the block on its line
 * @param {number} start - where the block's line starts, `indent` included
 * @param {number} eol - the length of the line ending it's written with
 * @returns {number[]} where each of its lines starts, and where
 *                     one more would
 */
function lineStarts(text, indent, start, eol) {
  const starts = [start];
  for (const l of `${indent}${text}`.split('\n')) {
    starts.push(starts[starts.length - 1] + l.length + eol);
  }
  return starts;
}

/**
 * Makes the fix that replaces some whole lines of a block, from line `at`
 * through line `end`, with other lines, written with the file's line ending.
 * It's placed from the block's own lines, as `fixesOf` places an edit, so it
 * can be placed in a block's spread too (see `spreadComment`).  The caller
 * checks that the new lines are safe.
 *
 * @param {(text: string) => string} eol - what writes the file's line ending
 *                                         (see `toEol`)
 * @param {Comment} comment - the block's comment
 * @param {string} text - the block's text, with LF line breaks
 * @param {string} indent - the whitespace before the block on its line
 * @param {{ at: number, end: number, lines: string[] }} change -
 *   the indexes in the block of the first and last lines to replace,
 *   and the lines that replace them, each whole
 * @returns {Rule.ReportFixer} the fix
 */
export function linesFix(eol, comment, text, indent, { at, end, lines }) {
  // The comment as written has CRLF line breaks if they're all CRLF
  // (see `lfOf`).
  const crlf = comment.value.includes('\r\n') ? 2 : 1;
  const starts = lineStarts(
    text,
    indent,
    comment.range[0] - indent.length,
    crlf,
  );
  /**
   * @type {AST.Range}
   */
  const range = [starts[at], starts[end + 1] - crlf];
  return (fixer) => fixer.replaceTextRange(range, eol(lines.join('\n')));
}

/**
 * Turns what a rule reports on a block's spread (see `spreadDelimiters`) into
 * what it reports on the block as written, at the same words
 * (see `writtenPlace`).  An edit within a line that was written as it is,
 * or past the prefix of the opening text, is made there, so the spread is
 * left to `delimiter-lines` and the rule's edits can be made in the same pass
 * as its edits and every other rule's.  Any other edit, as to the whole block,
 * replaces the block with the spread, edited.
 *
 * @param {Comment} comment - the block's comment
 * @param {string} text - the block as written
 * @param {string} indent - the whitespace before the block on its line
 * @param {string} spread - the block spread, with the file's line ending
 *                          (see `toEol`)
 * @param {string} lf - the block spread, with LF line breaks
 * @param {Rule.ReportDescriptor[]} reports - what the rule reports
 *                                            on the spread
 * @returns {Rule.ReportDescriptor[]} what it reports on the block as written
 */
function spreadReports(comment, text, indent, spread, lf, reports) {
  const { line } = comment.loc.start;
  const crlf = (/** @type {string} */ s) => (s.includes('\r\n') ? 2 : 1);
  const starts = lineStarts(lf, indent, 0, crlf(spread));
  const fileStarts = lineStarts(
    text,
    indent,
    comment.range[0] - indent.length,
    crlf(comment.value),
  );
  /**
   * @type {(index: number) => ReturnType<typeof writtenPlace>}
   */
  const written = (index) => {
    let at = 0;
    while (starts[at + 1] <= index) at++;
    return writtenPlace(text, indent, lf, { at, column: index - starts[at] });
  };
  /**
   * @type {(edit: Rule.Fix) => Rule.ReportFixer}
   */
  const fixOf = ({ range: [from, to], text: by }) => {
    const [a, b] = [written(from), written(to)];
    if (a.at === b.at && !a.made && !b.made) {
      const at = fileStarts[a.at];
      return (fixer) =>
        fixer.replaceTextRange([at + a.column, at + b.column], by);
    }
    const fixed = `${indent}${spread}`;
    const whole = (fixed.slice(0, from) + by + fixed.slice(to)).slice(
      indent.length,
    );
    return (fixer) => fixer.replaceTextRange(comment.range, whole);
  };
  /**
   * @type {(at: Position) => Position}
   */
  const place = (at) => {
    const p = writtenPlace(text, indent, lf, {
      at: at.line - line,
      column: at.column,
    });
    return { line: line + p.at, column: p.column };
  };
  return reports.map((r) => {
    const { start, end } = /** @type {{ loc: AST.SourceLocation }} */ (r).loc;
    return {
      ...r,
      loc: { start: place(start), end: place(end) },
      fix: r.fix && fixOf(/** @type {Rule.Fix} */ (r.fix(EDITS))),
    };
  });
}

/**
 * Calls back with every JSDoc block in a file that these rules check:
 * one alone on its lines, with no ignore comment above it (see `ignoreLines`)
 * and no verbatim tag in it (see `hasVerbatimTag`), and reports what
 * it returns.  Every rule gets its blocks here, so they all skip the same
 * ones, and `--fix` can't disagree about them.  Comments in a `.gts` file's
 * `<template>` are `{{!-- --}}` or `<!-- -->`, so this skips them.  A block's
 * text is passed with LF line breaks (see `lfOf`).
 *
 * A block with text beside its `/**` or `*\/` is passed as `delimiter-lines`
 * spreads it (see `spreadDelimiters`), if that's safe, unless `asWritten` is
 * set, and what's reported on it is moved back to the block as written
 * (see `spreadReports`).  So a rule reads such a block as it will be once
 * spread, and its fixes spread it, which keeps the rules settling on the same
 * block in any order.  Otherwise, a rule run before `delimiter-lines` would
 * find nothing in it, and never fix it.
 *
 * A block that throws is reported once, without a fix, and the rest of
 * the file is still checked, unless `JSDOC_FLOW_STRICT=1` is set,
 * as the tests set it, so the error is thrown.
 *
 * @param {Rule.RuleContext} context - the rule's context
 * @param {import('../settings.js').Settings} settings - the shared settings
 * @param {OnBlock} fn - called with each block
 * @param {boolean} asWritten - whether to pass each block as it's written
 */
function eachBlock(context, { verbatimTags, ...options }, fn, asWritten) {
  const { sourceCode } = context;
  const eol = toEol(sourceCode);
  const comments = sourceCode.getAllComments().filter(located);
  const ignores = ignoreLines(sourceCode, comments);
  for (const comment of comments) {
    const text = lfOf(sourceCode.text.slice(...comment.range));
    // `/**/` starts with `/**`, but it's an empty ordinary comment, not a
    // JSDoc block.
    if (!JSDOC.test(text) || text.length < 5) continue;
    if (!alone(sourceCode, comment)) continue;
    if (ignores.has(comment.loc.start.line - 1)) continue;
    const { line, column } = comment.loc.start;
    const indent = sourceCode.lines[line - 1].slice(0, column);
    try {
      if (hasVerbatimTag(text, indent, verbatimTags, options)) continue;
      const lf = asWritten ? null : spreadDelimiters(text, indent);
      const reports =
        lf !== null && safeSpread(text, lf, indent)
          ? spreadReports(
              comment,
              text,
              indent,
              eol(lf),
              lf,
              fn(spreadComment(comment, eol(lf), indent), lf, indent, options),
            )
          : fn(comment, text, indent, options);
      for (const report of reports) context.report(report);
    } catch (error) {
      if (process.env.JSDOC_FLOW_STRICT === '1') throw error;
      context.report({ loc: comment.loc, messageId: 'internal' });
    }
  }
}

/**
 * Makes the comment that a rule is passed with a block's spread:  it's at
 * the block's place in the file, but its range is in the spread,
 * after the whitespace before the block, so a fix's edits can be applied
 * there (see `spreadReports`).
 *
 * @param {Comment} comment - the block's comment
 * @param {string} spread - the block spread, with the file's line ending
 * @param {string} indent - the whitespace before the block on its line
 * @returns {Comment} the spread's comment
 */
function spreadComment(comment, spread, indent) {
  const lines = `${indent}${spread}`.split(/\r?\n/);
  const { line } = comment.loc.start;
  return {
    ...comment,
    value: spread.slice(2, -2),
    range: [indent.length, indent.length + spread.length],
    loc: {
      start: comment.loc.start,
      end: {
        line: line + lines.length - 1,
        column: lines[lines.length - 1].length,
      },
    },
  };
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
 * @param {{ asWritten?: boolean }} [how] - whether each block is passed as
 *                                          it's written, rather than spread
 *                                          (see `eachBlock`)
 * @returns {import('eslint').Rule.RuleModule} the rule
 */
export const blockRule = (meta, check, { asWritten = false } = {}) => ({
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
      Program: () => eachBlock(context, settings, onBlock, asWritten),
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
    () => (comment, text, indent, options) => {
      const gap = options.spaces === 1 ? 'One space' : 'Two spaces';
      const findings = find(text, indent, options).filter(
        (finding) => finding.kind === kind,
      );
      const fixes = fixesOf(comment, text, indent, options, findings);
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
 * the file at once, from the block's own lines rather than the file's, so it
 * can be placed in a block's spread too (see `spreadComment`), and a bad one
 * throws before anything is reported.
 *
 * @param {Comment} comment - a block's comment
 * @param {string} text - the block's text
 * @param {string} indent - the whitespace before the block on its line
 * @param {import('../flow.js').BlockOptions} options - how to read the block
 * @param {import('../flow.js').Edit[]} edits - changes to the block, in order
 * @returns {(Rule.ReportFixer | null)[]} the fix of each edit, if it's safe
 */
export function fixesOf(comment, text, indent, options, edits) {
  const safe = !edits.length || keepsCode(text, indent, edits, options);
  const lines = `${indent}${text}`.split('\n');
  // The text has LF line breaks, and the comment as written has CRLF ones if
  // they're all CRLF (see `lfOf`).
  const eol = comment.value.includes('\r\n') ? 2 : 1;
  const starts = [comment.range[0] - indent.length];
  for (const l of lines)
    starts.push(starts[starts.length - 1] + l.length + eol);
  return edits.map(({ at, start, end, text: to }) => {
    // `keepsCode` has thrown already if the edit is past the block's end.
    const line = lines[at];
    /**
     * @type {AST.Range}
     */
    const range = [starts[at] + start, starts[at] + end];
    const from = line.slice(start, end);
    if (
      !safe ||
      end > line.length ||
      inkOf(from) !== inkOf(to) ||
      /[\n\r\u2028\u2029]/.test(from + to)
    )
      return null;
    return (fixer) => fixer.replaceTextRange(range, to);
  });
}
