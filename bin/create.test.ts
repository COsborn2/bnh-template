import { afterEach, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { copyTemplate, replaceInFiles } from "./create";

const temporaryDirectories: string[] = [];
afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

test("a generated project keeps the published UI dependency and replaces its own workspace scope", async () => {
  const templateDir = resolve(import.meta.dir, "..");
  const sourceWeb = JSON.parse(await readFile(join(templateDir, "apps/web/package.json"), "utf8"));
  const destination = await mkdtemp(join(tmpdir(), "bnh-scaffold-test-"));
  temporaryDirectories.push(destination);
  await copyTemplate(templateDir, destination);
  await replaceInFiles(destination, {
    projectName: "sample-app", displayName: "SampleApp", dbName: "sample_app", scope: "sample-app",
  });

  const root = JSON.parse(await readFile(join(destination, "package.json"), "utf8"));
  expect(root.scripts["test:scaffold"]).toBeUndefined();
  const web = JSON.parse(await readFile(join(destination, "apps/web/package.json"), "utf8"));
  expect(web.name).toBe("@sample-app/web");
  expect(web.dependencies["@sample-app/shared"]).toBe("workspace:*");
  expect(web.dependencies["@cosborn2/ui"]).toBe(sourceWeb.dependencies["@cosborn2/ui"]);
  expect(web.dependencies["@app/shared"]).toBeUndefined();
  expect(web.dependencies["lucide-react"]).toBe(sourceWeb.dependencies["lucide-react"]);
  for (const excluded of ["node_modules", ".git", "bun.lock", "bin", "infra"]) {
    expect(existsSync(join(destination, excluded))).toBe(false);
  }
});
