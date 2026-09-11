import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { renderWithRouter } from "@/test/router-stub";
import { LoginForm } from "./login-form";

// Rendered once — every assertion reads the same server-side HTML, which is
// what the statically prerendered /auth/login page ships.
let html = "";
const originalSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

beforeAll(() => {
  // Without a site key the Turnstile widget is not rendered, so the form
  // server-renders without touching the Cloudflare script.
  delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  html = renderWithRouter(<LoginForm />).replaceAll("<!-- -->", "");
});

// bun runs every test file in one process: put the key back so later files
// that render the widget are not affected by file ordering.
afterAll(() => {
  if (originalSiteKey === undefined) {
    delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  } else {
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = originalSiteKey;
  }
});

describe("LoginForm server rendering", () => {
  test("the whole form is in the server HTML", () => {
    expect(html).toContain("Welcome back");
    expect(html).toContain("Email or username");
    expect(html).toContain("Sign in with Google");
    expect(html).toContain('href="/auth/register"');
    expect(html).toContain('href="/auth/forgot-password"');
  });

  test("submit is enabled without a site key (dev-bypass token)", () => {
    const submit = html.match(/<button[^>]*type="submit"[^>]*>/)?.[0] ?? "";
    expect(submit).not.toBe("");
    // The class list contains `disabled:` variants; only the attribute matters.
    expect(submit).not.toContain('disabled=""');
  });
});
