"use client";

import {
  Suspense,
  useState,
  useEffect,
  useCallback,
  useRef,
  type FormEvent,
} from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import {
  Turnstile as TurnstileWidget,
  type TurnstileInstance,
} from "@marsidev/react-turnstile";
import { getTurnstileTokenResetValue } from "@/lib/turnstile";
import { Button } from "@/components/ui/button";

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-5 text-center">
          <p className="text-sm text-text-muted">Loading...</p>
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const email = searchParams.get("email");

  const [status, setStatus] = useState<
    "idle" | "verifying" | "success" | "error"
  >(token ? "verifying" : "idle");
  const [message, setMessage] = useState("");
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState("");
  const [resendSuccess, setResendSuccess] = useState(false);
  const [turnstileError, setTurnstileError] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState(() =>
    getTurnstileTokenResetValue(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY),
  );
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const turnstileRef = useRef<TurnstileInstance | null>(null);
  const resendBlocked = !turnstileToken || turnstileError;
  const resendNotice = turnstileError
    ? "Verification failed. Please refresh and try again."
    : resendMessage;
  const resendNoticeSuccess = !turnstileError && resendSuccess;

  function resetTurnstileToken() {
    setTurnstileToken(getTurnstileTokenResetValue(siteKey));
  }

  const verifyToken = useCallback(async () => {
    if (!token) return;
    try {
      const { error } = await authClient.verifyEmail({
        query: { token },
      });
      if (error) {
        setStatus("error");
        setMessage(error.message || "Verification failed");
      } else {
        setStatus("success");
      }
    } catch {
      setStatus("error");
      setMessage("Verification failed");
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      verifyToken();
    }
  }, [token, verifyToken]);

  async function handleResend(e: FormEvent) {
    e.preventDefault();
    if (!email || resendBlocked) return;
    setResending(true);
    setResendMessage("");
    setResendSuccess(false);
    try {
      const { error } = await authClient.sendVerificationEmail({
        email,
        fetchOptions: {
          headers: { "x-captcha-response": turnstileToken },
        },
      });
      if (error) {
        setResendMessage(error.message || "Failed to resend");
      } else {
        setResendMessage("Verification email sent!");
        setResendSuccess(true);
      }
    } catch {
      setResendMessage("Failed to resend");
    } finally {
      setResending(false);
      // Turnstile tokens are single-use: a fresh challenge is needed before
      // the next attempt, whether or not this one succeeded.
      turnstileRef.current?.reset();
      resetTurnstileToken();
    }
  }

  function renderResendNotice() {
    if (!resendNotice) return null;
    return (
      <div
        className={
          resendNoticeSuccess
            ? "rounded-[var(--radius-md)] border border-border bg-bg-card p-3"
            : "rounded-[var(--radius-md)] border border-accent-rose/20 bg-accent-rose/10 p-3"
        }
      >
        <p
          className={
            resendNoticeSuccess
              ? "text-sm text-text-muted"
              : "text-sm text-accent-rose"
          }
        >
          {resendNotice}
        </p>
      </div>
    );
  }

  // Shown until a resend succeeds; the API requires a captcha token on
  // /send-verification-email just like sign-in and sign-up.
  function renderResendForm() {
    return (
      <form onSubmit={handleResend} className="flex flex-col gap-3">
        {siteKey && (
          <div className="flex justify-center">
            <TurnstileWidget
              ref={turnstileRef}
              siteKey={siteKey}
              onSuccess={(token) => {
                setTurnstileError(false);
                setTurnstileToken(token);
              }}
              onExpire={resetTurnstileToken}
              onError={() => {
                resetTurnstileToken();
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
        <Button
          type="submit"
          variant="secondary"
          disabled={resending || resendBlocked}
        >
          {resending ? "Sending..." : "Resend verification email"}
        </Button>
      </form>
    );
  }

  // Mode 1: Verifying a token
  if (token) {
    if (status === "verifying") {
      return (
        <div className="flex flex-col gap-5 text-center">
          <h2 className="font-display text-2xl font-semibold">
            Verifying your email
          </h2>
          <p className="text-sm text-text-muted">Please wait...</p>
        </div>
      );
    }

    if (status === "success") {
      return (
        <div className="flex flex-col gap-5 text-center">
          <h2 className="font-display text-2xl font-semibold">
            Email verified
          </h2>
          <p className="text-sm text-text-muted">
            Your email has been verified successfully.
          </p>
          <Link
            href="/auth/login"
            className="text-sm text-accent-purple hover:underline"
          >
            Continue to sign in
          </Link>
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-5 text-center">
        <h2 className="font-display text-2xl font-semibold">
          Verification failed
        </h2>
        <p className="text-sm text-text-muted">
          {message || "This verification link is invalid or has expired."}
        </p>
        {renderResendNotice()}
        {email && !resendSuccess && renderResendForm()}
        <Link
          href="/auth/login"
          className="text-sm text-accent-purple hover:underline"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  // Mode 2: Waiting for email verification (no token)
  return (
    <div className="flex flex-col gap-5 text-center">
      <div>
        <h2 className="font-display text-2xl font-semibold">
          Check your email
        </h2>
        <p className="mt-2 text-sm text-text-muted">
          We sent a verification link to{" "}
          {email ? (
            <span className="font-medium text-text">{email}</span>
          ) : (
            "your email address"
          )}
          . Click the link to verify your account.
        </p>
      </div>

      {renderResendNotice()}

      {email && !resendSuccess && renderResendForm()}

      <Link
        href="/auth/login"
        className="text-sm text-accent-purple hover:underline"
      >
        Back to sign in
      </Link>
    </div>
  );
}
