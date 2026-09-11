import coreWebVitals from "eslint-config-next/core-web-vitals";
import tseslint from "typescript-eslint";

export default [
  {
    ignores: ["**/node_modules/**", "**/dist/**", "**/.next/**"],
  },
  // Next.js rules scoped to the web app (includes @typescript-eslint)
  ...coreWebVitals.map((config) => ({
    ...config,
    files: ["apps/web/**/*.{ts,tsx,js,jsx}"],
  })),
  {
    files: ["apps/web/**/*.{ts,tsx,js,jsx}"],
    settings: {
      next: { rootDir: "apps/web" },
    },
  },
  // Everything outside apps/web (api, ws, cron, migrate, packages, scripts)
  // gets the plain typescript-eslint recommended rules.
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: ["**/*.{ts,tsx}"],
    ignores: ["apps/web/**"],
  })),
  {
    files: ["**/*.{ts,tsx}"],
    ignores: ["apps/web/**"],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    // Test files mock modules and coerce fixtures; `any` is part of the job.
    files: ["**/*.test.{ts,tsx}", "**/*.e2e.ts"],
    ignores: ["apps/web/**"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    // The Font Awesome `svg-core` runtime injects the stylesheet that sizes
    // `.svg-inline--fa` (`height: 1em`) into <head> at runtime, on the client.
    // A server component never ships that runtime, so an icon it renders
    // through `<FontAwesomeIcon>` has no sizing CSS in the SSR HTML and,
    // unless a class sizes it explicitly, falls back to the browser's default
    // 300x150 replaced-element size. The 404 page here happened to size its
    // icon, so this rule is preventive: it stops the next server component
    // from blowing out its layout.
    //
    // `<FontAwesomeIcon>` is therefore only safe in a module that declares
    // "use client" (directly, and so lands in the client bundle). Everything
    // else — server components, and shared helpers that may be pulled into one
    // — must use `@/components/ui/fa-icon`, which draws the same glyph from the
    // same icon definition but emits explicit width/height and skips the ~28KB
    // runtime entirely.
    files: ["apps/web/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          // esquery's `:has()` silently matches nothing when given a leading
          // `>` combinator, so this must stay a descendant selector. Matching
          // `[directive]` rather than a bare string literal keeps it to a real
          // directive prologue — a stray `const x = "use client"` can't spoof it.
          selector:
            'Program:not(:has(ExpressionStatement[directive="use client"])) > ImportDeclaration[source.value="@fortawesome/react-fontawesome"]',
          message:
            'Modules without a "use client" directive may be rendered as server components, where the Font Awesome svg-core runtime (and the CSS that sizes the icon) never reaches the browser. Use `FaIcon` from "@/components/ui/fa-icon" instead, or add "use client" if this module is genuinely client-only.',
        },
      ],
    },
  },
];
