// Tests for the `jsdoc-flow/reflow` rule.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RuleTester } from 'eslint';

import plugin from '../lib/index.js';
import { reflowComment } from '../lib/flow.js';
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
  .map(({ name, output, options, settings, filename, languageOptions }) => ({
    name: `idempotent:  ${name}`,
    code: output,
    ...(options && { options }),
    ...(settings && { settings }),
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
      for (const l of lines.filter((l) => !l.startsWith('- an item')))
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

// A zero-width space is whitespace, so a wrap never starts a line with one,
// which the next run would read as indentation.
test('a zero-width space between words reflows to itself', () => {
  const text = '/**\n * a [x] http://example.com/a.b \u200b {@link Foo}\n */';
  const fixed = reflowComment(text, '', 40, { spaces: 1 });
  assert.equal(
    fixed,
    '/**\n * a [x]\n * http://example.com/a.b {@link Foo}\n */',
  );
  assert.equal(reflowComment(fixed, '', 40, { spaces: 1 }), fixed);
});

// Reflow writes what `no-trailing-space` would:  it trims the whitespace after
// a markdown line's text, and keeps code, HTML, and a multi-line `{Type}`
// exactly.
test('a kept markdown line loses its trailing whitespace, and code keeps it', () => {
  const text = [
    '/**',
    ' * # Heading  ',
    ' *',
    ' * - a bullet\t',
    ' *',
    ' * | a | b | ',
    ' * | - | - |',
    ' *',
    ' * ```',
    ' * fenced  ',
    ' * ```',
    ' * <pre>',
    ' * html  ',
    ' * </pre>',
    ' * @param {{  ',
    ' *   a: string  ',
    ' * }} name',
    ' */',
  ].join('\n');
  const fixed = reflowComment(text, '', 80, { spaces: 2 });
  assert.equal(
    fixed,
    text
      .replace('# Heading  ', '# Heading')
      .replace('a bullet\t', 'a bullet')
      .replace('| a | b | ', '| a | b |'),
  );
  assert.equal(reflowComment(fixed, '', 80, { spaces: 2 }), fixed);
});

// Lines are laid out in loops, not a recursion per line, so a paragraph that
// wraps onto thousands of lines, or has thousands of hard breaks, can't
// overflow the stack.
test('a paragraph that wraps onto 12,000 lines reflows', () => {
  const text = `/**\n * ${Array(12000).fill('ab').join(' ')}\n */`;
  const fixed = reflowComment(text, '', 8);
  assert.equal(fixed.split('\n').length, 12000);
  assert.equal(reflowComment(fixed, '', 8), fixed);
});

test('a paragraph of 3,000 lines ending in `<br>` reflows', () => {
  const text = `/**\n${Array(3000).fill(' * a b<br>').join('\n')}\n */`;
  assert.equal(reflowComment(text, '', 80), text);
});
