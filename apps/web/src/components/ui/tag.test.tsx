import { describe, expect, test } from "bun:test";
import { renderToString } from "react-dom/server";
import { Tag } from "./tag";

describe("Tag", () => {
  test("renders a toned label with merged classes", () => {
    const html = renderToString(
      <Tag tone="green" className="ml-2">
        Verified
      </Tag>,
    );
    expect(html).toContain('data-tone="green"');
    expect(html).toContain('class="app-tag ml-2"');
    expect(html).toContain("Verified");
  });

  test("omits the tone for the muted variant", () => {
    const html = renderToString(<Tag>Unverified</Tag>);
    expect(html).not.toContain("data-tone");
    expect(html).toContain('class="app-tag"');
  });
});
