import { expect, test } from "bun:test";
import { renderWithRouter } from "@/test/router-stub";
import AdminUsersPage from "./page";

test("every filter control has an accessible name", () => {
  const html = renderWithRouter(<AdminUsersPage />);
  // The search box had only a placeholder, which isn't a reliable name.
  expect(html).toMatch(/<input[^>]*aria-label="Filter users by name or email"[^>]*placeholder="Filter users\.\.\."/);
  for (const name of ["Role", "Status", "Email verification"]) {
    expect(html).toContain(`aria-label="${name}"`);
  }
});
