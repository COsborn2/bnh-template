"use client";

import { Turnstile as TurnstileWidget } from "@marsidev/react-turnstile";

type Props = {
  onSuccess: (token: string) => void;
  onError?: () => void;
  onWidgetVisible?: () => void;
};

export function Turnstile({ onSuccess, onError, onWidgetVisible }: Props) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  // Skip in development if not configured — auto-provide dummy token
  if (!siteKey) {
    if (typeof window !== "undefined") {
      setTimeout(() => onSuccess("dev-bypass"), 0);
    }
    return null;
  }

  return (
    <div className="flex justify-center">
      <TurnstileWidget
        siteKey={siteKey}
        onSuccess={onSuccess}
        onError={onError}
        onBeforeInteractive={onWidgetVisible}
        options={{ theme: "dark", size: "normal", appearance: "interaction-only" }}
      />
    </div>
  );
}
