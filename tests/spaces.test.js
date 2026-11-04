// Tests for the `spaces` setting, which `sentence-spacing`, `colon-spacing`,
// `word-spacing`, `tag-align` and `reflow` share.  The tests of all the rules
// together, in `fix.test.js`, check the cases here, and run all of their own
// with one space too.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Linter, RuleTester } from 'eslint';

import plugin, {
  alignTags,
  fixEdges,
  fixSpacing,
  reflowComment,
} from '../lib/index.js';
import { block, testFindingRules } from './helpers.js';
import { invalid, valid } from './cases/reflow.js';
import {
  colonInvalid,
  sentenceInvalid,
  spacingMixed,
  spacingValid,
  wordInvalid,
} from './cases/spacing.js';
import {
  oneSpace,
  oneSpaceColonInvalid,
  oneSpaceReflowInvalid,
  oneSpaceReflowValid,
  oneSpaceSentenceInvalid,
  oneSpaceValid,
  oneSpaceWordInvalid,
} from './cases/spaces.js';

const RULES = Object.keys(plugin.rules);
const linter = new Linter();
const configFor = (rules, settings, options = []) => [
  {
    files: ['**/*.*'],
    plugins: { 'jsdoc-flow': plugin },
    rules: Object.fromEntries(
      rules.map((r) => [
        `jsdoc-flow/${r}`,
        ['warn', ...(r === 'reflow' ? options : [])],
      ]),
    ),
    ...(settings && { settings }),
  },
];
const fixWith = (rules, code, settings) =>
  linter.verifyAndFix(code, configFor(rules, settings)).output;
const two = { 'jsdoc-flow': { spaces: 2 } };
const textOf = (code) => code.slice(0, code.indexOf('*/') + 2);

testFindingRules(
  {
    'sentence-spacing': oneSpaceSentenceInvalid,
    'colon-spacing': oneSpaceColonInvalid,
    'word-spacing': oneSpaceWordInvalid,
  },
  oneSpaceValid,
);

new RuleTester().run('jsdoc-flow/reflow', plugin.rules.reflow, {
  valid: [
    ...oneSpaceReflowValid,
    ...oneSpaceReflowInvalid.map(({ name, output, settings }) => ({
      name: `idempotent:  ${name}`,
      code: output,
      settings,
    })),
  ],
  invalid: oneSpaceReflowInvalid,
});

new RuleTester().run('jsdoc-flow/tag-align', plugin.rules['tag-align'], {
  valid: [
    {
      name: "a tag's continuation lines at its one-space column",
      code: block('@param name: the description,', '             continued'),
      settings: oneSpace,
    },
    {
      name: "a tag's continuation lines at its two-space column",
      code: block('@param name:  the description,', '              continued'),
    },
  ],
  invalid: [
    {
      name: "a tag's continuation lines at its two-space column, with one space",
      code: block('@param name:  the description,', '              continued'),
      output: block('@param name:  the description,', '             continued'),
      settings: oneSpace,
      errors: [{ messageId: 'align', data: { column: 17 } }],
    },
    {
      name: "a tag's continuation lines at its one-space column, with two",
      code: block('@param name: the description,', '             continued'),
      output: block('@param name: the description,', '              continued'),
      errors: [{ messageId: 'align', data: { column: 18 } }],
    },
  ],
});

// The default.
for (const c of [
  ...spacingValid,
  ...sentenceInvalid,
  ...colonInvalid,
  ...wordInvalid,
  ...spacingMixed,
  ...valid,
  ...invalid,
]) {
  test(`\`spaces: 2\` is the same as unset:  ${c.name}`, () => {
    // The case's own settings stay, such as its `width`.
    const reports = (own) => {
      const base = c.settings?.['jsdoc-flow'];
      const settings = (own || base) && { 'jsdoc-flow': { ...base, ...own } };
      return linter
        .verify(
          c.code,
          [
            {
              ...configFor(RULES, settings, c.options)[0],
              ...(c.languageOptions && { languageOptions: c.languageOptions }),
            },
          ],
          { filename: c.filename ?? 'x.js' },
        )
        .map((m) => [m.ruleId, m.line, m.column, m.message, m.fix]);
    };
    assert.deepEqual(reports(two['jsdoc-flow']), reports());
    assert.deepEqual(reports({}), reports());
  });
}

test('with two spaces, the reflowed block is as it always was', () => {
  const rules = RULES.filter(
    (r) => r !== 'sentence-spacing' && r !== 'colon-spacing',
  );
  const code = block('One sentence. Another: here.');
  const joined = block('One sentence. Another: here.', 'And more.');
  assert.equal(fixWith(rules, code), code);
  assert.equal(
    fixWith(rules, joined),
    block('One sentence.  Another:  here.  And more.'),
  );
});

