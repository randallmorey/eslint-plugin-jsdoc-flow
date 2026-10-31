// Tests for the plugin object:  its meta, rules and configs.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { Linter } from 'eslint';

import plugin, {
  alignTags,
  fixEdges,
  fixSpacing,
  reflowComment,
} from '../lib/index.js';
import { block } from './helpers.js';

const pkg = createRequire(import.meta.url)('../package.json');

test('meta comes from package.json', () => {
  assert.deepEqual(plugin.meta, { name: pkg.name, version: pkg.version });
});

test('it has all fourteen rules', () => {
  assert.deepEqual(Object.keys(plugin.rules), [
    'reflow',
    'sentence-spacing',
    'colon-spacing',
    'word-spacing',
    'no-extra-punctuation-space',
    'tag-spacing',
    'bullet-spacing',
    'no-exotic-whitespace',
    'star-align',
    'text-indent',
    'no-trailing-space',
    'tag-align',
    'bullet-align',
    'single-line',
  ]);
});

test('the recommended config warns with all fourteen rules', () => {
  const { recommended } = plugin.configs;
  assert.equal(recommended.name, 'jsdoc-flow/recommended');
  assert.equal(recommended.plugins['jsdoc-flow'], plugin);
  const messages = new Linter().verify(
    block('@param name - one. Two:  a  b.', '  three', '', 'Four', 'five.') +
      '/** Six , then. */\nexport const y = 2;\n' +
      '/**\n   *  Seven.  \n */\nexport const z = 3;\n' +
      '/**\n * -  Eight.\n */\nexport const w = 4;\n' +
      '/**\n * Nine\tten.\n */\nexport const v = 5;\n' +
      '/**\n * - Eleven,\n * twelve.\n */\nexport const u = 6;\n',
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
    ],
  );
});

test('reflowComment, fixSpacing, fixEdges and alignTags are exported', () => {
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
