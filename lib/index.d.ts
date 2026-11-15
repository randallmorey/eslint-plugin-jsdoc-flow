import type { ESLint, Linter, Rule } from 'eslint';

declare const plugin: ESLint.Plugin & {
  meta: { name: string; version: string };
  rules: {
    reflow: Rule.RuleModule;
    'sentence-spacing': Rule.RuleModule;
    'colon-spacing': Rule.RuleModule;
    'word-spacing': Rule.RuleModule;
    'no-extra-punctuation-space': Rule.RuleModule;
    'tag-spacing': Rule.RuleModule;
    'bullet-spacing': Rule.RuleModule;
    'no-exotic-whitespace': Rule.RuleModule;
    'star-align': Rule.RuleModule;
    'text-indent': Rule.RuleModule;
    'no-trailing-space': Rule.RuleModule;
    'tag-align': Rule.RuleModule;
    'bullet-align': Rule.RuleModule;
    'single-line': Rule.RuleModule;
  };
  configs: { recommended: Linter.Config };
};

export default plugin;
