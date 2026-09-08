"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Turnstile as TurnstileWidget,
  type TurnstileInstance,
} from "@marsidev/react-turnstile";
import { getTurnstileTokenResetValue } from "@/lib/turnstile";

interface TurnstileSubmitButtonProps {
  children: React.ReactNode;
  loadingText: string;
  isLoading: boolean;
  token: string;
  onTokenChange: (token: string) => void;
  error?: string;
  className?: string;
}

/**
 * Submit button paired with a Cloudflare Turnstile widget. The token is
 * controlled by the parent (seed it with `getTurnstileTokenResetValue`) so the
 * form can send it as the `x-captcha-response` header. Turnstile tokens are
 * single-use and expire after a few minutes, so the widget is reset — and the
 * token cleared — after every submit and on expiry/error; submit stays blocked
 * until a fresh token exists. Without NEXT_PUBLIC_TURNSTILE_SITE_KEY the widget
 * is not rendered and the token is the dev-bypass value.
 */
export function TurnstileSubmitButton({
  children,
  loadingText,
  isLoading,
  token,
  onTokenChange,
  error: formError,
  className,
}: TurnstileSubmitButtonProps) {
  const [turnstileError, setTurnstileError] = useState(false);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const widgetRef = useRef<TurnstileInstance | null>(null);
  const wasLoading = useRef(isLoading);

  const resetToken = useCallback(() => {
    onTokenChange(getTurnstileTokenResetValue(siteKey));
  }, [onTokenChange, siteKey]);

  useEffect(() => {
    if (wasLoading.current && !isLoading) {
      widgetRef.current?.reset();
      resetToken();
    }

    wasLoading.current = isLoading;
  }, [isLoading, resetToken]);

  const displayError = turnstileError
    ? "Verification failed. Please refresh and try again."
    : formError || "";

  const blocked = !token || turnstileError;

  return (
    <>
      {siteKey && (
        <div className="flex justify-center">
          <TurnstileWidget
            ref={widgetRef}
            siteKey={siteKey}
            onSuccess={(token) => {
              setTurnstileError(false);
              onTokenChange(token);
            }}
            onExpire={() => {
              resetToken();
            }}
            onError={() => {
              resetToken();
              setTurnstileError(true);
            }}
            options={{
              theme: "dark",
              size: "normal",
              appearance: "interaction-only",
            }}
          />
        </div>
      )}
      {displayError && (
        <div className="rounded-[var(--radius-md)] bg-accent-rose/10 border border-accent-rose/20 p-3">
          <p className="text-sm text-accent-rose">{displayError}</p>
        </div>
      )}
      <Button
        type="submit"
        disabled={isLoading || blocked}
        className={className}
      >
        {isLoading ? loadingText : children}
      </Button>
    </>
  );
}
