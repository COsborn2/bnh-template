import { describe, expect, test } from "bun:test";
import { renderToString } from "react-dom/server";
import { UserAvatar } from "./user-avatar";

describe("UserAvatar", () => {
  test("shows a stored SVG only through an <img> data URI", () => {
    const html = renderToString(
      <UserAvatar svg='<svg xmlns="http://www.w3.org/2000/svg"></svg>' name="Ada" size={28} />,
    );
    expect(html).toContain("<img");
    expect(html).toContain("data:image/svg+xml,%3Csvg");
    expect(html).not.toContain("<svg");
  });

  test("falls back to the initial when there is no avatar", () => {
    const html = renderToString(<UserAvatar svg={null} name="grace" size={28} />);
    expect(html).not.toContain("<img");
    expect(html).toContain(">G</span>");
  });
});
