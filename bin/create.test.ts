import { afterEach, describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { copyTemplate, replaceInFiles, stripTemplateOnly } from "./create";

const templateDir = resolve(import.meta.dir, "..");

const temporaryDirectories: string[] = [];
afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

async function scaffold() {
  const destination = await mkdtemp(join(tmpdir(), "bnh-scaffold-test-"));
  temporaryDirectories.push(destination);
  await copyTemplate(templateDir, destination);
  await replaceInFiles(destination, {
    projectName: "sample-app", displayName: "SampleApp", dbName: "sample_app", scope: "sample-app",
  });
  return destination;
}

type Workflow = { jobs: Record<string, { needs?: string | string[] }> };

async function readWorkflow(root: string, name: string): Promise<Workflow> {
  return Bun.YAML.parse(await readFile(join(root, ".github/workflows", name), "utf8")) as Workflow;
}

// The matched text, if any, so a failure names the leftover instead of
// dumping the whole file.
function firstMatch(content: string, pattern: RegExp) {
  return content.match(pattern)?.[0];
}

function danglingNeeds(workflow: Workflow) {
  return Object.entries(workflow.jobs).flatMap(([job, { needs = [] }]) =>
    [needs].flat().filter((need) => !(need in workflow.jobs)).map((need) => `${job} -> ${need}`),
  );
}

test("a generated project keeps the published UI dependency and replaces its own workspace scope", async () => {
  const sourceWeb = JSON.parse(await readFile(join(templateDir, "apps/web/package.json"), "utf8"));
  const destination = await scaffold();

  const root = JSON.parse(await readFile(join(destination, "package.json"), "utf8"));
  expect(root.scripts["test:scaffold"]).toBeUndefined();
  const web = JSON.parse(await readFile(join(destination, "apps/web/package.json"), "utf8"));
  expect(web.name).toBe("@sample-app/web");
  expect(web.dependencies["@sample-app/shared"]).toBe("workspace:*");
  expect(web.dependencies["@cosborn2/ui"]).toBe(sourceWeb.dependencies["@cosborn2/ui"]);
  expect(web.dependencies["@app/shared"]).toBeUndefined();
  expect(web.dependencies["lucide-react"]).toBe(sourceWeb.dependencies["lucide-react"]);
  const lockfile = await readFile(join(destination, "bun.lock"), "utf8");
  expect(lockfile).not.toContain("@app/");
  expect(lockfile).toContain('"@sample-app/web"');
  expect(lockfile).toMatch(/"workspaces": \{\s*"": \{\s*"name": "sample-app"/);
  for (const excluded of ["node_modules", ".git", "bin", "infra"]) {
    expect(existsSync(join(destination, excluded))).toBe(false);
  }
});

test("a generated project carries none of the template's own CI, proxy build, or generator docs", async () => {
  const destination = await scaffold();

  // The template's CI keeps its scaffold job and proxy build, and every
  // `needs` still resolves once the template-only blocks are cut.
  const templateCi = await readWorkflow(templateDir, "ci.yml");
  expect(Object.keys(templateCi.jobs)).toContain("scaffold");
  expect(await readFile(join(templateDir, ".github/workflows/ci.yml"), "utf8")).toContain("infra/proxy");

  for (const name of await readdir(join(destination, ".github/workflows"))) {
    const workflow = await readWorkflow(destination, name);
    expect(danglingNeeds(workflow)).toEqual([]);
    const source = await readFile(join(destination, ".github/workflows", name), "utf8");
    expect(firstMatch(source, /scaffold|infra\/|bin\/create|paths-filter/)).toBeUndefined();
  }
  const ci = await readWorkflow(destination, "ci.yml");
  expect(Object.keys(ci.jobs)).not.toContain("scaffold");
  expect(ci.jobs["docker-images"].needs).toEqual(["changes", "lint", "build", "test", "docker"]);

  expect(firstMatch(await readFile(join(destination, ".github/dependabot.yml"), "utf8"), /infra/)).toBeUndefined();

  const readme = await readFile(join(destination, "README.md"), "utf8");
  expect(readme.startsWith("# SampleApp\n")).toBe(true);
  expect(readme).toContain("bun install\n");
  expect(readme).toContain("cp .env.example .env\n");
  expect(firstMatch(readme, /bun create|bun link|create-bnh|test:scaffold|^├── (bin|infra)\//m)).toBeUndefined();

  const deployment = await readFile(join(destination, "DEPLOYMENT.md"), "utf8");
  expect(deployment).toContain("## Step 0: Push Your App to GitHub\n\nSkip this step if the app already exists on GitHub.\n\n1. Create an **empty** GitHub repository");
  expect(firstMatch(deployment, /bun create|bun link|create-bnh|bin\/create|scaffold` job/)).toBeUndefined();

  const claude = await readFile(join(destination, "CLAUDE.md"), "utf8");
  expect(firstMatch(claude, /REPLACEMENT_FILES|template-only|scaffold-only/)).toBeUndefined();

  // No marker survives anywhere in the scaffold.
  const files = await readdir(destination, { recursive: true, withFileTypes: true });
  for (const entry of files) {
    if (!entry.isFile() || entry.parentPath.includes("node_modules")) continue;
    const bytes = await readFile(join(entry.parentPath, entry.name));
    if (bytes.includes(0)) continue;
    expect(`${entry.name}: ${firstMatch(bytes.toString("utf8"), /template-only|scaffold-only/) ?? "clean"}`).toBe(`${entry.name}: clean`);
  }
});

describe("stripTemplateOnly", () => {
  test("cuts whole Markdown lines and keeps the surrounding text", () => {
    const input = "intro\n\n<!-- template-only -->\n## Template\n\ntext\n<!-- /template-only -->\n## Shared\n";
    expect(stripTemplateOnly(input)).toBe("intro\n\n## Shared\n");
  });

  test("cuts an inline Markdown phrase without joining lines", () => {
    const input = "1. lint<!-- template-only -->; scaffold<!-- /template-only -->\n2. build\n";
    expect(stripTemplateOnly(input)).toBe("1. lint\n2. build\n");
  });

  test("cuts indented YAML and shell lines", () => {
    const input = [
      "    needs:",
      "      - lint",
      "      # template-only",
      "      - scaffold",
      "      # /template-only",
      "      - build",
      "",
    ].join("\n");
    expect(stripTemplateOnly(input)).toBe("    needs:\n      - lint\n      - build\n");
  });

  test("unwraps scaffold-only Markdown", () => {
    const input = "<!-- template-only -->\n# Template\n<!-- /template-only -->\n<!-- scaffold-only\n# App\n-->\n\nBody\n";
    expect(stripTemplateOnly(input)).toBe("# App\n\nBody\n");
  });

  test("leaves ordinary comments alone", () => {
    const input = "# template-only fixtures are documented elsewhere\nkey: value # template-only\n";
    expect(stripTemplateOnly(input)).toBe(input);
  });

  test("rejects an unmatched marker", () => {
    expect(() => stripTemplateOnly("a\n# template-only\nb\n", "ci.yml")).toThrow(/ci\.yml: unmatched/);
    expect(() => stripTemplateOnly("<!-- scaffold-only\n# App\n", "README.md")).toThrow(/README\.md: unmatched/);
    expect(() => stripTemplateOnly("text <!-- /template-only -->\n")).toThrow(/unmatched/);
  });
});
