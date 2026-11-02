// Tests for the ignore comment and the `verbatimTags` setting, which all
// the rules share.  The tests of all the rules together, in `fix.test.js`,
// check the cases in `cases/verbatim.js`.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Linter, RuleTester } from 'eslint';

import plugin, {
  alignTags,
  fixEdges,
  fixSpacing,
  reflowComment,
} from '../lib/index.js';
import './helpers.js';
import { messyBlocks } from './cases/verbatim.js';

const RULES = Object.keys(plugin.rules);
const linter = new Linter();
const configFor = (rule, settings) => [
  {
    files: ['**/*.*'],
    plugins: { 'jsdoc-flow': plugin },
    rules: { [`jsdoc-flow/${rule}`]: 'warn' },
    ...(settings && { settings }),
  },
];
const off = { 'jsdoc-flow': { verbatimTags: [] } };
const messy = messyBlocks.join('');
const ignored = messyBlocks.map((b) => `// jsdoc-flow-ignore\n${b}`).join('');

for (const rule of RULES) {
  test(`${rule} reports the blocks with nothing protecting them`, () => {
    assert.notEqual(linter.verify(messy, configFor(rule, off)).length, 0);
    const { output } = linter.verifyAndFix(messy, configFor(rule, off));
    assert.notEqual(output, messy);
  });

  for (const [how, code, settings] of [
    ['a default verbatim tag', messy, undefined],
    ['an ignore comment', ignored, off],
  ]) {
    test(`${rule} leaves alone the blocks with ${how}`, () => {
      assert.deepEqual(linter.verify(code, configFor(rule, settings)), []);
      const { output } = linter.verifyAndFix(code, configFor(rule, settings));
      assert.equal(output, code);
    });
  }
}

// RuleTester takes shared settings too, as a user's config gives them.
new RuleTester().run('jsdoc-flow/reflow', plugin.rules.reflow, {
  valid: [
    {
      name: 'a custom verbatim tag',
      code: '/**\n * @diagram\n * One. Two.\n */\n',
      settings: { 'jsdoc-flow': { verbatimTags: ['diagram'] } },
    },
  ],
  invalid: [
    {
      name: 'a default tag that a custom list leaves out',
      code: '/**\n * @license\n * One two.\n */\n',
      output: '/**\n * @license One two.\n */\n',
      settings: { 'jsdoc-flow': { verbatimTags: ['diagram'] } },
      errors: [{ messageId: 'join' }],
    },
  ],
});

test('a later config replaces an earlier list and keeps the rest', () => {
  const [config] = configFor('sentence-spacing');
  const reports = (...settings) =>
    linter.verify('/**\n * @license One. Two.\n */\n', [
      config,
      ...settings.map((s) => ({ settings: { 'jsdoc-flow': s } })),
    ]).length;
  assert.equal(reports({ verbatimTags: ['license'] }), 0);
  assert.equal(
    reports({ verbatimTags: ['license'] }, { verbatimTags: ['diagram'] }),
    1,
  );
  assert.equal(reports({ verbatimTags: ['license'] }, {}), 0);
});

const invalidTags = [
  'license',
  true,
  null,
  {},
  [1],
  [null],
  [['license']],
  ['@license'],
  [''],
  ['a b'],
  ['1a'],
  ['license\n'],
  ['license', 'license'],
  // eslint-disable-next-line no-sparse-arrays
  [, 'license'],
];

for (const verbatimTags of invalidTags) {
  test(`verbatimTags rejects ${JSON.stringify(verbatimTags)}`, () => {
    const settings = { 'jsdoc-flow': { verbatimTags } };
    assert.throws(
      () => linter.verify('', configFor('reflow', settings)),
      /settings\['jsdoc-flow'\]\.verbatimTags must be an array/,
    );
  });
}

for (const own of [true, 'license', null, ['license']]) {
  test(`settings['jsdoc-flow'] rejects ${JSON.stringify(own)}`, () => {
    assert.throws(
      () => linter.verify('', configFor('reflow', { 'jsdoc-flow': own })),
      /settings\['jsdoc-flow'\] must be an object/,
    );
  });
}

for (const rule of RULES) {
  test(`${rule} throws on an invalid verbatimTags`, () => {
    const settings = { 'jsdoc-flow': { verbatimTags: 'license' } };
    assert.throws(
      () => linter.verify('', configFor(rule, settings)),
      new RegExp(`jsdoc-flow/${rule}.*verbatimTags`),
    );
  });
}

test('other settings are left to other plugins', () => {
  const settings = { jsdoc: { verbatimTags: 'license' } };
  assert.deepEqual(linter.verify('', configFor('reflow', settings)), []);
});

// The exported functions format whatever block they're given.
test('the exported functions do not read verbatim tags', () => {
  const text = '/**\n * @license One. Two.\n */';
  assert.equal(reflowComment(text, ''), '/**\n * @license One.  Two.\n */');
  assert.equal(fixSpacing(text, ''), '/**\n * @license One.  Two.\n */');
  assert.equal(fixEdges('/**\n *  @license\n */', ''), '/**\n * @license\n */');
  assert.equal(
    alignTags('/**\n * @license a,\n *   b\n */', ''),
    '/**\n * @license a,\n *          b\n */',
  );
});
