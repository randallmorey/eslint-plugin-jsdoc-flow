// Tests for the `jsdoc-flow/reflow` rule.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RuleTester } from 'eslint';

import plugin, { reflowComment } from '../lib/index.js';
import './helpers.js';
import {
  blockInvalid,
  blockValid,
  guardBlocks,
  guardLimits,
  guardWidths,
  mayStart,
  noEnd,
  noStart,
} from './cases/blocks.js';
import { invalid, valid } from './cases/reflow.js';

const ruleTester = new RuleTester();

// Idempotency:  every fixed output is itself valid, so fixing it again
// changes nothing.
const fixedAgain = [...invalid, ...blockInvalid]
  .filter((c) => c.output)
  .map(({ name, output, options, filename, languageOptions }) => ({
    name: `idempotent:  ${name}`,
    code: output,
    ...(options && { options }),
    ...(filename && { filename }),
    ...(languageOptions && { languageOptions }),
  }));

ruleTester.run('jsdoc-flow/reflow', plugin.rules.reflow, {
  valid: [...valid, ...blockValid, ...fixedAgain],
  invalid: [...invalid, ...blockInvalid],
});

// Reflows each of a token's blocks at each width and each set of limits, and
// checks the text of its body lines.
const guarded = (token, check) => {
  for (const code of guardBlocks(token)) {
    const text = code.slice(0, code.indexOf('*/') + 2);
    for (const width of guardWidths) {
      for (const limits of guardLimits) {
        const fixed = reflowComment(text, '', width, limits);
        const lines = fixed.split('\n').slice(1, -1);
        check(
          lines.map((l) => l.replace(/^\s*\* ?/, '').trim()),
          `at ${width}, ${JSON.stringify(limits)}:\n${fixed}`,
        );
        // Whatever a wrap does, the next run reads the block the same way.
        assert.equal(reflowComment(fixed, '', width, limits), fixed);
      }
    }
  }
};

for (const token of noStart) {
  test(`a wrap never starts a line with \`${token}\``, () => {
    guarded(token, (lines, where) => {
      // A list item's own line is the only one that may, for a `-`.
      for (const l of lines.filter((l) => l !== '- an item'))
        assert.ok(!`${l} `.startsWith(`${token} `), `${token} ${where}`);
    });
  });
}

for (const token of noEnd) {
  test(`a wrap never ends a line with \`${token}\``, () => {
    guarded(token, (lines, where) => {
      // The last line ends with it in the block that ends with it.
      for (const l of lines.slice(0, -1))
        assert.ok(!l.endsWith(token), `${token} ${where}`);
    });
  });
}

// So the guards aren't only passing because nothing wraps.
for (const token of mayStart) {
  test(`a wrap may start a line with \`${token}\``, () => {
    let started = false;
    guarded(token, (lines) => {
      started ||= lines.some((l) => `${l} `.startsWith(`${token} `));
    });
    assert.ok(started);
  });
}
