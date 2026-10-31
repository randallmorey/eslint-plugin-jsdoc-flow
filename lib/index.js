/**
 * An ESLint plugin that flows the text of JSDoc blocks:  `reflow` lays out
 * each block's text with consistent line breaks, `sentence-spacing` and
 * `colon-spacing` put two spaces after a sentence end and a colon,
 * `word-spacing` puts one between other words,
 * `no-extra-punctuation-space` removes the space before `, . ; : ) ]` and
 * after `( [`, `tag-spacing` puts one on either side of a tag's `-`,
 * `bullet-spacing` puts one after a list item's marker,
 * `no-exotic-whitespace` turns tabs and other Unicode spaces into plain
 * spaces, `star-align`, `text-indent` and `no-trailing-space` fix
 * the whitespace at the edges of each line, `tag-align` aligns a tag's
 * continuation lines under its description, `bullet-align` aligns a list
 * item's wrapped lines under its text, and `single-line` spreads a one-line
 * block over three.
 */
import { createRequire } from 'node:module';

import reflow from './rules/reflow.js';
import sentenceSpacing from './rules/sentence-spacing.js';
import colonSpacing from './rules/colon-spacing.js';
import wordSpacing from './rules/word-spacing.js';
import noExtraPunctuationSpace from './rules/no-extra-punctuation-space.js';
import tagSpacing from './rules/tag-spacing.js';
import bulletSpacing from './rules/bullet-spacing.js';
import noExoticWhitespace from './rules/no-exotic-whitespace.js';
import starAlign from './rules/star-align.js';
import textIndent from './rules/text-indent.js';
import noTrailingSpace from './rules/no-trailing-space.js';
import tagAlign from './rules/tag-align.js';
import bulletAlign from './rules/bullet-align.js';
import singleLine from './rules/single-line.js';

export { alignTags, fixEdges, fixSpacing, reflowComment } from './flow.js';

const { name, version } = createRequire(import.meta.url)('../package.json');

/**
 * The plugin, which its configs below refer to.
 */
const plugin = {
  meta: { name, version },
  rules: {
    reflow,
    'sentence-spacing': sentenceSpacing,
    'colon-spacing': colonSpacing,
    'word-spacing': wordSpacing,
    'no-extra-punctuation-space': noExtraPunctuationSpace,
    'tag-spacing': tagSpacing,
    'bullet-spacing': bulletSpacing,
    'no-exotic-whitespace': noExoticWhitespace,
    'star-align': starAlign,
    'text-indent': textIndent,
    'no-trailing-space': noTrailingSpace,
    'tag-align': tagAlign,
    'bullet-align': bulletAlign,
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
    'jsdoc-flow/sentence-spacing': 'warn',
    'jsdoc-flow/colon-spacing': 'warn',
    'jsdoc-flow/word-spacing': 'warn',
    'jsdoc-flow/no-extra-punctuation-space': 'warn',
    'jsdoc-flow/tag-spacing': 'warn',
    'jsdoc-flow/bullet-spacing': 'warn',
    'jsdoc-flow/no-exotic-whitespace': 'warn',
    'jsdoc-flow/star-align': 'warn',
    'jsdoc-flow/text-indent': 'warn',
    'jsdoc-flow/no-trailing-space': 'warn',
    'jsdoc-flow/tag-align': 'warn',
    'jsdoc-flow/bullet-align': 'warn',
    'jsdoc-flow/single-line': 'warn',
  },
};

export default plugin;
