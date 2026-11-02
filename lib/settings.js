/**
 * The settings all the rules share, from `settings['jsdoc-flow']` in
 * an ESLint config.  A rule's own option can't keep the rules in agreement,
 * so whatever must hold for every rule at once belongs here.  ESLint doesn't
 * validate `settings`, so an invalid value throws here instead of
 * being ignored.
 */
import { inspect } from 'node:util';

/**
 * The pattern of a tag's name, without its `@`, for a rule's schema.
 */
export const TAG_NAME = '^[A-Za-z][\\w-]*$';

/**
 * The tags whose blocks are verbatim unless `verbatimTags` is set.
 */
const VERBATIM_TAGS = ['license', 'preserve', 'copyright'];

/**
 * The settings as the rules use them.
 *
 * @typedef {object} Settings
 * @property {Set<string>} verbatimTags - the names of the tags that keep
 *                                        a whole block as it is
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
 * @param {unknown} value - what a config gives as the plugin's settings
 * @returns {value is { verbatimTags?: unknown }}
 *   whether it's an object other than a list
 */
const isObject = (value) =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Reads the shared settings.  A new setting is one more property here,
 * with a function like `verbatimTagsOf` that validates it and supplies
 * its default.
 *
 * @param {import('eslint').Rule.RuleContext} context - a rule's context
 * @returns {Settings} the settings, with the defaults of those
 *                     that aren't set
 * @throws {TypeError} if a setting is invalid
 */
export function settingsOf({ settings: { 'jsdoc-flow': own = {} } }) {
  if (!isObject(own)) {
    throw new TypeError(
      `settings['jsdoc-flow'] must be an object, not ${inspect(own)}.`,
    );
  }
  return { verbatimTags: verbatimTagsOf(own.verbatimTags) };
}
