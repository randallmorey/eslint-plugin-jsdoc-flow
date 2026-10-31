// Tests for the `jsdoc-flow/bullet-align` rule.
import { RuleTester } from 'eslint';

import plugin from '../lib/index.js';
import './helpers.js';
import { bulletAlignInvalid, bulletAlignValid } from './cases/bullet-align.js';

const ruleTester = new RuleTester();

// Idempotency:  every fixed output is itself valid, so fixing it again
// changes nothing.
const bulletAlignFixedAgain = bulletAlignInvalid.map(({ name, output }) => ({
  name: `idempotent:  ${name}`,
  code: output,
}));

ruleTester.run('jsdoc-flow/bullet-align', plugin.rules['bullet-align'], {
  valid: [...bulletAlignValid, ...bulletAlignFixedAgain],
  invalid: bulletAlignInvalid,
});
