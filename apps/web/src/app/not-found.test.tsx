import { describe, expect, test } from "bun:test";
import { renderToString } from "react-dom/server";
import NotFound from "./not-found";

describe("404 page", () => {
  // Explicit dimensions make the server-rendered SVG independent of runtime CSS.
  test("renders its icon at an explicit pixel size", () => {
    const html = renderToString(<NotFound />);

    expect(html).not.toContain("svg-inline--fa");

    const icon = (html.match(/<svg[^>]*>/g) ?? []).find((tag) =>
      tag.includes("lucide-house"),
    );
    expect(icon).toBeDefined();
    expect(icon).toContain('width="16"');
    expect(icon).toContain('height="16"');
  });

  test("names the page for assistive tech and keeps the home link", () => {
    const html = renderToString(<NotFound />);
    expect(html).toContain('aria-label="404"');
    expect(html).toContain("Page not found");
    expect(html).toContain('href="/"');
    expect(html).toContain("Go home");
  });
});
