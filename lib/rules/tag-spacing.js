import { misspaced } from '../flow.js';
import { findingRule } from './block.js';

/**
 * The `jsdoc-flow/tag-spacing` rule.
 */
export default findingRule(
  misspaced,
  'tag',
  "Require one space on either side of the `-` between a JSDoc tag's head " +
    'and its description',
  "One space should separate a tag's `-` from the words beside it.",
);
