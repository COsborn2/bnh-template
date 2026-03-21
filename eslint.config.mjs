import tseslint from "typescript-eslint";
import coreWebVitals from "eslint-config-next/core-web-vitals";

export default tseslint.config(
  {
    ignores: ["**/node_modules/**", "**/dist/**", "**/.next/**"],
  },
  ...tseslint.configs.recommended,
  // Next.js rules scoped to the web app
  ...coreWebVitals.map((config) => ({
    ...config,
    files: ["apps/web/**/*.{ts,tsx,js,jsx}"],
  })),
  {
    files: ["apps/web/**/*.{ts,tsx,js,jsx}"],
    settings: {
      next: { rootDir: "apps/web" },
    },
  }
);
