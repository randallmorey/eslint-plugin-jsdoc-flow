import { mistabled } from '../flow.js';
import { findingRule } from './block.js';

/**
 * The `jsdoc-flow/table-align` rule.
 */
export default findingRule(
  mistabled,
  'table',
  'Require the columns of a table in a JSDoc block to line up',
  "Line up this table row's `|` with the rest of its table's.",
);
