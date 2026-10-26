import { beforeEach, expect, mock, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { SessionUser } from "@/lib/session-user";

const exampleUser: SessionUser = { id: "user-1", name: "Ada", email: "ada@example.com", username: "ada", emailVerified: true };
let user: SessionUser | null = exampleUser;
const paths: string[] = [];
beforeEach(() => { user = exampleUser; paths.length = 0; });

mock.module("@/lib/server-api", () => ({
  serverApiOrNull: async (path: string) => { paths.push(path); return user ? { user } : null; },
}));
mock.module("next/navigation", () => ({
  useRouter: () => ({ replace() {}, push() {} }),
  redirect: (path: string) => { throw new Error(`redirect:${path}`); },
}));
mock.module("@/lib/auth-client", () => ({
  authClient: {},
  useSession: () => ({ data: null, isPending: true }),
}));

const { default: SettingsPage } = await import("./page");

test("settings renders the server profile while the browser session is still loading", async () => {
  const html = renderToStaticMarkup(await SettingsPage({ searchParams: Promise.resolve({}) }));
  expect(paths.at(-1)).toBe("/auth/get-session");
  expect(html).toContain('value="Ada"');
  expect(html).toContain('value="ada"');
  expect(html).toContain('class="bnh-settings-title">Settings</h1>');
  expect(html).toContain('aria-current="page"');
  expect(html).not.toContain("Loading...");
});

test("section query selects native link navigation and rejects unknown or repeated values", async () => {
  const password = renderToStaticMarkup(await SettingsPage({ searchParams: Promise.resolve({ section: "password" }) }));
  expect(password).toContain('href="/settings?section=password" aria-current="page"');
  expect(password).toContain("Current password");
  expect(password).not.toContain('value="Ada"');
  for (const section of ["unknown", ["password", "delete"]]) {
    const html = renderToStaticMarkup(await SettingsPage({ searchParams: Promise.resolve({ section }) }));
    expect(html).toContain('href="/settings" aria-current="page"');
    expect(html).toContain('value="Ada"');
  }
});

test("anonymous requests redirect before rendering account settings", async () => {
  user = null;
  await expect(SettingsPage({ searchParams: Promise.resolve({}) })).rejects.toThrow("redirect:/auth/login");
});

test("connected accounts and deletion retain their account-security views", async () => {
  const connections = renderToStaticMarkup(await SettingsPage({ searchParams: Promise.resolve({ section: "connections" }) }));
  expect(connections).toContain('href="/settings?section=connections" aria-current="page"');
  expect(connections).toContain("Other ways to sign in");
  const deletion = renderToStaticMarkup(await SettingsPage({ searchParams: Promise.resolve({ section: "delete" }) }));
  expect(deletion).toContain("confirmation link before anything is deleted");
});