test('with one space, the reflowed block keeps its gaps', () => {
  const rules = RULES.filter(
    (r) => r !== 'sentence-spacing' && r !== 'colon-spacing',
  );
  const code = block('One sentence. Another: here.');
  const joined = block('One sentence. Another: here.', 'And more.');
  assert.equal(fixWith(rules, code, oneSpace), code);
  assert.equal(
    fixWith(rules, joined, oneSpace),
    block('One sentence. Another: here. And more.'),
  );
});

test('with one space, `One.  Two:  yes.` becomes `One. Two: yes.`', () => {
  const code = block('One.  Two:  yes.');
  assert.equal(fixWith(RULES, code, oneSpace), block('One. Two: yes.'));
  assert.deepEqual(
    linter.verify(block('One. Two: yes.'), configFor(RULES, oneSpace)),
    [],
  );
});

test('with one space, those rules off leave a gap until a reflow', () => {
  const rules = RULES.filter(
    (r) => r !== 'sentence-spacing' && r !== 'colon-spacing',
  );
  const code = block('One.  Two:  yes.');
  assert.deepEqual(linter.verify(code, configFor(rules, oneSpace)), []);
  assert.equal(fixWith(rules, code, oneSpace), code);
});

test('`word-spacing` leaves sentence and colon gaps to their own rules', () => {
  const code = block('One.  Two:  yes.');
  for (const settings of [undefined, oneSpace]) {
    assert.deepEqual(
      linter.verify(code, configFor(['word-spacing'], settings)),
      [],
    );
  }
});

// The hint that two spaces after an abbreviation end a sentence.
const hinted = [
  ['He lives on Elm St.  Then more.', 'He lives on Elm St. Then more.'],
  ['He met Paul.  St. Paul was there.', 'He met Paul. St. Paul was there.'],
  ['A token, e.g.  this one.', 'A token, e.g. this one.'],
  ['Many keys, incl.  Then more.', 'Many keys, incl. Then more.'],
];

for (const [wide, narrow] of hinted) {
  test(`with two spaces, the hint holds:  ${wide}`, () => {
    assert.equal(fixWith(RULES, block(wide)), block(wide));
    assert.equal(reflowComment(textOf(block(wide)), ''), textOf(block(wide)));
  });

  test(`with one space, the hint is gone:  ${wide}`, () => {
    assert.equal(fixWith(RULES, block(wide), oneSpace), block(narrow));
    assert.equal(fixWith(RULES, block(narrow), oneSpace), block(narrow));
    assert.deepEqual(
      linter.verify(block(narrow), configFor(RULES, oneSpace)),
      [],
    );
  });
}

// With two spaces, a line never breaks after an abbreviation that two spaces
// make a sentence end, since the break would lose them.  With one space, how
// wide the gap is makes no difference to where a line breaks.
test('a gap after `St.` changes the line breaks only with two spaces', () => {
  const text = (gap) =>
    `/**\n * words and words and words on Elm St.${gap}Then more words here.\n */`;
  const limits = { names: false, orphans: { sentence: false } };
  const one = { ...limits, spaces: 1 };
  const broken =
    '/**\n * words and words and words on Elm St.\n * Then more words here.\n */';
  assert.equal(reflowComment(text(' '), '', 40, limits), broken);
  assert.equal(
    reflowComment(text('  '), '', 40, limits),
    '/**\n * words and words and words on Elm\n * St.  Then more words here.\n */',
  );
  assert.equal(reflowComment(text(' '), '', 40, one), broken);
  assert.equal(reflowComment(text('  '), '', 40, one), broken);
});

// Wrapped at any width, a one-space block reads the same the next time, and
// how wide its gaps were in the source makes no difference.
const flowed = [
  block(
    'Aaaa bbbb.  Cccc dddd:  eeee ffff, e.g.  gggg hhhh etc.  Iiii on Elm St.  Then',
    'jjjj kkkk.  St. Paul llll mmmm, Mr.  Smith nnnn oooo!  Pppp?  Qqqq rrrr:  ssss.',
  ),
  block(
    '@param name:  the description.  More of it:  this, which goes on for a while',
    '  and so on, etc.  Then more.',
    '@returns {string}:  aaaa bbbb.  Cccc dddd eeee ffff gggg hhhh iiii jjjj kkkk',
  ),
  block(
    '- a bullet',
    'wrapped.  Aaaa bbbb:  cccc dddd eeee ffff gggg hhhh iiii',
  ),
  block(
    '@param {{ aaaaaaaaaaaaaaaaaaaa: string, bbbbbbbbbb: number }} name:  aaaa.',
    'Bbbb cccc:  dddd eeee ffff gggg hhhh iiii jjjj kkkk llll mmmm nnnn oooo pppp',
  ),
  block(
    'Some text.  With a hard break:  here.  <br>',
    'And more.  After it:  here.',
  ),
];

