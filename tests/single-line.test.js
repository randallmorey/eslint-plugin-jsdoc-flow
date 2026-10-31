// Tests for the `jsdoc-flow/single-line` rule.
import { RuleTester } from 'eslint';

import plugin from '../lib/index.js';
import './helpers.js';
import { singleInvalid, singleValid } from './cases/single-line.js';

const ruleTester = new RuleTester();

// Idempotency:  every fixed output is itself valid, so fixing it again
// changes nothing.
const singleFixedAgain = singleInvalid.map(
  ({ name, output, filename, languageOptions }) => ({
    name: `idempotent:  ${name}`,
    code: output,
    ...(filename && { filename }),
    ...(languageOptions && { languageOptions }),
  }),
);

ruleTester.run('jsdoc-flow/single-line', plugin.rules['single-line'], {
  valid: [...singleValid, ...singleFixedAgain],
  invalid: singleInvalid,
});
