// Tests for the plugin object:  its meta, rules and configs.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { Linter } from 'eslint';

import * as entry from '../lib/index.js';
import plugin from '../lib/index.js';
import { alignTags, fixEdges, fixSpacing, reflowComment } from '../lib/flow.js';
import { block } from './helpers.js';

const pkg = createRequire(import.meta.url)('../package.json');

test('meta comes from package.json', () => {
  assert.deepEqual(plugin.meta, { name: pkg.name, version: pkg.version });
});

test('it has all twenty-two rules', () => {
  assert.deepEqual(Object.keys(plugin.rules), [
    'reflow',
    'quote-flow',
    'sentence-spacing',
    'colon-spacing',
    'word-spacing',
    'no-extra-punctuation-space',
    'tag-spacing',
    'link-spacing',
    'bullet-spacing',
    'no-exotic-whitespace',
    'star-align',
    'text-indent',
    'no-trailing-space',
    'tag-align',
    'bullet-align',
    'bullet-indent',
    'list-nesting',
    'no-extra-blank-lines',
    'padding-lines',
    'table-align',
    'delimiter-lines',
    'single-line',
  ]);
});

test('the recommended config warns with all twenty-two rules', () => {
  const { recommended } = plugin.configs;
  assert.equal(recommended.name, 'jsdoc-flow/recommended');
  assert.equal(recommended.plugins['jsdoc-flow'], plugin);
  const messages = new Linter().verify(
    block('@param name - one. Two:  a  b.', '  three', '', 'Four', 'five.') +
      '/** Six , then. */\nexport const y = 2;\n' +
      '/**\n   *  Seven.  \n */\nexport const z = 3;\n' +
      '/**\n * -  Eight.\n */\nexport const w = 4;\n' +
      '/**\n * Nine\tten.\n */\nexport const v = 5;\n' +
      '/**\n * - Eleven, with text that runs on far enough that it wraps ' +
      'past the end of\n * its line, twelve.\n */\nexport const u = 6;\n' +
      '/**\n * Twelve.\n *\n *\n * Thirteen.\n */\nexport const t = 7;\n' +
      '/** Fourteen.\n */\nexport const s = 8;\n' +
      '/**\n * - Fifteen\n *  - sixteen\n */\nexport const r = 9;\n' +
      '/**\n * Seventeen:\n * ```js\n * a();\n * ```\n */\nexport const q = 10;\n' +
      '/**\n * | Eighteen | a |\n * |-|-|\n */\nexport const p = 11;\n' +
      '/**\n * Nineteen {@link  a }.\n */\nexport const o = 12;\n' +
      '/**\n * > Twenty\n * > one.\n */\nexport const n = 13;\n' +
      '/**\n * 1. Twenty-two\n *   - three\n */\nexport const m = 14;\n',
    [recommended],
    { filename: 'x.js' },
  );
  assert.deepEqual(
    messages.map((m) => [m.ruleId, m.severity]),
    [
      ['jsdoc-flow/sentence-spacing', 1],
      ['jsdoc-flow/word-spacing', 1],
      ['jsdoc-flow/reflow', 1],
      ['jsdoc-flow/tag-align', 1],
      ['jsdoc-flow/reflow', 1],
      ['jsdoc-flow/single-line', 1],
      ['jsdoc-flow/no-extra-punctuation-space', 1],
      ['jsdoc-flow/star-align', 1],
      ['jsdoc-flow/text-indent', 1],
      ['jsdoc-flow/no-trailing-space', 1],
      ['jsdoc-flow/bullet-spacing', 1],
      ['jsdoc-flow/no-exotic-whitespace', 1],
      ['jsdoc-flow/bullet-align', 1],
      ['jsdoc-flow/no-extra-blank-lines', 1],
      ['jsdoc-flow/delimiter-lines', 1],
      ['jsdoc-flow/bullet-indent', 1],
      ['jsdoc-flow/padding-lines', 1],
      ['jsdoc-flow/table-align', 1],
      ['jsdoc-flow/link-spacing', 1],
      ['jsdoc-flow/link-spacing', 1],
      ['jsdoc-flow/quote-flow', 1],
      ['jsdoc-flow/list-nesting', 1],
    ],
  );
});

test('the plugin is the only export', () => {
  assert.deepEqual(Object.keys(entry), ['default']);
});

// The engine is internal, so its tests import it from `flow.js`.
test('reflowComment, fixSpacing, fixEdges and alignTags work on their own', () => {
  assert.equal(reflowComment('/** One. Two. */', ''), '/** One.  Two. */');
  assert.equal(
    fixSpacing('/** One. Two  three. */', ''),
    '/** One.  Two three. */',
  );
  assert.equal(fixEdges('/**  One.   */', ''), '/** One. */');
  assert.equal(
    alignTags('/**\n * @param a - b,\n *   c\n */', ''),
    '/**\n * @param a - b,\n *            c\n */',
  );
});
