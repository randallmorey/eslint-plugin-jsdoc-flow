// Tests for the `jsdoc-flow/reflow` rule.
import { RuleTester } from 'eslint';

import plugin from '../lib/index.js';
import './helpers.js';
import { invalid, valid } from './cases/reflow.js';

const ruleTester = new RuleTester();

// Idempotency:  every fixed output is itself valid, so fixing it again
// changes nothing.
const fixedAgain = invalid
  .filter((c) => c.output)
  .map(({ name, output, options, filename, languageOptions }) => ({
    name: `idempotent:  ${name}`,
    code: output,
    ...(options && { options }),
    ...(filename && { filename }),
    ...(languageOptions && { languageOptions }),
  }));

ruleTester.run('jsdoc-flow/reflow', plugin.rules.reflow, {
  valid: [...valid, ...fixedAgain],
  invalid,
});
