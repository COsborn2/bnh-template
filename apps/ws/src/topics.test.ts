import { describe, test, expect, beforeEach } from "bun:test";
import {
  initTopics,
  subscribe,
  unsubscribe,
  removeClient,
  getTopicClients,
  getActiveTopics,
  type WsClient,
} from "./topics";

let nextClientId = 0;

/** Minimal stand-in for a Bun ServerWebSocket — only the fields topics.ts
 *  touches. `readyState` is mutable so tests can simulate a close. */
function fakeClient(readyState = 1): WsClient {
  return {
    readyState,
    data: {
      userId: `user-${nextClientId++}`,
      sessionId: "session",
      userName: "Test User",
      isGuest: false,
      messageTimestamps: [],
    },
  } as unknown as WsClient;
}

let firstSubscribes: string[] = [];
let lastUnsubscribes: string[] = [];

beforeEach(() => {
  firstSubscribes = [];
  lastUnsubscribes = [];
  initTopics({
    onFirstSubscribe: (topic) => firstSubscribes.push(topic),
    onLastUnsubscribe: (topic) => lastUnsubscribes.push(topic),
  });
  // The topic maps are module-level; clear anything a previous test left.
  for (const topic of getActiveTopics()) {
    for (const client of getTopicClients(topic) ?? []) {
      removeClient(client);
    }
  }
});

describe("subscribe", () => {
  test("adds an open client and fires onFirstSubscribe once", () => {
    const a = fakeClient();
    const b = fakeClient();

    expect(subscribe(a, "chat:general")).toBe(true);
    expect(subscribe(b, "chat:general")).toBe(true);

    expect([...(getTopicClients("chat:general") ?? [])]).toContain(a);
    expect(firstSubscribes).toEqual(["chat:general"]);
  });

  test("refuses a socket that is not open", () => {
    const closed = fakeClient(3);

    expect(subscribe(closed, "chat:general")).toBe(false);
    expect(getTopicClients("chat:general")).toBeUndefined();
    expect(firstSubscribes).toEqual([]);
  });

  test("does not resurrect a client whose close handler already ran", () => {
    // Regression test for the ghost-socket race: the client disconnects while
    // the subscribe handler is suspended at the authorize await. Bun runs the
    // close handler (removeClient) first, then the suspended handler resumes
    // and calls subscribe() on the now-closed socket.
    const client = fakeClient();
    expect(subscribe(client, "chat:general")).toBe(true);

    (client as { readyState: number }).readyState = 3;
    removeClient(client);
    expect(lastUnsubscribes).toEqual(["chat:general"]);

    expect(subscribe(client, "chat:general")).toBe(false);
    expect(getTopicClients("chat:general")).toBeUndefined();
    expect(getActiveTopics()).toEqual([]);
  });
});

describe("unsubscribe", () => {
  test("fires onLastUnsubscribe when the last client leaves", () => {
    const a = fakeClient();
    const b = fakeClient();
    subscribe(a, "chat:general");
    subscribe(b, "chat:general");

    unsubscribe(a, "chat:general");
    expect(lastUnsubscribes).toEqual([]);

    unsubscribe(b, "chat:general");
    expect(lastUnsubscribes).toEqual(["chat:general"]);
    expect(getTopicClients("chat:general")).toBeUndefined();
  });
});
