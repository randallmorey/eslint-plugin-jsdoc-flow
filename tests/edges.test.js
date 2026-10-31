// Tests for the edge rules:  `jsdoc-flow/star-align`, `text-indent` and
// `no-trailing-space`, and that they and `no-exotic-whitespace`, which checks
// the whitespace before a line's text too, are independent.
import { testFindingRules } from './helpers.js';
import {
  edgeValid,
  leadingInvalid,
  starInvalid,
  trailingInvalid,
} from './cases/edges.js';
import { exoticInvalid } from './cases/whitespace.js';

testFindingRules(
  {
    'star-align': starInvalid,
    'text-indent': leadingInvalid,
    'no-trailing-space': trailingInvalid,
    'no-exotic-whitespace': exoticInvalid,
  },
  edgeValid,
);
