import { misedged } from '../flow.js';
import { findingRule } from './block.js';

/**
 * The `jsdoc-flow/text-indent` rule.
 */
export default findingRule(
  misedged,
  'leading',
  "Require one space between a JSDoc line's `*` and its text",
  'Remove extraneous whitespace at the start of this line.',
);
