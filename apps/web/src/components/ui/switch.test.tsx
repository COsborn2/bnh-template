import { describe, expect, test } from "bun:test";
import { renderToString } from "react-dom/server";
import { Switch } from "./switch";

describe("Switch", () => {
  test("renders a named native checkbox switch inside the restyled track", () => {
    const html = renderToString(<Switch label="Email updates" description="Weekly summary." defaultChecked />);
    expect(html).toContain('type="checkbox"');
    expect(html).toContain('role="switch"');
    expect(html).toContain("checked");
    expect(html).toContain('class="bnh-switch-track"');
    expect(html).toContain("Email updates");
    expect(html).toContain("Weekly summary.");
  });
});