for (const [k, code] of flowed.entries()) {
  test(`a one-space reflow is stable at any width:  block ${k + 1}`, () => {
    const start = textOf(code);
    const narrow = start.replace(/(?<=\S) {2,}(?=\S)/g, ' ');
    const wide = start.replace(/(?<=[^\s*]) (?=\S)/g, '  ');
    const options = { spaces: 1 };
    for (let width = 14; width <= 100; width += 3) {
      const fixed = reflowComment(start, '', width, options);
      assert.equal(
        reflowComment(fixed, '', width, options),
        fixed,
        `at ${width}`,
      );
      assert.equal(
        reflowComment(narrow, '', width, options),
        fixed,
        `at ${width}`,
      );
      if (!/^ \* (?:@|- )/m.test(start))
        assert.equal(
          reflowComment(wide, '', width, options),
          fixed,
          `at ${width}`,
        );
    }
  });

  test(`a one-space reflow settles at any width:  block ${k + 1}`, () => {
    for (const width of [20, 30, 40, 50, 60, 70, 80, 90, 100]) {
      const settings = { 'jsdoc-flow': { spaces: 1, width } };
      const all = fixWith(RULES, code, settings);
      for (const rule of RULES) {
        const rest = RULES.filter((r) => r !== rule);
        const first = fixWith(rest, fixWith([rule], code, settings), settings);
        assert.equal(first, all, `${rule} first at ${width}`);
      }
      assert.equal(fixWith(RULES, all, settings), all, `at ${width}`);
    }
  });
}

test('a line holds more with one space than with two', () => {
  const words = ['Aaaa bbbb cccc dddd.', 'Eeee ffff gggg hhhh:'];
  const rest = 'iiii jjjj kkkk llll mmmm';
  const text = `/**\n * ${words.join(' ')} ${rest} nnnn oo. Qqqq rrrr ssss tttt.\n */`;
  assert.equal(
    reflowComment(text, ''),
    `/**\n * ${words.join('  ')}  ${rest}\n * nnnn oo.  Qqqq rrrr ssss tttt.\n */`,
  );
  assert.equal(
    reflowComment(text, '', 80, { spaces: 1 }),
    `/**\n * ${words.join(' ')} ${rest} nnnn oo.\n * Qqqq rrrr ssss tttt.\n */`,
  );
});

test("a tag's head is narrower with one space, so its description stays", () => {
  // Its head is 45 columns with two spaces, past the limit of 44, and 44 with
  // one, so the description starts on its line only with one space.
  const name = 'n'.repeat(30);
  const words = 'aaaa bbbb cccc dddd eeee ffff gggg hhhh iiii jjjj';
  const text = `/**\n * @param {T} ${name}x: ${words}\n */`;
  assert.equal(
    reflowComment(text, '', 80),
    `/**\n * @param {T} ${name}x:\n *   ${words}\n */`,
  );
  assert.equal(
    reflowComment(text, '', 80, { spaces: 1 }),
    `/**\n * @param {T} ${name}x: aaaa bbbb cccc dddd eeee ffff\n *` +
      `${' '.repeat(44 + 1)}gggg hhhh iiii jjjj\n */`,
  );
});

test('a one-line block fits with one space where it would not with two', () => {
  const text = `/** ${'a'.repeat(35)}. ${'b'.repeat(35)}. */`;
  assert.equal(reflowComment(text, '', 82, { spaces: 1 }), text);
  assert.notEqual(reflowComment(text, '', 82), text);
});

// What the rules say.
test('the messages say what the setting says', () => {
  const messages = (code, rule, settings) =>
    linter.verify(code, configFor([rule], settings)).map((m) => m.message);
  const narrow = block('One. Two: three.');
  const wide = block('One.  Two:  three.');
  assert.deepEqual(messages(narrow, 'sentence-spacing'), [
    'Two spaces should follow a sentence end.',
  ]);
  assert.deepEqual(messages(narrow, 'colon-spacing'), [
    'Two spaces should follow a colon.',
  ]);
  assert.deepEqual(messages(narrow, 'sentence-spacing', two), [
    'Two spaces should follow a sentence end.',
  ]);
  assert.deepEqual(messages(wide, 'sentence-spacing', oneSpace), [
    'One space should follow a sentence end.',
  ]);
  assert.deepEqual(messages(wide, 'colon-spacing', oneSpace), [
    'One space should follow a colon.',
  ]);
});

