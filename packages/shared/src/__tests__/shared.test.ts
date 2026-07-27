import { describe, expect, test } from "bun:test";
import { isRealtimeMessage, parseClientMessage } from "../protocol.js";

describe("parseClientMessage", () => {
  test("parses a valid subscribe message", () => {
    const result = parseClientMessage(
      JSON.stringify({ type: "subscribe", topic: "chat:lobby" })
    );
    expect(result).toEqual({ type: "subscribe", topic: "chat:lobby" });
  });

  test("parses a valid unsubscribe message", () => {
    const result = parseClientMessage(
      JSON.stringify({ type: "unsubscribe", topic: "chat:lobby" })
    );
    expect(result).toEqual({ type: "unsubscribe", topic: "chat:lobby" });
  });

  test("parses a valid data message", () => {
    const result = parseClientMessage(
      JSON.stringify({ type: "message", topic: "chat:lobby", data: { text: "hello" } })
    );
    expect(result).toEqual({
      type: "message",
      topic: "chat:lobby",
      data: { text: "hello" },
    });
  });

  test("returns null for invalid JSON", () => {
    expect(parseClientMessage("not json")).toBeNull();
  });

  test("returns null for unknown type", () => {
    const result = parseClientMessage(
      JSON.stringify({ type: "ping", topic: "chat:lobby" })
    );
    expect(result).toBeNull();
  });

  test("returns null for missing type", () => {
    const result = parseClientMessage(
      JSON.stringify({ topic: "chat:lobby" })
    );
    expect(result).toBeNull();
  });

  test("returns null for missing topic", () => {
    const result = parseClientMessage(
      JSON.stringify({ type: "subscribe" })
    );
    expect(result).toBeNull();
  });

  test("returns null for empty topic", () => {
    const result = parseClientMessage(
      JSON.stringify({ type: "subscribe", topic: "" })
    );
    expect(result).toBeNull();
  });

  test("returns null for message payloads missing data", () => {
    const result = parseClientMessage(
      JSON.stringify({ type: "message", topic: "chat:lobby" })
    );
    expect(result).toBeNull();
  });

  test("returns null for non-string topic", () => {
    const result = parseClientMessage(
      JSON.stringify({ type: "subscribe", topic: 123 })
    );
    expect(result).toBeNull();
  });

  test("returns null for null input parsed as JSON", () => {
    const result = parseClientMessage("null");
    expect(result).toBeNull();
  });

  test("returns null for array input", () => {
    const result = parseClientMessage("[]");
    expect(result).toBeNull();
  });
});

describe("isRealtimeMessage", () => {
  test("accepts an event envelope", () => {
    expect(isRealtimeMessage({ kind: "event", data: { a: 1 } })).toBe(true);
  });

  test("accepts control envelopes", () => {
    expect(isRealtimeMessage({ kind: "disconnect-user", userId: "u1" })).toBe(
      true
    );
    expect(isRealtimeMessage({ kind: "revalidate-topic" })).toBe(true);
    expect(isRealtimeMessage({ kind: "presence-sync" })).toBe(true);
  });

  test("rejects disconnect-user without a userId", () => {
    expect(isRealtimeMessage({ kind: "disconnect-user" })).toBe(false);
  });

  test("rejects unknown kinds and raw payloads", () => {
    expect(isRealtimeMessage({ kind: "mystery" })).toBe(false);
    expect(isRealtimeMessage({ type: "chat:message", body: "hi" })).toBe(false);
    expect(isRealtimeMessage(null)).toBe(false);
    expect(isRealtimeMessage("event")).toBe(false);
  });
});
