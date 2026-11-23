/**
 * An ESLint plugin that flows the text of JSDoc blocks:  `reflow` lays out
 * each block's text with consistent line breaks, `quote-flow` flows
 * a blockquote's text inside its `>` markers, `sentence-spacing` and
 * `colon-spacing` put the spaces that the `spaces` setting says, by default
 * two, after a sentence end and a colon, `word-spacing` puts one between
 * other words, `no-extra-punctuation-space` removes the space before
 * `, . ; : ) ]` and after `( [`, `tag-spacing` puts one on either side of
 * a tag's `-`, `link-spacing` puts one between the words of an inline tag or
 * a link's text and none just inside its brackets, `bullet-spacing` puts one
 * after a list item's marker, `no-exotic-whitespace` turns tabs and other
 * Unicode spaces into plain spaces, `star-align`, `text-indent` and
 * `no-trailing-space` fix the whitespace at the edges of each line,
 * `tag-align` aligns a tag's continuation lines under its description,
 * `bullet-align` aligns a list item's wrapped lines under its text,
 * `bullet-indent` lines up the items at each level of a list,
 * `no-extra-blank-lines` removes blank lines at a block's start and end and
 * all but the first of a run, `padding-lines` puts one before and after each
 * fence, heading, and table, `table-align` lines up the columns of each table,
 * `delimiter-lines` moves the text beside a multi-line block's `/**` and
 * `*\/` onto lines of its own, and `single-line` spreads a one-line
 * block over three.
 */
import { createRequire } from 'node:module';

import reflow from './rules/reflow.js';
import quoteFlow from './rules/quote-flow.js';
import sentenceSpacing from './rules/sentence-spacing.js';
import colonSpacing from './rules/colon-spacing.js';
import wordSpacing from './rules/word-spacing.js';
import noExtraPunctuationSpace from './rules/no-extra-punctuation-space.js';
import tagSpacing from './rules/tag-spacing.js';
import linkSpacing from './rules/link-spacing.js';
import bulletSpacing from './rules/bullet-spacing.js';
import noExoticWhitespace from './rules/no-exotic-whitespace.js';
import starAlign from './rules/star-align.js';
import textIndent from './rules/text-indent.js';
import noTrailingSpace from './rules/no-trailing-space.js';
import tagAlign from './rules/tag-align.js';
import bulletAlign from './rules/bullet-align.js';
import bulletIndent from './rules/bullet-indent.js';
import noExtraBlankLines from './rules/no-extra-blank-lines.js';
import paddingLines from './rules/padding-lines.js';
import tableAlign from './rules/table-align.js';
import delimiterLines from './rules/delimiter-lines.js';
import singleLine from './rules/single-line.js';

const { name, version } = createRequire(import.meta.url)('../package.json');

/**
 * The plugin, which its configs below refer to.
 */
const plugin = {
  meta: { name, version },
  rules: {
    reflow,
    'quote-flow': quoteFlow,
    'sentence-spacing': sentenceSpacing,
    'colon-spacing': colonSpacing,
    'word-spacing': wordSpacing,
    'no-extra-punctuation-space': noExtraPunctuationSpace,
    'tag-spacing': tagSpacing,
    'link-spacing': linkSpacing,
    'bullet-spacing': bulletSpacing,
    'no-exotic-whitespace': noExoticWhitespace,
    'star-align': starAlign,
    'text-indent': textIndent,
    'no-trailing-space': noTrailingSpace,
    'tag-align': tagAlign,
    'bullet-align': bulletAlign,
    'bullet-indent': bulletIndent,
    'no-extra-blank-lines': noExtraBlankLines,
    'padding-lines': paddingLines,
    'table-align': tableAlign,
    'delimiter-lines': delimiterLines,
    'single-line': singleLine,
  },
  /**
   * @type {Record<string, import('eslint').Linter.Config>}
   */
  configs: {},
};

/**
 * @type {import('eslint').Linter.Config}
 */
plugin.configs.recommended = {
  name: 'jsdoc-flow/recommended',
  plugins: { 'jsdoc-flow': plugin },
  rules: {
    'jsdoc-flow/reflow': 'warn',
    'jsdoc-flow/quote-flow': 'warn',
    'jsdoc-flow/sentence-spacing': 'warn',
    'jsdoc-flow/colon-spacing': 'warn',
    'jsdoc-flow/word-spacing': 'warn',
    'jsdoc-flow/no-extra-punctuation-space': 'warn',
    'jsdoc-flow/tag-spacing': 'warn',
    'jsdoc-flow/link-spacing': 'warn',
    'jsdoc-flow/bullet-spacing': 'warn',
    'jsdoc-flow/no-exotic-whitespace': 'warn',
    'jsdoc-flow/star-align': 'warn',
    'jsdoc-flow/text-indent': 'warn',
    'jsdoc-flow/no-trailing-space': 'warn',
    'jsdoc-flow/tag-align': 'warn',
    'jsdoc-flow/bullet-align': 'warn',
    'jsdoc-flow/bullet-indent': 'warn',
    'jsdoc-flow/no-extra-blank-lines': 'warn',
    'jsdoc-flow/padding-lines': 'warn',
    'jsdoc-flow/table-align': 'warn',
    'jsdoc-flow/delimiter-lines': 'warn',
    'jsdoc-flow/single-line': 'warn',
  },
};

export default plugin;
