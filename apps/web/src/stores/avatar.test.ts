import { afterAll, beforeEach, expect, test } from "bun:test";
import type { AvatarOptions } from "@app/shared";
import { useAvatarStore } from "./avatar";
import { setViewer } from "./viewer-scope";

// Fake fetch rather than mock.module("@/lib/api"): bun's module mocks are
// process-global and would leak into lib/api.test.ts.
const realFetch = globalThis.fetch;
afterAll(() => {
  globalThis.fetch = realFetch;
});

const OPTIONS = { shape: "tv" } as unknown as AvatarOptions;

let requests: { resolve: (svg: string) => void }[] = [];
beforeEach(() => {
  requests = [];
  globalThis.fetch = (() =>
    new Promise<Response>((resolve) => {
      requests.push({
        resolve: (svg) =>
          resolve(Response.json({ options: OPTIONS, svg })),
      });
    })) as unknown as typeof fetch;
  setViewer(null);
  useAvatarStore.getState().reset();
});

const flush = () => new Promise((r) => setTimeout(r, 0));

test("loads once, shares the request, and caches the result", async () => {
  setViewer("alice");
  const a = useAvatarStore.getState().load();
  const b = useAvatarStore.getState().load();
  expect(requests).toHaveLength(1);
  requests[0]!.resolve("<svg>alice</svg>");
  expect((await a)?.svg).toBe("<svg>alice</svg>");
  expect((await b)?.svg).toBe("<svg>alice</svg>");
  await useAvatarStore.getState().load();
  expect(requests).toHaveLength(1);
});

test("switching accounts drops the cached avatar", async () => {
  setViewer("alice");
  const loading = useAvatarStore.getState().load();
  requests[0]!.resolve("<svg>alice</svg>");
  await loading;
  expect(useAvatarStore.getState().avatar?.svg).toBe("<svg>alice</svg>");

  setViewer("bob");
  expect(useAvatarStore.getState().avatar).toBeNull();
  const next = useAvatarStore.getState().load();
  expect(requests).toHaveLength(2);
  requests[1]!.resolve("<svg>bob</svg>");
  expect((await next)?.svg).toBe("<svg>bob</svg>");
  expect(useAvatarStore.getState().avatar?.svg).toBe("<svg>bob</svg>");
});

test("a response for the previous account that lands after a switch is not cached", async () => {
  setViewer("alice");
  const stale = useAvatarStore.getState().load();
  setViewer(null); // signed out while alice's avatar was still loading
  requests[0]!.resolve("<svg>alice</svg>");
  await stale;
  await flush();
  expect(useAvatarStore.getState().avatar).toBeNull();

  setViewer("bob");
  const fresh = useAvatarStore.getState().load();
  expect(requests).toHaveLength(2); // not alice's in-flight request
  requests[1]!.resolve("<svg>bob</svg>");
  expect((await fresh)?.svg).toBe("<svg>bob</svg>");
});
