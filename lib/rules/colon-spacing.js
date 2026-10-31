import { misspaced } from '../flow.js';
import { findingRule } from './block.js';

/**
 * The `jsdoc-flow/colon-spacing` rule.
 */
export default findingRule(
  misspaced,
  'colon',
  'Require two spaces after a colon in JSDoc text',
  'Two spaces should follow a colon.',
);
