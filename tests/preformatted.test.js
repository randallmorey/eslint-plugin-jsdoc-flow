// Tests for the guard that keeps unfenced code and diagrams as they are, and
// its `preformatted` setting, which all the rules share.  The tests of all the
// rules together, in `fix.test.js`, check the cases in `cases/preformatted.js`.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Linter } from 'eslint';

import plugin, {
  alignTags,
  fixEdges,
  fixSpacing,
  reflowComment,
} from '../lib/index.js';
import { block } from './helpers.js';
import { messyGuarded, preformattedCases } from './cases/preformatted.js';

const RULES = Object.keys(plugin.rules);
const linter = new Linter();
const configFor = (rules, settings) => [
  {
    files: ['**/*.*'],
    plugins: { 'jsdoc-flow': plugin },
    rules: Object.fromEntries(rules.map((r) => [`jsdoc-flow/${r}`, 'warn'])),
    ...(settings && { settings }),
  },
];
const off = { 'jsdoc-flow': { preformatted: false } };
const on = { 'jsdoc-flow': { preformatted: true } };
const fixWith = (rules, code, settings) =>
  linter.verifyAndFix(code, configFor(rules, settings), { filename: 'x.js' })
    .output;

for (const c of preformattedCases) {
  // What `--fix` settles on is valid for each rule by itself, and with each
  // rule alone the guard's lines stay as they are.
  test(`no rule alone reports what --fix settles on:  ${c.name}`, () => {
    const settled = fixWith(RULES, c.code);
    for (const rule of RULES) assert.equal(fixWith([rule], settled), settled);
  });
}

const messy = messyGuarded.join('');

for (const rule of RULES) {
  test(`${rule} leaves guarded lines as they are`, () => {
    assert.deepEqual(linter.verify(messy, configFor([rule])), []);
    assert.equal(fixWith([rule], messy), messy);
  });

  test(`${rule} leaves guarded lines as they are when the setting is true`, () => {
    assert.deepEqual(linter.verify(messy, configFor([rule], on)), []);
  });

  // `single-line` looks at no line of a block, and `tag-spacing` only at a
  // tag's own line, which the guard never keeps.
  if (rule === 'single-line' || rule === 'tag-spacing') continue;
  test(`${rule} changes those lines with the guard off`, () => {
    assert.notEqual(linter.verify(messy, configFor([rule], off)).length, 0);
    assert.notEqual(fixWith([rule], messy, off), messy);
  });
}

test('`tag-spacing` still checks a tag above a pointer line', () => {
  const code = block('@param name  -  the name', '                ^^^^');
  assert.equal(
    fixWith(['tag-spacing'], code),
    block('@param name - the name', '                ^^^^'),
  );
});

test('`single-line` still spreads out a block a guard would keep', () => {
  assert.equal(
    fixWith(['single-line'], '/** ^^^ */\nexport const x = 1;\n'),
    '/**\n * ^^^\n */\nexport const x = 1;\n',
  );
});

test('a one-line block of pointers is an ordinary one-line block', () => {
  const code = '/** ^^^ */\nexport const x = 1;\n';
  assert.equal(
    fixWith(
      RULES.filter((r) => r !== 'single-line'),
      code,
    ),
    code,
  );
});

test('a later config replaces an earlier setting and keeps the rest', () => {
  const [config] = configFor(['reflow']);
  const code = block('Some text,', '  and more.');
  const reports = (...settings) =>
    linter.verify(code, [
      config,
      ...settings.map((s) => ({ settings: { 'jsdoc-flow': s } })),
    ]).length;
  assert.equal(reports(), 0);
  assert.equal(reports({ preformatted: false }), 1);
  assert.equal(reports({ preformatted: false }, { preformatted: true }), 0);
  assert.equal(reports({ preformatted: false }, {}), 1);
  assert.equal(reports({ verbatimTags: [] }), 0);
});

test('the setting leaves the verbatim tags to their own setting', () => {
  const code = block('Some text,', '  and more.', '@license');
  assert.equal(fixWith(RULES, code, off), code);
});

