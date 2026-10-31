// Tests for the spacing rules:  `jsdoc-flow/sentence-spacing`,
// `colon-spacing`, `word-spacing`, `no-extra-punctuation-space`,
// `tag-spacing`, `bullet-spacing` and `no-exotic-whitespace`.
import { testFindingRules } from './helpers.js';
import {
  bulletInvalid,
  colonInvalid,
  punctuationInvalid,
  sentenceInvalid,
  spacingValid,
  tagInvalid,
  wordInvalid,
} from './cases/spacing.js';
import { exoticInvalid, exoticValid } from './cases/whitespace.js';

testFindingRules(
  {
    'sentence-spacing': sentenceInvalid,
    'colon-spacing': colonInvalid,
    'word-spacing': wordInvalid,
    'no-extra-punctuation-space': punctuationInvalid,
    'tag-spacing': tagInvalid,
    'bullet-spacing': bulletInvalid,
    'no-exotic-whitespace': exoticInvalid,
  },
  [...spacingValid, ...exoticValid],
);
