"use client";

import { useState } from "react";
import { Turnstile } from "@/components/ui/turnstile";
import { Button } from "@/components/ui/button";

interface TurnstileSubmitButtonProps {
  children: React.ReactNode;
  loadingText: string;
  isLoading: boolean;
  onToken: (token: string) => void;
  error?: string;
  className?: string;
}

export function TurnstileSubmitButton({
  children,
  loadingText,
  isLoading,
  onToken,
  error: formError,
  className,
}: TurnstileSubmitButtonProps) {
  const [hasToken, setHasToken] = useState(false);
  const [challenged, setChallenged] = useState(false);
  const [turnstileError, setTurnstileError] = useState(false);

  const displayError = turnstileError
    ? "Verification failed. Please refresh and try again."
    : formError || "";

  // Disable submit if Turnstile is showing a challenge and user hasn't passed it yet
  const blocked = (challenged && !hasToken) || turnstileError;

  return (
    <>
      <Turnstile
        onSuccess={(token) => {
          setHasToken(true);
          onToken(token);
          setChallenged(false);
        }}
        onError={() => {
          setTurnstileError(true);
        }}
        onWidgetVisible={() => {
          setChallenged(true);
        }}
      />
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
