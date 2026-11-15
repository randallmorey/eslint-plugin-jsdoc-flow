// Tests for `settings['jsdoc-flow']` as a whole:  its schema, which names
// the settings, and the error on a key it doesn't name.  Each setting's own
// values are tested with the setting.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Linter } from 'eslint';

import plugin from '../lib/index.js';
import { SETTINGS_SCHEMA, settingsOf } from '../lib/settings.js';

const linter = new Linter();
const verifyWith = (rule, own) =>
  linter.verify('/** One. */\n', [
    {
      files: ['**/*.*'],
      plugins: { 'jsdoc-flow': plugin },
      rules: { [`jsdoc-flow/${rule}`]: 'warn' },
      settings: { 'jsdoc-flow': own },
    },
  ]);

const read = (own) => settingsOf({ settings: { 'jsdoc-flow': own } });

const NAMES =
  '`verbatimTags`, `preformatted`, `spaces`, `width`, and `maxHead`';

for (const [key, near] of [
  ['widht', 'width'],
  ['Width', 'width'],
  ['maxhead', 'maxHead'],
  ['space', 'spaces'],
  ['preformated', 'preformatted'],
  ['verbatimTag', 'verbatimTags'],
]) {
  test(`an unknown setting, ${key}, suggests ${near}`, () => {
    assert.throws(() => read({ [key]: 100 }), {
      name: 'TypeError',
      message:
        `settings['jsdoc-flow'] has no setting '${key}'.  Did you mean ` +
        `\`${near}\`?  The settings are ${NAMES}.`,
    });
  });
}

for (const key of ['foo', 'tabWidth', 'hang']) {
  test(`an unknown setting, ${key}, lists the settings`, () => {
    assert.throws(() => read({ [key]: true }), {
      name: 'TypeError',
      message:
        `settings['jsdoc-flow'] has no setting '${key}'.  The settings are ` +
        `${NAMES}.`,
    });
  });
}

test('an unknown setting is an error even beside known ones', () => {
  assert.throws(
    () => read({ width: 100, widht: undefined }),
    /has no setting 'widht'/,
  );
});

for (const rule of Object.keys(plugin.rules)) {
  test(`${rule} throws on an unknown setting`, () => {
    assert.throws(
      () => verifyWith(rule, { widht: 100 }),
      /has no setting 'widht'\. {2}Did you mean `width`\?/,
    );
  });
}

test('the schema names exactly the settings that settingsOf reads', () => {
  assert.equal(SETTINGS_SCHEMA.additionalProperties, false);
  assert.deepEqual(
    Object.keys(settingsOf({ settings: {} })),
    Object.keys(SETTINGS_SCHEMA.properties),
  );
});

// ESLint validates a rule's options against its schema, so a rule whose
// schema is the settings' checks that the schema and the validators agree.
const schemaRule = { meta: { schema: [SETTINGS_SCHEMA] }, create: () => ({}) };
const schemaAccepts = (own) => {
  try {
    linter.verify('', [
      {
        plugins: { s: { rules: { s: schemaRule } } },
        rules: { 's/s': ['warn', own] },
      },
    ]);
    return true;
  } catch {
    return false;
  }
};
const settingsAccepts = (own) => {
  try {
    read(own);
    return true;
  } catch {
    return false;
  }
};

const SAMPLES = {
  verbatimTags: [[], ['license'], ['a-b', 'c'], ['@a'], [''], ['a', 'a'], 'a'],
  preformatted: [true, false, 0, 'true', null],
  spaces: [1, 2, 0, 3, 1.5, '2', null],
  width: [1, 80, 0, -1, 1.5, '80', null],
  maxHead: [0, 0.5, 1, -0.1, 1.1, '0.5', null],
};

test('every setting has samples the schema accepts and rejects', () => {
  assert.deepEqual(
    Object.keys(SAMPLES),
    Object.keys(SETTINGS_SCHEMA.properties),
  );
  for (const [key, values] of Object.entries(SAMPLES)) {
    const verdicts = values.map((value) => schemaAccepts({ [key]: value }));
    assert.deepEqual([...new Set(verdicts)].sort(), [false, true], key);
  }
});

for (const [key, values] of Object.entries(SAMPLES)) {
  for (const value of values) {
    test(`the schema and settingsOf agree on ${key}: ${JSON.stringify(value)}`, () => {
      const own = { [key]: value };
      assert.equal(schemaAccepts(own), settingsAccepts(own));
    });
  }
}

for (const own of [{}, { widht: 1 }]) {
  test(`the schema and settingsOf agree on ${JSON.stringify(own)}`, () => {
    assert.equal(schemaAccepts(own), settingsAccepts(own));
  });
}
