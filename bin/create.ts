#!/usr/bin/env bun

import { existsSync } from "fs";
import { cp, readFile, writeFile } from "fs/promises";
import { resolve, basename, join } from "path";
import { $ } from "bun";

// --- Derivation ---

function toDisplayName(name: string): string {
  return name
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("");
}

function toDbName(name: string): string {
  return name.replace(/-/g, "_").toLowerCase();
}

// --- Arg Parsing ---

const PROJECT_NAME_RE = /^[a-z][a-z0-9-_]*$/;

function parseArgs(): { projectName: string; dest: string } {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    console.log("Usage: bunx create-bnh <project-name>");
    console.log("");
    console.log("Creates a new BHN (Bun + Hono + Next.js) project.");
    process.exit(0);
  }

  const projectName = args[0];

  if (!PROJECT_NAME_RE.test(projectName)) {
    console.error(`Error: Invalid project name "${projectName}".`);
    console.error(
      "Must start with a lowercase letter and contain only lowercase letters, numbers, hyphens, and underscores.",
    );
    process.exit(1);
  }

  const dest = resolve(process.cwd(), projectName);

  if (existsSync(dest)) {
    console.error(`Error: Directory "${projectName}" already exists.`);
    process.exit(1);
  }

  return { projectName, dest };
}

// --- Copy Template ---

const EXCLUDE_DIRS = new Set([".git", "node_modules", "bin", "docs", ".turbo"]);
const EXCLUDE_FILES = new Set(["bun.lock", ".env.local"]);

async function copyTemplate(templateDir: string, dest: string) {
  await cp(templateDir, dest, {
    recursive: true,
    filter: (src) => {
      const rel = src.replace(templateDir, "").replace(/^\//, "");

      // Allow root directory itself
      if (rel === "") return true;

      // Check directory exclusions
      const topLevel = rel.split("/")[0];
      if (EXCLUDE_DIRS.has(topLevel)) return false;

      // Check file exclusions
      if (EXCLUDE_FILES.has(basename(rel))) return false;

      return true;
    },
  });
}

// --- Sentinel Replacement ---

const REPLACEMENT_FILES = [
  // Config & Environment
  "package.json",
  "apps/api/package.json",
  "apps/web/package.json",
  "apps/cron/package.json",
  "apps/migrate/package.json",
  "packages/db/package.json",
  "packages/email/package.json",
  "packages/shared/package.json",
  "packages/theme/package.json",
  ".env.example",
  "apps/web/.env.example",
  "apps/web/.env.local.example",
  "docker-compose.yml",

  // Application Code
  "apps/api/src/lib/auth.ts",
  "apps/web/src/app/layout.tsx",
  "apps/web/src/app/auth/layout.tsx",
  "apps/web/src/app/page.tsx",
  "apps/web/src/app/manifest.json",
  "packages/email/src/index.ts",
  "packages/email/src/templates/layout.tsx",
  "infra/proxy/loading.html",
  "infra/proxy/loading.template.html",

  // CI/CD & Deployment
  ".github/workflows/ci.yml",
  "apps/api/railway.json",
  "apps/web/railway.json",

  // Other
  "scripts/check-peer-deps.ts",
  "apps/api/src/__tests__/setup.ts",
  "apps/cron/src/cleanup.ts",
  "packages/shared/src/index.ts",
  "README.md",
];

interface Replacements {
  projectName: string;
  displayName: string;
  dbName: string;
  scope: string;
}

async function replaceInFiles(dest: string, r: Replacements) {
  for (const file of REPLACEMENT_FILES) {
    const filePath = join(dest, file);

    if (!existsSync(filePath)) {
      continue;
    }

    let content = await readFile(filePath, "utf-8");

    // Replace @app/ scope (before other replacements to avoid partial matches)
    content = content.replaceAll("@app/", `@${r.scope}/`);

    // Handle root package.json specially — use JSON parse/stringify
    // to safely rename and remove the bin field
    if (file === "package.json") {
      const pkg = JSON.parse(content);
      pkg.name = r.projectName;
      delete pkg.bin;
      content = JSON.stringify(pkg, null, 2) + "\n";
    }

    // Replace display name (MyApp → PascalCase derived name)
    content = content.replaceAll("MyApp", r.displayName);

    // Replace db name (myapp → derived db name)
    // This naturally handles myapp_test → derived_test
    content = content.replaceAll("myapp", r.dbName);

    // Replace bun-template references (in README, etc.)
    content = content.replaceAll("bun-template", r.projectName);

    await writeFile(filePath, content);
  }
}

// --- Install & Init ---

async function installDeps(dest: string) {
  console.log("Installing dependencies...");
  await $`cd ${dest} && bun install`.quiet();
}

async function initGit(dest: string) {
  await $`cd ${dest} && git init`.quiet();
  await $`cd ${dest} && git add -A`.quiet();
  await $`cd ${dest} && git commit -m "Initial commit from create-bnh"`.quiet();
  console.log("Initialized git repository.");
}

function printSummary(projectName: string) {
  console.log("");
  console.log(`Done! Created ${projectName}.`);
  console.log("");
  console.log("Next steps:");
  console.log(`  cd ${projectName}`);
  console.log("  # Edit .env with your secrets");
  console.log("  docker compose up -d");
  console.log("  bun run db:migrate");
  console.log("  bun run dev");
}

// --- Main ---

async function main() {
  const { projectName, dest } = parseArgs();

  const displayName = toDisplayName(projectName);
  const dbName = toDbName(projectName);
  const scope = projectName;

  console.log(`Creating ${projectName}...`);
  console.log(`  Display name: ${displayName}`);
  console.log(`  Database name: ${dbName}`);
  console.log(`  Workspace scope: @${scope}/`);
  console.log("");

  const templateDir = resolve(import.meta.dirname, "..");
  await copyTemplate(templateDir, dest);
  console.log("Copied template files.");

  await replaceInFiles(dest, { projectName, displayName, dbName, scope });
  console.log("Replaced sentinel values.");

  await cp(join(dest, ".env.example"), join(dest, ".env"));
  await cp(
    join(dest, "apps/web/.env.local.example"),
    join(dest, "apps/web/.env.local"),
  );
  console.log("Created .env files from examples.");

  await installDeps(dest);
  await initGit(dest);
  printSummary(projectName);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
