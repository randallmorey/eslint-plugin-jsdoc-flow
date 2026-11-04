// Tests for the `width` and `maxHead` settings, which every rule shares, so
// `reflow` and `tag-align` agree on which heads are wide.  The cases of what
// they do are in `cases/reflow.js` and `cases/tag-align.js`.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Linter } from 'eslint';

import plugin from '../lib/index.js';
import { block } from './helpers.js';

const RULES = Object.keys(plugin.rules);
const linter = new Linter();
const configFor = (rules, settings, options = []) => [
  {
    files: ['**/*.*'],
    plugins: { 'jsdoc-flow': plugin },
    rules: Object.fromEntries(
      rules.map((r) => [`jsdoc-flow/${r}`, ['warn', ...options]]),
    ),
    ...(settings && { settings }),
  },
];

for (const width of [0, -1, 1.5, '80', null, true, [], {}, NaN, Infinity]) {
  test(`width rejects ${String(width)} (${typeof width})`, () => {
    assert.throws(
      () =>
        linter.verify('', configFor(['reflow'], { 'jsdoc-flow': { width } })),
      /settings\['jsdoc-flow'\]\.width must be a positive integer/,
    );
  });
}

for (const maxHead of [-0.1, 1.1, '0.5', null, true, [], {}, NaN]) {
  test(`maxHead rejects ${String(maxHead)} (${typeof maxHead})`, () => {
    assert.throws(
      () =>
        linter.verify('', configFor(['reflow'], { 'jsdoc-flow': { maxHead } })),
      /settings\['jsdoc-flow'\]\.maxHead must be a number from 0 to 1/,
    );
  });
}

for (const rule of RULES) {
  test(`${rule} throws on an invalid width or maxHead`, () => {
    for (const own of [{ width: 0 }, { maxHead: 2 }]) {
      assert.throws(
        () => linter.verify('', configFor([rule], { 'jsdoc-flow': own })),
        new RegExp(`jsdoc-flow/${rule}.*${Object.keys(own)[0]}`),
      );
    }
  });

  test(`${rule} takes the ends of width and maxHead's ranges`, () => {
    for (const own of [{ width: 1 }, { maxHead: 0 }, { maxHead: 1 }]) {
      assert.deepEqual(
        linter.verify('', configFor([rule], { 'jsdoc-flow': own })),
        [],
      );
    }
  });
}

for (const rule of ['reflow', 'tag-align']) {
  for (const option of [{ width: 100 }, { maxHead: 0.5 }]) {
    test(`\`${rule}\` takes ${Object.keys(option)[0]} from the settings, not its options`, () => {
      assert.throws(
        () => linter.verify('', configFor([rule], undefined, [option])),
        new RegExp(`jsdoc-flow/${rule}`),
      );
    });
  }
}

// `reflow` leaves each of these to `tag-align`, and both find the same column,
// so neither undoes the other.
const head = `@param {string} ${'n'.repeat(31)} -`;
const shared = [
  {
    name: 'width',
    own: { width: 100 },
    code: block(
      `${head} the description, which is long enough`,
      '  that it has to wrap',
    ),
    output: block(
      `${head} the description, which is long enough`,
      `${' '.repeat(50)}that it has to wrap`,
    ),
  },
  {
    name: 'maxHead',
    own: { maxHead: 0.25 },
    code: block(
      '@param {string} name -',
      `${' '.repeat(23)}the description, which is long enough to need a wrap somewhere`,
    ),
    output: block(
      '@param {string} name -',
      '  the description, which is long enough to need a wrap somewhere',
    ),
  },
];

for (const { name, own, code, output } of shared) {
  test(`\`reflow\` and \`tag-align\` agree on the \`${name}\` setting`, () => {
    const config = (rules) => configFor(rules, { 'jsdoc-flow': own });
    assert.deepEqual(linter.verify(code, config(['reflow'])), []);
    assert.equal(
      linter.verify(code, config(['tag-align']))[0].messageId,
      'align',
    );
    const { output: fixed } = linter.verifyAndFix(code, config(RULES));
    assert.equal(fixed, output);
    assert.deepEqual(linter.verify(fixed, config(RULES)), []);
  });
}
