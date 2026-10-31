// Helpers shared by the tests.  Run them with `npm test`.
import { test } from 'node:test';
import { RuleTester } from 'eslint';

import plugin from '../lib/index.js';

// RuleTester groups its cases with `describe`, which `n` flags as
// experimental on Node 20, so groups become name prefixes of plain tests.
const groups = [];
RuleTester.describe = (text, fn) => {
  groups.push(text);
  fn();
  groups.pop();
};
RuleTester.it = (text, fn) => test([...groups, text].join(' > '), fn);
RuleTester.itOnly = (text, fn) =>
  test([...groups, text].join(' > '), { only: true }, fn);

// A JSDoc block of the given body lines (`''` is a blank one), then code.
export const block = (...lines) =>
  [
    '/**',
    ...lines.map((l) => (l ? ` * ${l}` : ' *')),
    ' */',
    'export const x = 1;',
    '',
  ].join('\n');

// A case's code or output as a valid case, named with a prefix.
const asValid =
  (prefix, key = 'code') =>
  ({ name, filename, languageOptions, ...c }) => ({
    name: `${prefix}:  ${name}`,
    code: c[key],
    ...(filename && { filename }),
    ...(languageOptions && { languageOptions }),
  });

// Runs rules that each report one kind of finding, given each rule's invalid
// cases and the cases valid for all of them.
export function testFindingRules(invalidByRule, valid) {
  const ruleTester = new RuleTester();
  const entries = Object.entries(invalidByRule);
  for (const [rule, invalid] of entries) {
    // Independence:  the other rules' invalid cases have findings of only
    // their own kind, so this rule reports none of them.
    const others = entries
      .filter(([r]) => r !== rule)
      .flatMap(([r, cases]) => cases.map(asValid(`left to ${r}`)));
    // Idempotency:  every fixed output is itself valid, so fixing it again
    // changes nothing.
    const fixedAgain = invalid.map(asValid('idempotent', 'output'));
    ruleTester.run(`jsdoc-flow/${rule}`, plugin.rules[rule], {
      valid: [...valid, ...others, ...fixedAgain],
      invalid,
    });
  }
}
