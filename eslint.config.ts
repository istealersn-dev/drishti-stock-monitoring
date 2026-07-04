import tseslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import type { Rule } from "eslint";
import importX from "eslint-plugin-import-x";
import prettier from "eslint-plugin-prettier/recommended";
import unicorn from "eslint-plugin-unicorn";

// AST node-type strings used by isClassNameAttributeAncestor's walk, named once so a typo
// fails to compile as an unused/mismatched literal instead of silently no-op'ing at runtime.
const NODE_TYPE_JSX_ATTRIBUTE = "JSXAttribute";
const NODE_TYPE_JSX_IDENTIFIER = "JSXIdentifier";
const NODE_TYPE_JSX_EXPRESSION_CONTAINER = "JSXExpressionContainer";
const NODE_TYPE_TEMPLATE_LITERAL = "TemplateLiteral";
const CLASS_NAME_ATTRIBUTE = "className";

// Plain `eslint`/estree types don't include JSX node types (JSXAttribute, JSXIdentifier,
// JSXExpressionContainer), so walking the JSX ancestor chain needs a locally-typed escape
// hatch rather than `Rule.Node` (which can never narrow to "JSXAttribute" — TS2367/TS2339).
// Accepted tradeoff: the cast has no runtime shape check, but ESLint's Node objects are
// guaranteed by contract to carry a string `.type`, so this only breaks if ESLint's own AST
// shape changes — at which point every other selector in this file breaks identically.
type AstNode = {
  type: string;
  parent?: AstNode;
  name?: { type: string; name: string };
};

/**
 * Walks up the AST from a Literal/TemplateElement's parent to find whether it sits inside a
 * `className` JSX attribute, passing through TemplateLiteral/JSXExpressionContainer wrappers.
 * @param node - the starting node's parent (undefined at the AST root)
 * @returns true if the node is nested inside `className={...}` or `className="..."`
 */
function isClassNameAttributeAncestor(node: AstNode | undefined): boolean {
  let current = node;
  while (current) {
    if (current.type === NODE_TYPE_JSX_ATTRIBUTE) {
      return (
        current.name?.type === NODE_TYPE_JSX_IDENTIFIER &&
        current.name.name === CLASS_NAME_ATTRIBUTE
      );
    }
    // Template literals nest as JSXExpressionContainer > TemplateLiteral > TemplateElement —
    // keep walking up through both wrapper types to reach the JSXAttribute.
    if (
      current.type === NODE_TYPE_JSX_EXPRESSION_CONTAINER ||
      current.type === NODE_TYPE_TEMPLATE_LITERAL
    ) {
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
/**
 * ESLint rule: warns (never errors) when a className contains "absolute"/"fixed", prompting a
 * human to confirm it's a genuine overlay per Design.md §5 rather than layout-via-position.
 * @returns the ESLint RuleModule
 */
const flagStrayPositionRule: Rule.RuleModule = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Flag absolute/fixed classes in className for manual review (Design.md §5).",
    },
    schema: [],
  },
  create(context) {
    /**
     * Reports `node` if `text` contains a stray absolute/fixed class and sits in a className attribute.
     * @param node - the Literal or TemplateElement node to report on
     * @param text - the literal string content to test against the absolute/fixed pattern
     * @returns void
     */
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
          "./packages/token-refresh/tsconfig.tooling.json",
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
    files: [
      "packages/ui/src/pages/tokensPreview.tsx",
      "packages/ui/src/pages/primitivesPreview.tsx",
      "packages/ui/src/components/ui/button.tsx",
      "packages/ui/src/components/ui/badge.tsx",
      "packages/ui/src/components/ui/card.tsx",
      "packages/ui/src/components/ui/input.tsx",
      "packages/ui/src/components/ui/textarea.tsx",
      "packages/ui/src/components/ui/statusDot.tsx",
      "packages/ui/src/components/ui/breadcrumb.tsx",
      "packages/ui/src/pages/catalogPreview.tsx",
      "packages/ui/src/components/ui/select.tsx",
      "packages/ui/src/components/ui/switch.tsx",
      "packages/ui/src/components/ui/tabs.tsx",
      "packages/ui/src/components/ui/dialog.tsx",
      "packages/ui/src/components/ui/toast.tsx",
      "packages/ui/src/components/ui/tooltip.tsx",
      "packages/ui/src/components/ui/scrollArea.tsx",
      "packages/ui/src/components/ui/messageBubble.tsx",
      "packages/ui/src/components/ui/typingIndicator.tsx",
      "packages/ui/src/components/ui/table.tsx",
      "packages/ui/src/pages/login.tsx",
      "packages/ui/src/components/shell/appShell.tsx",
      "packages/ui/src/components/shell/sidebar.tsx",
      "packages/ui/src/components/shell/appHeaderMobile.tsx",
      "packages/ui/src/components/shell/mobileTabBar.tsx",
      "packages/ui/src/components/shell/appFooter.tsx",
      "packages/ui/src/components/ui/breadcrumb.tsx",
      "packages/ui/src/components/ask/ambientWave.tsx",
      "packages/ui/src/components/ask/suggestionGrid.tsx",
      "packages/ui/src/components/ask/composer.tsx",
      "packages/ui/src/components/ask/messageList.tsx",
      "packages/ui/src/pages/ask.tsx",
      "packages/ui/src/components/dashboard/statCard.tsx",
      "packages/ui/src/components/dashboard/needsAttentionCard.tsx",
      "packages/ui/src/pages/dashboard.tsx",
      "packages/ui/src/components/holdings/holdingFilters.tsx",
      "packages/ui/src/components/holdings/holdingsTable.tsx",
      "packages/ui/src/components/holdings/holdingCard.tsx",
      "packages/ui/src/pages/holdings.tsx",
    ],
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
