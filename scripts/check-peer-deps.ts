/**
 * Verify that all peerDependencies of workspace packages are explicitly listed
 * in the consuming app's own dependencies. This catches the class of bug where
 * Bun's workspace resolution masks a missing dependency that breaks in
 * production builds.
 *
 * Run: bun scripts/check-peer-deps.ts
 */

import { readFileSync, existsSync, readdirSync } from "fs";
import { join } from "path";

const rootDir = import.meta.dirname!;
const appsDir = join(rootDir, "..", "apps");
const packagesDir = join(rootDir, "..", "packages");

let failed = false;

for (const appName of readdirSync(appsDir)) {
  const appPkgPath = join(appsDir, appName, "package.json");
  if (!existsSync(appPkgPath)) continue;

  const appPkg = JSON.parse(readFileSync(appPkgPath, "utf-8"));
  const appDeps = {
    ...appPkg.dependencies,
    ...appPkg.devDependencies,
  };

  for (const dep of Object.keys(appPkg.dependencies ?? {})) {
    if (!dep.startsWith("@app/")) continue;

    const pkgName = dep.replace("@app/", "");
    const pkgPath = join(packagesDir, pkgName, "package.json");
    if (!existsSync(pkgPath)) continue;

    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    const peerDeps = pkg.peerDependencies ?? {};

    for (const peer of Object.keys(peerDeps)) {
      if (!appDeps[peer]) {
        console.error(
          `${appPkg.name}: missing "${peer}" (peerDependency of ${dep})`
        );
        failed = true;
      }
    }
  }
}

if (failed) {
  console.error("\nPeer dependency check failed.");
  process.exit(1);
} else {
  console.log("Peer dependency check passed.");
}
