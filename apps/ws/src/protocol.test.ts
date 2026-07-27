import { describe, test, expect } from "bun:test";
import { decodeRealtimePayload, type RealtimeMessage } from "./protocol";

describe("decodeRealtimePayload", () => {
  test("passes valid envelopes through unchanged", () => {
    const event: RealtimeMessage = { kind: "event", data: { hello: "world" } };
    expect(decodeRealtimePayload(event)).toBe(event);

    const disconnect: RealtimeMessage = {
      kind: "disconnect-user",
      userId: "u1",
    };
    expect(decodeRealtimePayload(disconnect)).toBe(disconnect);

    const sync: RealtimeMessage = { kind: "presence-sync" };
    expect(decodeRealtimePayload(sync)).toBe(sync);
  });

  test("drops envelopes with an unknown kind instead of wrapping them", () => {
    // e.g. a control kind added to the api before this ws instance was
    // redeployed — rebroadcasting it would leak the raw envelope to clients.
    expect(decodeRealtimePayload({ kind: "mystery" })).toBeNull();
    expect(
      decodeRealtimePayload({ kind: "disconnect-guests", _otel: {} })
    ).toBeNull();
  });

  test("drops malformed control envelopes", () => {
    expect(decodeRealtimePayload({ kind: "disconnect-user" })).toBeNull();
    expect(
      decodeRealtimePayload({ kind: "disconnect-user", userId: 42 })
    ).toBeNull();
  });

  test("wraps kind-less payloads as raw event data", () => {
    expect(decodeRealtimePayload({ hello: "world" })).toEqual({
      kind: "event",
      data: { hello: "world" },
    });
    expect(decodeRealtimePayload("plain string")).toEqual({
      kind: "event",
      data: "plain string",
    });
    expect(decodeRealtimePayload(null)).toEqual({ kind: "event", data: null });
  });

  test("treats a non-string kind as raw event data, not an envelope", () => {
    expect(decodeRealtimePayload({ kind: 123 })).toEqual({
      kind: "event",
      data: { kind: 123 },
    });
  });
});
