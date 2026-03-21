"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
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

  async function handleResend() {
    if (!email) return;
    setResending(true);
    try {
      const { error } = await authClient.sendVerificationEmail({
        email,
      });
      if (error) {
        setMessage(error.message || "Failed to resend");
      } else {
        setMessage("Verification email sent!");
      }
    } catch {
      setMessage("Failed to resend");
    } finally {
      setResending(false);
    }
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

      {message && (
        <div className="rounded-[var(--radius-md)] border border-border bg-bg-card p-3">
          <p className="text-sm text-text-muted">{message}</p>
        </div>
      )}

      {email && (
        <Button
          variant="secondary"
          onClick={handleResend}
          disabled={resending}
        >
          {resending ? "Sending..." : "Resend verification email"}
        </Button>
      )}

      <Link
        href="/auth/login"
        className="text-sm text-accent-purple hover:underline"
      >
        Back to sign in
      </Link>
    </div>
  );
}
