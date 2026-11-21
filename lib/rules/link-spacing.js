import { misspanned } from '../flow.js';
import { findingRule } from './block.js';

/**
 * The `jsdoc-flow/link-spacing` rule.
 */
export default findingRule(
  misspanned,
  'link',
  'Require one space between words inside a JSDoc inline tag or link ' +
    'text, and none just inside its brackets',
  'One space should separate words in a link, and none should pad it.',
);
