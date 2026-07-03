import tseslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import type { Rule } from "eslint";
import importX from "eslint-plugin-import-x";
import prettier from "eslint-plugin-prettier/recommended";
import unicorn from "eslint-plugin-unicorn";

// Plain `eslint`/estree types don't include JSX node types (JSXAttribute, JSXIdentifier,
// JSXExpressionContainer), so walking the JSX ancestor chain needs a locally-typed escape
// hatch rather than `Rule.Node` (which can never narrow to "JSXAttribute" — TS2367/TS2339).
type AstNode = {
  type: string;
  parent?: AstNode;
  name?: { type: string; name: string };
};

function isClassNameAttributeAncestor(node: AstNode | undefined): boolean {
  let current = node;
  while (current) {
    if (current.type === "JSXAttribute") {
      return current.name?.type === "JSXIdentifier" && current.name.name === "className";
    }
    // Template literals nest as JSXExpressionContainer > TemplateLiteral > TemplateElement —
    // keep walking up through both wrapper types to reach the JSXAttribute.
    if (current.type === "JSXExpressionContainer" || current.type === "TemplateLiteral") {
      current = current.parent;
      continue;
    }
    return false;
  }
  return false;
}

// Local rule: flags (does not block) absolute/fixed classes in className literals — plain
// strings and template literals alike — so a human confirms it's a genuine overlay (Design.md
// §5) rather than layout-via-position. Kept as its own rule — separate from the error-level
// no-restricted-syntax block below — because a single no-restricted-syntax invocation can't mix
// severities across selectors.
const flagStrayPositionRule: Rule.RuleModule = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Flag absolute/fixed classes in className for manual review (Design.md §5).",
    },
    schema: [],
  },
  create(context) {
    function checkAndReport(node: Rule.Node, text: string): void {
      if (!/\b(absolute|fixed)\b/.test(text)) return;
      if (!isClassNameAttributeAncestor((node as unknown as AstNode).parent)) return;
      context.report({
        node,
        message:
          "absolute/fixed positioning found — confirm this is a genuine overlay (Design.md §5), not spacing.",
      });
    }
    return {
      Literal(node: Rule.Node): void {
        if (node.type !== "Literal" || typeof node.value !== "string") return;
        checkAndReport(node, node.value);
      },
      TemplateElement(node: Rule.Node): void {
        if (node.type !== "TemplateElement") return;
        checkAndReport(node, node.value.raw);
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
          // className="..." (plain string literal)
          selector:
            "JSXAttribute[name.name='className'] Literal[value=/#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\\b/]",
          message: "No raw hex literals in className — use a token color class instead.",
        },
        {
          // className={`... ${x}`} (template literal — descendant match reaches through
          // JSXExpressionContainer > TemplateLiteral to each TemplateElement quasi)
          selector:
            "JSXAttribute[name.name='className'] TemplateElement[value.raw=/#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\\b/]",
          message: "No raw hex literals in className — use a token color class instead.",
        },
        {
          selector: "JSXAttribute[name.name='className'] Literal[value=/\\[\\d+(\\.\\d+)?px\\]/]",
          message:
            "No raw px arbitrary values in className — use a token spacing/size class instead.",
        },
        {
          selector:
            "JSXAttribute[name.name='className'] TemplateElement[value.raw=/\\[\\d+(\\.\\d+)?px\\]/]",
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
