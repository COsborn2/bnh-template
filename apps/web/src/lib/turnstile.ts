export const TURNSTILE_DEV_BYPASS_TOKEN = "dev-bypass";

export function getTurnstileTokenResetValue(siteKey?: string) {
  return siteKey ? "" : TURNSTILE_DEV_BYPASS_TOKEN;
}
