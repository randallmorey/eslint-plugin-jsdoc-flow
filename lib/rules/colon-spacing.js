import { misspaced } from '../flow.js';
import { findingRule } from './block.js';

/**
 * The `jsdoc-flow/colon-spacing` rule.
 */
export default findingRule(
  misspaced,
  'colon',
  'Require as many spaces as the `spaces` setting says after a colon in ' +
    'JSDoc text',
  '{{gap}} should follow a colon.',
);
