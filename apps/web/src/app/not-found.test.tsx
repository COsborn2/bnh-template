import { describe, expect, test } from "bun:test";
import { renderToString } from "react-dom/server";
import NotFound from "./not-found";

describe("404 page", () => {
  // This page is a server component, so the Font Awesome svg-core runtime —
  // and the `.svg-inline--fa { height: 1em }` rule it injects into <head> on
  // the client — never ships with it. The icon must therefore carry its own
  // explicit pixel size in the SSR HTML rather than depend on that CSS.
  test("renders its icon at an explicit pixel size, not svg-core's", () => {
    const html = renderToString(<NotFound />);

    expect(html).not.toContain("svg-inline--fa");

    const icon = (html.match(/<svg[^>]*>/g) ?? []).find((tag) =>
      tag.includes('fill="currentColor"'),
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
