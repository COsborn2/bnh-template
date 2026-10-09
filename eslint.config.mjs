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
    files: ["apps/web/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [{ group: ["@fortawesome/*"], message: "Use named imports from lucide-react; its SVG icons render on the server without a CSS runtime." }],
      }],
    },
  },
];
