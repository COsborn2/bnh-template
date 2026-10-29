import { describe, expect, spyOn, test } from "bun:test";
import { isPasswordCompromised } from "better-auth/plugins";

// test-preload.ts installs the fakes before any test file loads.
describe("network fakes", () => {
  test("outbound requests to real hosts fail instead of reaching the network", async () => {
    const consoleError = spyOn(console, "error").mockImplementation(() => {});
    try {
      await expect(fetch("https://example.com/")).rejects.toThrow("Tests must not reach the network");
    } finally {
      consoleError.mockRestore();
    }
  });

  test("the Have I Been Pwned range API reports only the listed breached passwords", async () => {
    expect(await isPasswordCompromised("password123")).toBe(true);
    expect(await isPasswordCompromised("xK9#mQ2!vL7$nR4@wP6^")).toBe(false);
  });
});
