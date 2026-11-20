/**
 * The settings all the rules share, from `settings['jsdoc-flow']` in
 * an ESLint config.  A rule's own option can't keep the rules in agreement,
 * so whatever must hold for every rule at once belongs here.  ESLint doesn't
 * validate `settings`, so an invalid value or an unknown key throws here
 * instead of being ignored.
 */
import { inspect } from 'node:util';

import { MAX_HEAD, WIDTH } from './flow.js';

/**
 * The pattern of a tag's name, without its `@`, for a rule's schema.
 */
export const TAG_NAME = '^[A-Za-z][\\w-]*$';

/**
 * The tags whose blocks are verbatim unless `verbatimTags` is set.
 */
const VERBATIM_TAGS = ['license', 'preserve', 'copyright'];

/**
 * The JSON schema of `settings['jsdoc-flow']`, which names the settings:
 * `settingsOf` rejects any other key, and the types in `index.d.ts` are
 * generated from it.  Each setting's validator below checks its value.
 */
export const SETTINGS_SCHEMA = {
  type: 'object',
  properties: {
    verbatimTags: {
      description:
        'The names of the tags, without the `@`, that make every rule leave ' +
        "a block as it is.  It replaces the default, `['license', " +
        "'preserve', 'copyright']`, so `[]` turns it off.",
      type: 'array',
      items: { type: 'string', pattern: TAG_NAME },
      uniqueItems: true,
    },
    preformatted: {
      description:
        'Whether what looks like unfenced code, a diagram, or a list laid ' +
        'out in columns is kept as it is, `true` unless set.',
      type: 'boolean',
    },
    spaces: {
      description:
        'How many spaces follow a sentence end or a colon, `2` unless set.',
      enum: [1, 2],
    },
    width: {
      description:
        'The widest a line should be, prefix included, `80` unless set.',
      type: 'integer',
      minimum: 1,
    },
    maxHead: {
      description:
        "The widest a tag's head may be and still have its description " +
        'begin beside it, as a fraction of the width, `0.55` unless set.',
      type: 'number',
      minimum: 0,
      maximum: 1,
    },
  },
  additionalProperties: false,
};

/**
 * The names of the settings.
 */
const NAMES = Object.keys(SETTINGS_SCHEMA.properties);

/**
 * The settings as the rules use them.
 *
 * @typedef {object} Settings
 * @property {Set<string>} verbatimTags - the names of the tags that keep
 *                                        a whole block as it is
 * @property {boolean} preformatted - whether to keep what looks like unfenced
 *                                    code, diagrams, and lists laid out in
 *                                    columns as they are
 * @property {1 | 2} spaces - how many spaces follow a sentence end or a colon
 * @property {number} width - the nominal width of a line, prefix included
 * @property {number} maxHead - the widest a tag's head may be and still have
 *                              its description begin beside it, as a fraction
 *                              of the width
 */

/**
 * @param {unknown} name - an item of a setting's list
 * @returns {boolean} whether it's a tag's name, without its `@`
 */
const isTagName = (name) =>
  typeof name === 'string' && new RegExp(TAG_NAME).test(name);

/**
 * A value replaces the default rather than adding to it, so `[]` opts out.
 * Spreading the list makes a hole in it an `undefined`, which isn't a name.
 *
 * @param {unknown} [tags] - the `verbatimTags` setting, if it's set
 * @returns {Set<string>} the names it holds
 */
function verbatimTagsOf(tags = VERBATIM_TAGS) {
  if (
    !Array.isArray(tags) ||
    ![...tags].every(isTagName) ||
    new Set(tags).size !== tags.length
  ) {
    throw new TypeError(
      "settings['jsdoc-flow'].verbatimTags must be an array of unique tag " +
        `names without the \`@\`, such as ['license'], not ${inspect(tags)}.`,
    );
  }
  return new Set(tags);
}

/**
 * @param {unknown} [preformatted] - the `preformatted` setting, if it's set
 * @returns {boolean} whether to keep what looks like unfenced code and
 *                    diagrams as they are, which is `true` unless it's set
 */
function preformattedOf(preformatted = true) {
  if (typeof preformatted !== 'boolean') {
    throw new TypeError(
      "settings['jsdoc-flow'].preformatted must be a boolean, not " +
        `${inspect(preformatted)}.`,
    );
  }
  return preformatted;
}

