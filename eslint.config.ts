import tseslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import type { Rule } from "eslint";
import importX from "eslint-plugin-import-x";
import prettier from "eslint-plugin-prettier/recommended";
import unicorn from "eslint-plugin-unicorn";

// Local rule: flags (does not block) absolute/fixed classes in className literals so a human
// confirms it's a genuine overlay (Design.md §5) rather than layout-via-position. Kept as its
// own rule — separate from the error-level no-restricted-syntax block below — because a single
// no-restricted-syntax invocation can't mix severities across selectors.
const flagStrayPositionRule: Rule.RuleModule = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Flag absolute/fixed classes in className for manual review (Design.md §5).",
    },
    schema: [],
  },
  create(context) {
    return {
      Literal(node: Rule.Node): void {
        if (node.type !== "Literal" || typeof node.value !== "string") return;
        if (!/\b(absolute|fixed)\b/.test(node.value)) return;
        const parent = node.parent;
        if (
          parent.type === "JSXAttribute" &&
          parent.name.type === "JSXIdentifier" &&
          parent.name.name === "className"
        ) {
          context.report({
            node,
            message:
              "absolute/fixed positioning found — confirm this is a genuine overlay (Design.md §5), not spacing.",
          });
        }
      },
    };
  },
};

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
  {
    // Design-system guardrails (project/handoff.md §1/§7): token-bound components only.
    // Scoped to the new design-system files each checkpoint touches — widen this glob as
    // CP2-CP8 migrate more of packages/ui off the legacy indigo system (see PROGRESS.md).
    files: ["packages/ui/src/pages/tokensPreview.tsx"],
    plugins: {
      local: { rules: { "flag-stray-position": flagStrayPositionRule } },
    },
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "JSXAttribute[name.name='style']",
          message: "No inline styles — use Tailwind classes bound to @theme tokens.",
        },
        {
          selector:
            "JSXAttribute[name.name='className'] Literal[value=/#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\\b/]",
          message: "No raw hex literals in className — use a token color class instead.",
        },
        {
          selector: "JSXAttribute[name.name='className'] Literal[value=/\\[\\d+(\\.\\d+)?px\\]/]",
          message:
            "No raw px arbitrary values in className — use a token spacing/size class instead.",
        },
      ],
      "local/flag-stray-position": "warn",
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
