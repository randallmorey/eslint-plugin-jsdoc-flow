import { mispunctuated } from '../flow.js';
import { findingRule } from './block.js';

/**
 * The `jsdoc-flow/no-extra-punctuation-space` rule.
 */
export default findingRule(
  mispunctuated,
  'punctuation',
  'Disallow spaces before `, . ; : ) ]` and after `( [` in JSDoc text',
  'No space should separate this punctuation from its word.',
);
