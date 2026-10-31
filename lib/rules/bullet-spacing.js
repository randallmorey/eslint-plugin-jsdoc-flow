import { misbulleted } from '../flow.js';
import { findingRule } from './block.js';

/**
 * The `jsdoc-flow/bullet-spacing` rule.
 */
export default findingRule(
  misbulleted,
  'bullet',
  'Require one space after a list marker (`-`, `*` or `1.`) in JSDoc text',
  "One space should follow a list item's marker.",
);
