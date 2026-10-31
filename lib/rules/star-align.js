import { misedged } from '../flow.js';
import { findingRule } from './block.js';

/**
 * The `jsdoc-flow/star-align` rule.
 */
export default findingRule(
  misedged,
  'star',
  "Require each JSDoc line's `*` to be under the `/**`",
  "This line's `*` should be under the `/**`.",
);
