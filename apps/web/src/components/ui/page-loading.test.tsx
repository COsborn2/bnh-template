import { describe, expect, test } from "bun:test";
import { renderToString } from "react-dom/server";
import { PageLoading } from "./page-loading";

describe("PageLoading", () => {
  test("renders the CSS-delayed pulse", () => {
    const html = renderToString(<PageLoading />);
    expect(html).toContain('class="page-loading"');
    expect(html).toContain('class="page-loading-pulse"');
  });
});
