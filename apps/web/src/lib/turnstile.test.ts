import { describe, expect, test } from "bun:test";
import {
  TURNSTILE_DEV_BYPASS_TOKEN,
  getTurnstileTokenResetValue,
} from "./turnstile";

describe("getTurnstileTokenResetValue", () => {
  test("is the dev-bypass token when no site key is configured", () => {
    expect(getTurnstileTokenResetValue(undefined)).toBe(
      TURNSTILE_DEV_BYPASS_TOKEN,
    );
    expect(getTurnstileTokenResetValue("")).toBe("dev-bypass");
  });

  test("is empty (submit blocked until the widget succeeds) with a site key", () => {
    expect(getTurnstileTokenResetValue("1x00000000000000000000AA")).toBe("");
  });
});
