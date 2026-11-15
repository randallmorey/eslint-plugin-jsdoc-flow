// Performance checks that hold on a slow machine as on a fast one:  a block
// eight times as long takes about eight times as long to reflow, not 64,
// whatever its shape, and a large real file is fixed well within a budget.
// Coverage skews the times, so they're skipped with it.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { Linter } from 'eslint';
import tseslint from 'typescript-eslint';

import plugin from '../lib/index.js';
import { reflowComment } from '../lib/flow.js';

const skip = !!process.env.NODE_V8_COVERAGE && 'coverage skews the times';
const block = (lines) =>
  ['/**', ...lines.map((l) => (l ? ` * ${l}` : ' *')), ' */'].join('\n');
const words = (n, first = 'alpha') =>
  Array.from({ length: n }, (_, i) =>
    i ? ['beta', 'gamma,', 'the', 'end.', 'Then', 'delta;'][i % 6] : first,
  );
const lines = (ws) =>
  Array.from({ length: Math.ceil(ws.length / 12) }, (_, i) =>
    ws.slice(i * 12, i * 12 + 12).join(' '),
  );

// Each shape makes a block of `n` lines' worth of it.
const shapes = {
  'a paragraph': (n) => block(lines(words(n * 12))),
  'a paragraph after a link': (n) => block(lines(words(n * 12, '[a](b)'))),
  'a tag with many unclosed braces': (n) =>
    block(
      lines([
        '@param',
        'x',
        '-',
        ...words(n * 12).map((w, i) => (i % 3 ? w : '{')),
      ]),
    ),
  'code spans': (n) =>
    block(lines(words(n * 12).map((w, i) => (i % 3 ? w : '`a b`')))),
  'hard breaks': (n) => block(Array.from({ length: n }, () => 'a line<br>')),
  'typed tags': (n) =>
    block(Array.from({ length: n }, (_, i) => `@param {string} p${i} - text`)),
  'labels and their lines': (n) =>
    block(
      Array.from(
        { length: n },
        (_, i) => ['Options:', `a${i}`, `b${i}`, ''][i % 4],
      ),
    ),
};

/**
 * The fastest of a few runs of each, taken in turns, so a slow spell on the
 * machine slows both alike.
 */
const fastest = (fns, runs = 5) => {
  const times = fns.map(() => Infinity);
  for (let r = 0; r < runs; r++) {
    fns.forEach((fn, k) => {
      const start = performance.now();
      fn();
      times[k] = Math.min(times[k], performance.now() - start);
    });
  }
  return times;
};

for (const [name, make] of Object.entries(shapes)) {
  test(`reflow takes linear time:  ${name}`, { skip }, () => {
    const [small, large] = [250, 2000].map(make);
    const [a, b] = fastest(
      [small, large].map((t) => () => reflowComment(t, '')),
    );
    assert.ok(b / a < 20, `${a.toFixed(1)}ms, then ${b.toFixed(1)}ms`);
  });
}

const linter = new Linter();
const config = [
  {
    files: ['**/*'],
    plugins: { 'jsdoc-flow': plugin },
    rules: Object.fromEntries(
      Object.keys(plugin.rules).map((r) => [`jsdoc-flow/${r}`, 'warn']),
    ),
  },
  { files: ['**/*.ts'], languageOptions: { parser: tseslint.parser } },
];

test('all rules take linear time in the number of blocks', { skip }, () => {
  const code = (n) =>
    Array.from(
      { length: n },
      (_, i) =>
        `${block(['Some  text,', 'e.g. this.  And  more', '@param x - y', '  wrapped'])}\nexport const x${i} = 1;\n`,
    ).join('\n');
  const [small, large] = [50, 400].map(code);
  const [a, b] = fastest(
    [small, large].map(
      (c) => () => linter.verifyAndFix(c, config, { filename: 'x.js' }),
    ),
    3,
  );
  assert.ok(b / a < 20, `${a.toFixed(1)}ms, then ${b.toFixed(1)}ms`);
});

test('all rules fix a large real file in a generous time', { skip }, () => {
  const file = 'node/fs.d.ts';
  const code = readFileSync(new URL(`corpus/${file}`, import.meta.url), 'utf8');
  const start = performance.now();
  linter.verifyAndFix(code, config, { filename: file });
  const ms = performance.now() - start;
  assert.ok(ms < 15000, `${ms.toFixed(0)}ms`);
});
