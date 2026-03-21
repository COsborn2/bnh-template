import { join } from "node:path";

const ROOT = join(import.meta.dir, "..");

const colorsFile = Bun.file(join(ROOT, "packages/theme/colors.json"));
const colors: { dark: Record<string, string>; light: Record<string, string> } =
  await colorsFile.json();

// Generate Tailwind v4 @theme block (dark defaults) + light overrides
const darkVars = Object.entries(colors.dark)
  .map(([key, value]) => `  --color-${key}: ${value};`)
  .join("\n");

const lightVars = Object.entries(colors.light)
  .map(([key, value]) => `  --color-${key}: ${value};`)
  .join("\n");

const colorsCss = `/* AUTO-GENERATED — edit packages/theme/colors.json, then run: bun scripts/sync-theme.ts */
@theme {
${darkVars}
}

:root.light {
${lightVars}
}
`;

await Bun.write(join(ROOT, "apps/web/src/app/colors.css"), colorsCss);
console.log("Generated apps/web/src/app/colors.css");

// Generate loading page from template
const templatePath = join(ROOT, "infra/proxy/loading.template.html");
const outputPath = join(ROOT, "infra/proxy/loading.html");

try {
  const template = await Bun.file(templatePath).text();
  const rootVars = Object.entries(colors.dark)
    .map(([key, value]) => `      --color-${key}: ${value};`)
    .join("\n");
  const rootBlock = `:root {\n${rootVars}\n    }`;
  const loadingHtml =
    "<!-- AUTO-GENERATED — edit loading.template.html, then run: bun scripts/sync-theme.ts -->\n" +
    template.replace("/* THEME_VARS */", rootBlock);
  await Bun.write(outputPath, loadingHtml);
  console.log("Generated infra/proxy/loading.html");
} catch {
  console.log("No loading template found, skipping loading.html generation");
}
