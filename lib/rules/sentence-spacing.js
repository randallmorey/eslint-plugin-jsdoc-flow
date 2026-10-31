import { misspaced } from '../flow.js';
import { findingRule } from './block.js';

/**
 * The `jsdoc-flow/sentence-spacing` rule.
 */
export default findingRule(
  misspaced,
  'sentence',
  'Require two spaces after a sentence end in JSDoc text',
  'Two spaces should follow a sentence end.',
);
