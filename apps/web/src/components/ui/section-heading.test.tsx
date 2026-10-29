import { describe, expect, test } from "bun:test";
import { renderToString } from "react-dom/server";
import { UserRound } from "lucide-react";
import { SectionHeading } from "./section-heading";

describe("SectionHeading", () => {
  test("renders the title as a heading with a decorative icon tile and count", () => {
    const html = renderToString(
      <SectionHeading title="Your profile" icon={UserRound} fill="var(--app-fill-pink)" count={3}>
        <button type="button">Edit</button>
      </SectionHeading>,
    );
    expect(html).toMatch(/<h2 class="app-section-heading__title font-display">Your profile<\/h2>/);
    expect(html).toContain('aria-hidden="true" class="app-section-heading__icon" style="background:var(--app-fill-pink)"');
    expect(html).toContain('width="18"');
    expect(html).toContain('<span class="app-section-heading__count font-mono">3</span>');
    expect(html).toContain("<button");
  });

  test("leaves out the icon tile and count when not given", () => {
    const html = renderToString(<SectionHeading title="Members" />);
    expect(html).not.toContain("app-section-heading__icon");
    expect(html).not.toContain("app-section-heading__count");
    expect(html).toContain("app-section-heading__rule");
  });
});
