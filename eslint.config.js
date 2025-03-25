import globals from "globals";
import eslint from "@eslint/js";
import tsdoc from "eslint-plugin-tsdoc";
import jsdocPlugin from "eslint-plugin-jsdoc";
import tseslint from "typescript-eslint";
import prettierPlugin from "eslint-plugin-prettier";
import eslintConfigPrettier from "eslint-config-prettier/flat";

export default tseslint.config(
  {
    ignores: ["node_modules/", "dist/"],
  },
  eslint.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ["**/*.{ts,js,mjs,cjs,jsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      tsdoc,
      jsdocPlugin,
      prettierPlugin,
    },
    rules: {
      // ** ES6+ Best Practices **
      "no-var": "error",
      "prefer-const": "error",
      "prefer-rest-params": "error",
      "prefer-spread": "error",

      // ** Functions **
      "no-new-func": "error",
      "no-param-reassign": "error",
      "no-useless-call": "error",
      "no-useless-catch": "error",
      "no-useless-concat": "error",
      "no-useless-return": "error",

      // ** General Best Practices **
      curly: ["error", "all"],
      eqeqeq: ["error", "always"],
      "no-console": "warn",
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-magic-numbers": ["warn", { ignoreArrayIndexes: true, ignore: [0, 1] }],

      // ** Stylistic Rules **
      "arrow-spacing": "error",
      camelcase: "error",
      "comma-dangle": ["error", "never"],
      "keyword-spacing": "error",
      "no-irregular-whitespace": "error",
      "no-mixed-spaces-and-tabs": "error",
      "no-multi-spaces": "error",
      "no-multiple-empty-lines": "error",
      "no-tabs": "error",
      "no-trailing-spaces": "error",
      "no-whitespace-before-property": "error",
      "object-curly-spacing": ["error", "always"],
      quotes: ["error", "single"],
      semi: ["error", "always"],
      "space-before-blocks": ["error", "always"],
      "space-before-function-paren": "error",
      "space-in-parens": ["error", "never"],
      "space-infix-ops": "error",

      // ** Variables **
      "no-shadow": "error",
      "no-shadow-restricted-names": "error",
      "no-undef": "error",
      "no-unused-vars": "warn",
      "no-use-before-define": "error",

      // ** TypeScript **
      "tsdoc/syntax": "warn",

      // **JSDoc**
      "jsdocPlugin/require-jsdoc": "warn",
      "jsdocPlugin/require-param": "warn",
      "jsdocPlugin/require-returns": "warn",
      "jsdocPlugin/check-alignment": "warn",
      "jsdocPlugin/check-indentation": "warn",
      "jsdocPlugin/require-description": "warn",

      // **Prettier**
      "prettierPlugin/prettier": "error",
    },
  },
  eslintConfigPrettier,
);