for (const preformatted of ['false', 0, 1, null, [], {}, 'true']) {
  test(`preformatted rejects ${JSON.stringify(preformatted)}`, () => {
    const settings = { 'jsdoc-flow': { preformatted } };
    assert.throws(
      () => linter.verify('', configFor(['reflow'], settings)),
      /settings\['jsdoc-flow'\]\.preformatted must be a boolean/,
    );
  });
}

for (const rule of RULES) {
  test(`${rule} throws on an invalid preformatted`, () => {
    const settings = { 'jsdoc-flow': { preformatted: 'no' } };
    assert.throws(
      () => linter.verify('', configFor([rule], settings)),
      new RegExp(`jsdoc-flow/${rule}.*preformatted`),
    );
  });
}

test('`reflow` takes `preformatted` from the settings, not its options', () => {
  assert.throws(
    () =>
      linter.verify('', [
        {
          plugins: { 'jsdoc-flow': plugin },
          rules: { 'jsdoc-flow/reflow': ['warn', { preformatted: false }] },
        },
      ]),
    /preformatted|additional properties/i,
  );
});

// The exported functions keep what looks like code unless they're told not to.
const text = '/**\n * Some.  Text,\n *   kept  as it is.\n */';
const flowed = '/**\n * Some.  Text, kept as it is.\n */';

test('`reflowComment` takes `preformatted` as an option', () => {
  assert.equal(reflowComment(text, ''), text);
  assert.equal(reflowComment(text, '', 80, {}), text);
  assert.equal(reflowComment(text, '', 80, { preformatted: true }), text);
  assert.equal(reflowComment(text, '', 80, { preformatted: false }), flowed);
});

test('the other exported functions take `preformatted` last', () => {
  assert.equal(fixSpacing(text, ''), text);
  assert.equal(
    fixSpacing(text, '', false),
    '/**\n * Some.  Text,\n *   kept as it is.\n */',
  );
  assert.equal(fixEdges(text, ''), text);
  assert.equal(
    fixEdges(text, '', false),
    '/**\n * Some.  Text,\n * kept  as it is.\n */',
  );
  const tag = '/**\n * @param a - b\n *  ^^^\n */';
  assert.equal(alignTags(tag, ''), tag);
  assert.equal(
    alignTags(tag, '', false),
    '/**\n * @param a - b\n *            ^^^\n */',
  );
});

test("a paragraph's first line never ends where it reads as a pointer", () => {
  const [a, b] = ['a'.repeat(40), 'b'.repeat(40)];
  assert.equal(
    reflowComment(`/**\n * ^^ ~~ ${a} ${b} c d\n */`, '', 20),
    `/**\n * ^^ ~~ ${a}\n * ${b}\n * c d\n */`,
  );
});

// A reflow's output reads the same way the next time, at any width, however
// narrow.  None of these is kept as it is at first, and at some width a wrap
// leaves each with a label on a line of its own, short lines or both.
const labelled = [
  block(
    'Note:  the store is read-only when the note was opened from a snapshot',
  ),
  block(
    'Note:',
    'aaaaaaaaaaaaaaaaaaaa bbbbbbbbbbbbbbbbbbbbbbb ccccccccccccccccccc.',
  ),
  block('Example: aaaa bbbb cccc dddd eeee ffff gggg hhhh iiii jjjj ^^^ kkkk'),
  block('^^^ aaaa bbbb cccc dddd eeee ffff gggg hhhh iiii jjjj ~~ ~~'),
  block('# heading', '^^ ~~ aaaa bbbb cccc dddd eeee ffff'),
  block('- an item', '^^ ~~ aaaa bbbb cccc dddd eeee ffff'),
  block('@param name - ^^ ~~ aaaa bbbb cccc dddd eeee ffff'),
  block('@param name - Note:  aaaa bbbb cccc dddd eeee ffff gggg hhhh'),
];

for (const [k, code] of labelled.entries()) {
  test(`a reflow reads the same the next time:  block ${k + 1}`, () => {
    const start = code.slice(0, code.indexOf('*/') + 2);
    for (let width = 14; width <= 90; width += 4) {
      const fixed = reflowComment(start, '', width);
      assert.equal(reflowComment(fixed, '', width), fixed, `at ${width}`);
    }
  });
}
