// Tests for the `jsdoc-flow/tag-align` rule.
import { RuleTester } from 'eslint';

import plugin from '../lib/index.js';
import './helpers.js';
import { alignInvalid, alignValid } from './cases/tag-align.js';

const ruleTester = new RuleTester();

// Idempotency:  every fixed output is itself valid, so fixing it again
// changes nothing.
const alignFixedAgain = alignInvalid.map(
  ({ name, output, filename, languageOptions }) => ({
    name: `idempotent:  ${name}`,
    code: output,
    ...(filename && { filename }),
    ...(languageOptions && { languageOptions }),
  }),
);

ruleTester.run('jsdoc-flow/tag-align', plugin.rules['tag-align'], {
  valid: [...alignValid, ...alignFixedAgain],
  invalid: alignInvalid,
});
