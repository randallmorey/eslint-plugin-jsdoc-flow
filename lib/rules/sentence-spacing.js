import { misspaced } from '../flow.js';
import { findingRule } from './block.js';

/**
 * The `jsdoc-flow/sentence-spacing` rule.
 */
export default findingRule(
  misspaced,
  'sentence',
  'Require as many spaces as the `spaces` setting says after a sentence end ' +
    'in JSDoc text',
  '{{gap}} should follow a sentence end.',
);
