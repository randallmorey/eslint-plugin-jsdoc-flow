import { exoticSpaces } from '../flow.js';
import { findingRule } from './block.js';

/**
 * The `jsdoc-flow/no-exotic-whitespace` rule.
 */
export default findingRule(
  exoticSpaces,
  'exotic',
  'Disallow tabs, no-break spaces and other whitespace that is not a plain ' +
    'space in JSDoc text',
  'Whitespace in JSDoc text should be plain spaces.',
);
