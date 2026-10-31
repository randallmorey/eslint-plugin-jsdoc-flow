import globals from 'globals';
import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import eslintConfigPrettier from 'eslint-config-prettier';
import n from 'eslint-plugin-n';
import jsdoc from 'eslint-plugin-jsdoc';

import jsdocFlow from './lib/index.js';

export default defineConfig([
  js.configs.recommended,
  n.configs['flat/recommended-module'],
  {
    languageOptions: {
      sourceType: 'module',
      ecmaVersion: 'latest',
      globals: { ...globals.node },
    },
    linterOptions: {
      reportUnusedDisableDirectives: 'error',
    },
  },
  /**
   * The plugin's source is documented with JSDoc, and its comments are
   * flowed by the plugin itself.  Tests are exempt.
   */
  {
    files: ['lib/**/*.js'],
    extends: [jsdoc.configs['flat/recommended'], jsdocFlow.configs.recommended],
    rules: {
      /**
       * Require JSDoc on named functions, methods, and top-level arrow
       * functions (but not the closures inside a function).  The fixer is
       * disabled so `--fix` doesn't insert empty stubs.
       */
      'jsdoc/require-jsdoc': [
        'warn',
        {
          require: { FunctionDeclaration: true, MethodDefinition: true },
          contexts: [
            ':matches(Program, ExportNamedDeclaration) > VariableDeclaration' +
              ' > VariableDeclarator > :function',
          ],
          enableFixer: false,
        },
      ],
      /**
       * Require exactly one blank line between a JSDoc description and its
       * first tag; leave lines between tags unconstrained.
       */
      'jsdoc/tag-lines': ['warn', 'any', { startLines: 1 }],
    },
  },
  eslintConfigPrettier,
]);
