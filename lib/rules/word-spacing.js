import { misspaced } from '../flow.js';
import { findingRule } from './block.js';

/**
 * The `jsdoc-flow/word-spacing` rule.
 */
export default findingRule(
  misspaced,
  'word',
  'Require one space between words in JSDoc text, except after a sentence ' +
    'end or a colon',
  'One space should separate words.',
);