test('no description or message says two spaces outright', () => {
  for (const rule of ['sentence-spacing', 'colon-spacing', 'word-spacing']) {
    const { docs, messages } = plugin.rules[rule].meta;
    assert.doesNotMatch(docs.description, /two spaces?/i, rule);
    for (const message of Object.values(messages))
      assert.doesNotMatch(message, /two spaces?/i, rule);
  }
});

// The setting itself.
for (const spaces of [
  0,
  3,
  1.5,
  -1,
  '1',
  '2',
  true,
  false,
  null,
  [],
  [1],
  {},
  NaN,
]) {
  test(`spaces rejects ${String(JSON.stringify(spaces))} (${typeof spaces})`, () => {
    const settings = { 'jsdoc-flow': { spaces } };
    assert.throws(
      () => linter.verify('', configFor(['reflow'], settings)),
      /settings\['jsdoc-flow'\]\.spaces must be 1 or 2/,
    );
  });
}

for (const rule of RULES) {
  test(`${rule} throws on an invalid spaces`, () => {
    const settings = { 'jsdoc-flow': { spaces: 3 } };
    assert.throws(
      () => linter.verify('', configFor([rule], settings)),
      new RegExp(`jsdoc-flow/${rule}.*spaces`),
    );
  });

  test(`${rule} takes spaces at 1 and 2`, () => {
    for (const spaces of [1, 2]) {
      const settings = { 'jsdoc-flow': { spaces } };
      assert.deepEqual(linter.verify('', configFor([rule], settings)), []);
    }
  });
}

test('a later config replaces an earlier setting and keeps the rest', () => {
  const [config] = configFor(['sentence-spacing']);
  const reports = (...settings) =>
    linter.verify(block('One.  Two.'), [
      config,
      ...settings.map((s) => ({ settings: { 'jsdoc-flow': s } })),
    ]).length;
  assert.equal(reports(), 0);
  assert.equal(reports({ spaces: 1 }), 1);
  assert.equal(reports({ spaces: 1 }, { spaces: 2 }), 0);
  assert.equal(reports({ spaces: 1 }, {}), 1);
  assert.equal(reports({ preformatted: false }), 0);
});

test('`reflow` takes `spaces` from the settings, not its options', () => {
  assert.throws(
    () => linter.verify('', configFor(['reflow'], undefined, [{ spaces: 1 }])),
    /spaces|additional properties/i,
  );
});

test('the other settings still apply with one space', () => {
  const settings = { 'jsdoc-flow': { spaces: 1, preformatted: false } };
  assert.equal(
    fixWith(RULES, block('One.  Two,', '  kept.  Three.'), settings),
    block('One. Two, kept. Three.'),
  );
  assert.equal(
    fixWith(RULES, block('@license One.  Two.'), oneSpace),
    block('@license One.  Two.'),
  );
});

// The exported functions.
test('`reflowComment` takes `spaces` as an option', () => {
  const text = '/** One. Two: three. */';
  const wide = '/** One.  Two:  three. */';
  assert.equal(reflowComment(text, ''), wide);
  assert.equal(reflowComment(text, '', 80, { spaces: 2 }), wide);
  assert.equal(reflowComment(text, '', 80, { spaces: 1 }), text);
  assert.equal(reflowComment(wide, '', 80, { spaces: 1 }), text);
});

test('the other exported functions take `spaces` as an option', () => {
  const text = '/** One. Two: three. */';
  const wide = '/** One.  Two:  three. */';
  assert.equal(fixSpacing(text, ''), wide);
  assert.equal(fixSpacing(text, '', {}), wide);
  assert.equal(fixSpacing(text, '', { spaces: 2 }), wide);
  assert.equal(fixSpacing(wide, '', { spaces: 1 }), text);
  assert.equal(fixSpacing(text, '', { spaces: 1 }), text);
  assert.equal(
    fixEdges('/**  One.  Two.   */', '', { spaces: 1 }),
    '/** One.  Two. */',
  );
  const tag = '/**\n * @param a: b,\n *   c\n */';
  assert.equal(
    alignTags(tag, ''),
    '/**\n * @param a: b,\n *            c\n */',
  );
  assert.equal(
    alignTags(tag, '', { spaces: 1 }),
    '/**\n * @param a: b,\n *           c\n */',
  );
});

test('`spaces` and `preformatted` go together', () => {
  const text = '/**\n * Some.  Text,\n *   kept  as it is.\n */';
  assert.equal(
    fixSpacing(text, '', { spaces: 1 }),
    '/**\n * Some. Text,\n *   kept  as it is.\n */',
  );
  assert.equal(
    fixSpacing(text, '', { spaces: 1, preformatted: false }),
    '/**\n * Some. Text,\n *   kept as it is.\n */',
  );
  assert.equal(
    reflowComment(text, '', 80, { spaces: 1, preformatted: false }),
    '/**\n * Some. Text, kept as it is.\n */',
  );
});
