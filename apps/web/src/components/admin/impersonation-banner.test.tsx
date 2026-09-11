import { describe, expect, test } from "bun:test";
import { renderToString } from "react-dom/server";
import { ImpersonationBannerView } from "./impersonation-banner";

const noop = () => {};

/** Strip the `<!-- -->` markers SSR inserts between adjacent text nodes. */
function render(element: React.ReactElement): string {
  return renderToString(element).replaceAll("<!-- -->", "");
}

describe("ImpersonationBannerView", () => {
  test("sits in flow (sticky) rather than covering the page (fixed)", () => {
    const html = render(
      <ImpersonationBannerView userName="Ada Lovelace" onStop={noop} />,
    );
    expect(html).toMatch(/<div class="[^"]*sticky top-0[^"]*">/);
    expect(html).not.toContain("fixed");
  });

  test("wraps a long name and keeps the button from shrinking", () => {
    const html = render(
      <ImpersonationBannerView userName="Ada Lovelace" onStop={noop} />,
    );
    expect(html).toContain("You are impersonating Ada Lovelace");
    expect(html).toMatch(/<span class="[^"]*min-w-0 break-words[^"]*">/);
    expect(html).toMatch(/<button[^>]*class="[^"]*shrink-0[^"]*"/);
    expect(html).toContain("Stop impersonating");
  });
});
