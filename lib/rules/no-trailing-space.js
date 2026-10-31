import { misedged } from '../flow.js';
import { findingRule } from './block.js';

/**
 * The `jsdoc-flow/no-trailing-space` rule.
 */
export default findingRule(
  misedged,
  'trailing',
  'Disallow whitespace after the text of a JSDoc line',
  'Remove extraneous whitespace at the end of this line.',
);
