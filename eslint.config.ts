import tseslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import importX from "eslint-plugin-import-x";
import prettier from "eslint-plugin-prettier/recommended";
import unicorn from "eslint-plugin-unicorn";

export default [
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: [
          "./tsconfig.json",
          "./packages/agent/tsconfig.json",
          "./packages/agent/tsconfig.tooling.json",
          "./packages/ui/tsconfig.json",
          "./packages/token-refresh/tsconfig.json",
        ],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
      "import-x": importX,
      unicorn,
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/explicit-function-return-type": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/consistent-type-imports": ["error", { prefer: "type-imports" }],
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],

      "import-x/order": [
        "error",
        {
          groups: ["builtin", "external", "internal", "parent", "sibling", "index"],
          "newlines-between": "always",
          alphabetize: { order: "asc" },
        },
      ],
      "import-x/no-cycle": "error",
      "import-x/no-unresolved": "off",

      "unicorn/filename-case": ["error", { case: "camelCase" }],
      "unicorn/no-array-for-each": "error",
      "unicorn/prefer-module": "error",
      "unicorn/prevent-abbreviations": [
        "error",
        {
          allowList: {
            db: true,
            env: true,
            fn: true,
            props: true,
            ref: true,
            e: true,
            err: true,
          },
        },
      ],
    },
  },
  prettier,
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "packages/*/dist/**",
      "docs/**",
      "**/*.js",
      "packages/ui/vite.config.ts",
    ],
  },
];
