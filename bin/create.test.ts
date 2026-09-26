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
  const destination = await mkdtemp(join(tmpdir(), "bnh-scaffold-test-"));
  temporaryDirectories.push(destination);
  await copyTemplate(resolve(import.meta.dir, ".."), destination);
  await replaceInFiles(destination, {
    projectName: "sample-app", displayName: "SampleApp", dbName: "sample_app", scope: "sample-app",
  });

  const root = JSON.parse(await readFile(join(destination, "package.json"), "utf8"));
  expect(root.scripts["test:scaffold"]).toBeUndefined();
  const web = JSON.parse(await readFile(join(destination, "apps/web/package.json"), "utf8"));
  expect(web.name).toBe("@sample-app/web");
  expect(web.dependencies["@sample-app/shared"]).toBe("workspace:*");
  expect(web.dependencies["@cosborn2/ui"]).toBe("0.1.0-beta.0");
  expect(web.dependencies["@app/shared"]).toBeUndefined();
  expect(web.dependencies["lucide-react"]).toBe("0.577.0");
  expect(await readFile(join(destination, "apps/web/src/components/ui/button.tsx"), "utf8"))
    .toContain('from "@cosborn2/ui/button"');
  for (const component of ["data-table", "pagination", "theme-toggle", "modal", "notice", "actions-menu"]) {
    const adapter = await readFile(join(destination, `apps/web/src/components/ui/${component}.tsx`), "utf8");
    expect(adapter).toContain(`from "@cosborn2/ui/${component}"`);
    expect(adapter).toContain(`import "@cosborn2/ui/${component}.css"`);
  }
  const toaster = await readFile(join(destination, "apps/web/src/components/ui/toaster.tsx"), "utf8");
  expect(toaster).toContain('from "@cosborn2/ui/toast"');
  expect(toaster).toContain('import "@cosborn2/ui/toast.css"');
  expect(toaster).toContain('export const TOAST_DURATION_DEFAULT = 5000;');
  expect(toaster).toContain('export const TOAST_DURATION_ERROR = 0;');
  expect(await readFile(join(destination, "apps/web/src/components/ui/turnstile-submit-button.tsx"), "utf8"))
    .toContain('<Notice tone="danger" role="alert">');
  const adminUsers = await readFile(join(destination, "apps/web/src/app/admin/users/page.tsx"), "utf8");
  expect(adminUsers).toContain('<Pagination');
  expect(adminUsers).toContain('onPageChange={setPage}');
  expect(adminUsers).toContain('getRowKey={(user) => user.id}');
  expect(adminUsers).toContain('<Modal');
  expect(adminUsers).toContain('onRowIntent={handleRowIntent}');
  expect(adminUsers).not.toContain('bg-black/50');
  expect(await readFile(join(destination, "apps/web/src/app/settings/page.tsx"), "utf8"))
    .toContain('serverApiOrNull<{ user: SessionUser } | null>("/auth/get-session")');
  for (const excluded of ["node_modules", ".git", "bun.lock", "bin", "infra"]) {
    expect(existsSync(join(destination, excluded))).toBe(false);
  }
});
