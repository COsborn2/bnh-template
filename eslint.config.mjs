import coreWebVitals from "eslint-config-next/core-web-vitals";

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
];