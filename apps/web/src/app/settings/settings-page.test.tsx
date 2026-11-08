import { beforeEach, expect, mock, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { SessionUser } from "@/lib/session-user";
import { svgToDataUri } from "@/lib/svg-uri";

const exampleUser: SessionUser = { id: "user-1", name: "Ada", email: "ada@example.com", username: "ada", emailVerified: true };
const passwordAccount = { id: "acc-1", providerId: "credential", accountId: "user-1", scopes: [], createdAt: "2026-01-01T00:00:00.000Z" };
const googleAccount = { id: "acc-2", providerId: "google", accountId: "g-1", scopes: ["email"], createdAt: "2026-01-01T00:00:00.000Z" };
const serverAvatar = { options: {}, svg: '<svg xmlns="http://www.w3.org/2000/svg" data-from="server"></svg>' };
let user: SessionUser | null = exampleUser;
let accounts: unknown[] = [passwordAccount];
let prefetchFails = false;
const paths: string[] = [];
beforeEach(() => { user = exampleUser; accounts = [passwordAccount]; prefetchFails = false; paths.length = 0; });

mock.module("@/lib/server-api", () => ({
  serverApiOrNull: async (path: string) => {
    paths.push(path);
    if (path === "/auth/get-session") return user ? { user } : null;
    if (!user) return null;
    if (prefetchFails) throw new Error("API unavailable");
    if (path === "/auth/list-accounts") return accounts;
    if (path === "/account/avatar") return serverAvatar;
    throw new Error(`unexpected server fetch ${path}`);
  },
}));

const render = async (section?: string) =>
  renderToStaticMarkup(await SettingsPage({ searchParams: Promise.resolve(section ? { section } : {}) }));
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
  expect(paths).toContain("/auth/get-session");
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

test("each section prefetches only what it shows, alongside the session", async () => {
  const fetched = async (section?: string) => {
    paths.length = 0;
    await render(section);
    return [...paths].sort();
  };
  expect(await fetched()).toEqual(["/account/avatar", "/auth/get-session"]);
  for (const section of ["password", "connections", "delete"]) {
    expect(await fetched(section)).toEqual(["/auth/get-session", "/auth/list-accounts"]);
  }
  expect(await fetched("appearance")).toEqual(["/auth/get-session"]);
});

test("the profile's avatar is on the first paint", async () => {
  expect(await render()).toContain(svgToDataUri(serverAvatar.svg).replaceAll("&", "&amp;"));
});

test("sign-in methods are settled on the first paint", async () => {
  accounts = [googleAccount];
  expect(await render("password")).toContain("Set a password");
  accounts = [passwordAccount, googleAccount];
  expect(await render("password")).toContain("Change password");
  const connections = await render("connections");
  expect(connections).not.toContain("bnh-skeleton");
});

test("a failed prefetch still renders the section and leaves the fetch to the browser", async () => {
  prefetchFails = true;
  const profile = await render();
  expect(profile).toContain('value="Ada"');
  expect(profile).not.toContain("data-from");
  expect(await render("password")).toContain("Change password");
  expect(await render("connections")).toContain("bnh-skeleton");
});
