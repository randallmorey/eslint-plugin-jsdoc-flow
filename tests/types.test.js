// Tests that `lib/index.d.ts` matches the plugin:  it's generated from it
// (see `scripts/types.js`), so it must be as the generator writes it now,
// and it must name the plugin's rules, configs and settings.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

import plugin from '../lib/index.js';
import { SETTINGS_SCHEMA } from '../lib/settings.js';
import { DTS, generate, typeOf } from '../scripts/types.js';

const text = readFileSync(DTS, 'utf8');
const source = ts.createSourceFile(DTS, text, ts.ScriptTarget.Latest);

// The names of the members of the type that a declaration in the file has.
const membersOf = (name) => {
  let members;
  const visit = (node) => {
    if (node.name?.text === name) members = node.members ?? node.type?.members;
    else ts.forEachChild(node, visit);
  };
  visit(source);
  assert.ok(members, `index.d.ts declares ${name}`);
  return members.map((m) => m.name.text);
};

// The names of the members of the plugin's `configs` in the file.
const configsOf = () => {
  let names;
  const visit = (node) => {
    if (ts.isPropertySignature(node) && node.name.text === 'configs') {
      names = node.type.members.map((m) => m.name.text);
    } else ts.forEachChild(node, visit);
  };
  visit(source);
  return names;
};

test('index.d.ts is as `npm run types` generates it', async () => {
  assert.equal(text, await generate(), 'run `npm run types`');
});

test('index.d.ts names exactly the plugin rules', () => {
  assert.deepEqual(membersOf('RuleOptions'), Object.keys(plugin.rules));
});

test('index.d.ts names exactly the plugin configs', () => {
  assert.deepEqual(configsOf(), Object.keys(plugin.configs));
});

test('index.d.ts names exactly the settings', () => {
  assert.deepEqual(
    membersOf('Settings'),
    Object.keys(SETTINGS_SCHEMA.properties),
  );
});

test('index.d.ts types the options of exactly the rules that take them', () => {
  const typed = Object.keys(plugin.rules).filter(
    (name) => plugin.rules[name].meta.schema?.length,
  );
  assert.deepEqual(typed, ['reflow', 'single-line']);
  assert.deepEqual(membersOf('ReflowOptions'), [
    'orphans',
    'names',
    'shortWords',
    'hang',
    'widows',
  ]);
  assert.deepEqual(membersOf('SingleLineOptions'), ['allowTags']);
});

test('index.d.ts exports only the plugin and types', () => {
  const values = source.statements.filter(
    (s) =>
      ts.getCombinedModifierFlags(s) & ts.ModifierFlags.Export &&
      !ts.isInterfaceDeclaration(s) &&
      !ts.isTypeAliasDeclaration(s),
  );
  assert.deepEqual(values, []);
  assert.ok(source.statements.some(ts.isExportAssignment));
});

for (const schema of [
  { type: 'object', properties: {} },
  { type: 'object', additionalProperties: false, required: ['a'] },
  { oneOf: [{ type: 'string' }] },
  { type: 'null' },
  { type: ['string', 'number'] },
]) {
  test(`the generator rejects a schema it can't type: ${JSON.stringify(schema)}`, () => {
    assert.throws(() => typeOf(schema), /isn't typed|additionalProperties/);
  });
}