/**
 * @param {unknown} [spaces] - the `spaces` setting, if it's set
 * @returns {1 | 2} how many spaces follow a sentence end or a colon, which is
 *                  `2` unless it's set
 */
function spacesOf(spaces = 2) {
  if (spaces !== 1 && spaces !== 2) {
    throw new TypeError(
      `settings['jsdoc-flow'].spaces must be 1 or 2, not ${inspect(spaces)}.`,
    );
  }
  return spaces;
}

/**
 * @param {unknown} [width] - the `width` setting, if it's set
 * @returns {number} the nominal width of a line, prefix included, which is
 *                   `WIDTH` unless it's set
 */
function widthOf(width = WIDTH) {
  if (typeof width !== 'number' || !Number.isInteger(width) || width < 1) {
    throw new TypeError(
      "settings['jsdoc-flow'].width must be a positive integer, not " +
        `${inspect(width)}.`,
    );
  }
  return width;
}

/**
 * @param {unknown} [maxHead] - the `maxHead` setting, if it's set
 * @returns {number} the widest a tag's head may be, as a fraction of
 *                   the width, which is `MAX_HEAD` unless it's set
 */
function maxHeadOf(maxHead = MAX_HEAD) {
  if (typeof maxHead !== 'number' || !(maxHead >= 0 && maxHead <= 1)) {
    throw new TypeError(
      "settings['jsdoc-flow'].maxHead must be a number from 0 to 1, not " +
        `${inspect(maxHead)}.`,
    );
  }
  return maxHead;
}

/**
 * @param {unknown} value - what a config gives as the plugin's settings
 * @returns {value is { verbatimTags?: unknown, preformatted?: unknown, spaces?: unknown, width?: unknown, maxHead?: unknown }}
 *   whether it's an object other than a list
 */
const isObject = (value) =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * @param {string} a - a word
 * @param {string} b - another
 * @returns {number} how many letters must be inserted, deleted or replaced to
 *                   turn one into the other, ignoring case
 */
function distance(a, b) {
  const [x, y] = [a.toLowerCase(), b.toLowerCase()];
  let row = Array.from({ length: y.length + 1 }, (_, j) => j);
  for (let i = 1; i <= x.length; i++) {
    const next = [i];
    for (let j = 1; j <= y.length; j++) {
      const replace = row[j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1);
      next[j] = Math.min(row[j] + 1, next[j - 1] + 1, replace);
    }
    row = next;
  }
  return row[y.length];
}

/**
 * @param {string} key - a key that isn't a setting
 * @returns {TypeError} the error that names it, and suggests the setting it's
 *                      closest to, if one is close
 */
function unknownSetting(key) {
  const [near] = NAMES.filter((n) => distance(key, n) <= 2).sort(
    (a, b) => distance(key, a) - distance(key, b),
  );
  const hint = near ? `  Did you mean \`${near}\`?` : '';
  const names = NAMES.map((n) => `\`${n}\``);
  return new TypeError(
    `settings['jsdoc-flow'] has no setting ${inspect(key)}.${hint}  ` +
      `The settings are ${names.slice(0, -1).join(', ')}, and ${names.at(-1)}.`,
  );
}

/**
 * Reads the shared settings.  A new setting is one more property here and in
 * `SETTINGS_SCHEMA`, with a function like `verbatimTagsOf` that validates it
 * and supplies its default.
 *
 * @param {import('eslint').Rule.RuleContext} context - a rule's context
 * @returns {Settings} the settings, with the defaults of those
 *                     that aren't set
 * @throws {TypeError} if a setting is invalid, or a key isn't a setting
 */
export function settingsOf({ settings: { 'jsdoc-flow': own = {} } }) {
  if (!isObject(own)) {
    throw new TypeError(
      `settings['jsdoc-flow'] must be an object, not ${inspect(own)}.`,
    );
  }
  const unknown = Object.keys(own).find((key) => !NAMES.includes(key));
  if (unknown !== undefined) throw unknownSetting(unknown);
  return {
    verbatimTags: verbatimTagsOf(own.verbatimTags),
    preformatted: preformattedOf(own.preformatted),
    spaces: spacesOf(own.spaces),
    width: widthOf(own.width),
    maxHead: maxHeadOf(own.maxHead),
  };
}
