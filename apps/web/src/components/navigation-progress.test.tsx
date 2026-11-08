import { describe, expect, test } from "bun:test";
import type { ReactElement } from "react";
import { renderToString } from "react-dom/server";
import { renderWithRouter } from "@/test/router-stub";
import { NavigationProgressProvider, PendingLink } from "./navigation-progress";

const rts = (el: ReactElement) => renderWithRouter(el).replace(/<!-- -->/g, "");

describe("NavigationProgressProvider", () => {
  test("renders the page with the progress bar idle", () => {
    const html = rts(
      <NavigationProgressProvider>
        <p>Account settings</p>
      </NavigationProgressProvider>,
    );
    expect(html).toContain("<p>Account settings</p>");
    expect(html).toContain('class="app-nav-progress"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain("data-active");
  });
});

describe("PendingLink", () => {
  test("renders a plain link while nothing is opening", () => {
    const html = rts(
      <NavigationProgressProvider>
        <PendingLink href="/settings" className="font-semibold">
          Settings
        </PendingLink>
      </NavigationProgressProvider>,
    );
    expect(html).toContain('href="/settings"');
    expect(html).toContain("Settings");
    expect(html).toContain('class="font-semibold"');
    expect(html).not.toContain("data-pending");
    expect(html).not.toContain("aria-busy");
  });

  test("still renders as a link outside the provider", () => {
    const html = renderToString(<PendingLink href="/dashboard">Dashboard</PendingLink>);
    expect(html).toContain('href="/dashboard"');
    expect(html).toContain("Dashboard");
  });
});
