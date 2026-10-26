import { describe, expect, test } from "bun:test";
import { renderToString } from "react-dom/server";
import NotFound from "./not-found";

describe("404 page", () => {
  // Explicit dimensions make the server-rendered SVG independent of runtime CSS.
  test("renders its icon at an explicit pixel size", () => {
    const html = renderToString(<NotFound />);

    expect(html).not.toContain("svg-inline--fa");

    const icon = (html.match(/<svg[^>]*>/g) ?? []).find((tag) =>
      tag.includes("lucide-triangle-alert"),
    );
    expect(icon).toBeDefined();
    expect(icon).toContain('width="40"');
    expect(icon).toContain('height="40"');
  });

  test("keeps the home link", () => {
    const html = renderToString(<NotFound />);
    expect(html).toContain('href="/"');
    expect(html).toContain("Go home");
  });
});
