// A typed ESLint config that uses the plugin, which `npm run lint` compiles
// with both nodenext and bundler resolution.  Each `@ts-expect-error` is
// a mistake that the types must catch.
import type { ESLint, Linter } from 'eslint';
import jsdocFlow from 'eslint-plugin-jsdoc-flow';
import type {
  ReflowOptions,
  RuleOptions,
  Rules,
  Settings,
  SingleLineOptions,
} from 'eslint-plugin-jsdoc-flow';

export const config: Linter.Config[] = [
  jsdocFlow.configs.recommended,
  {
    plugins: { 'jsdoc-flow': jsdocFlow },
    settings: {
      'jsdoc-flow': {
        verbatimTags: ['license'],
        preformatted: false,
        spaces: 1,
        width: 100,
        maxHead: 0.5,
      } satisfies Settings,
    },
    rules: {
      'jsdoc-flow/reflow': [
        'warn',
        { hang: false, orphans: { clause: false } },
      ],
      'jsdoc-flow/single-line': ['error', { allowTags: ['type'] }],
      'jsdoc-flow/star-align': 'off',
    } satisfies Rules,
  },
];

export const plugin: ESLint.Plugin = jsdocFlow;
export const rule = jsdocFlow.rules['single-line'];
export const options: [ReflowOptions?, SingleLineOptions?] = [
  { widows: 0 },
  { allowTags: [] },
];
export const names: (keyof RuleOptions)[] = ['reflow', 'single-line'];

// @ts-expect-error: `reflw` isn't a rule.
export const typo = jsdocFlow.rules.reflw;

export const settingTypo = {
  // @ts-expect-error: `widht` isn't a setting.
  widht: 100,
} satisfies Settings;

export const settingValue = {
  // @ts-expect-error: `spaces` is 1 or 2.
  spaces: 3,
} satisfies Settings;

export const optionTypo = {
  // @ts-expect-error: `hnag` isn't an option of `reflow`.
  'jsdoc-flow/reflow': ['warn', { hnag: false }],
} satisfies Rules;

export const optionValue = {
  // @ts-expect-error: `allowTags` is a list.
  'jsdoc-flow/single-line': ['warn', { allowTags: 'type' }],
} satisfies Rules;

export const noOptions = {
  // @ts-expect-error: `star-align` takes no options.
  'jsdoc-flow/star-align': ['warn', {}],
} satisfies Rules;

export const ruleTypo = {
  // @ts-expect-error: `jsdoc-flow/reflw` isn't a rule.
  'jsdoc-flow/reflw': 'warn',
} satisfies Rules;
