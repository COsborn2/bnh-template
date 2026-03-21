"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      const { error: forgotError } = await authClient.requestPasswordReset({
        email,
        redirectTo: "/auth/reset-password",
      });

      if (forgotError) {
        setError(forgotError.message || "Something went wrong");
        return;
      }

      setSent(true);
    } catch {
      setError("Something went wrong");
    } finally {
      setIsLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="flex flex-col gap-5 text-center">
        <div>
          <h2 className="font-display text-2xl font-semibold">
            Check your email
          </h2>
          <p className="mt-2 text-sm text-text-muted">
            We sent a password reset link to{" "}
            <span className="font-medium text-text">{email}</span>. It may take
            a minute to arrive.
          </p>
        </div>
        <Link
          href="/auth/login"
          className="text-sm text-accent-purple hover:underline"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="text-center">
        <h2 className="font-display text-2xl font-semibold">
          Reset your password
        </h2>
        <p className="mt-1 text-sm text-text-muted">
          Enter your email and we&apos;ll send you a reset link
        </p>
      </div>

      <Input
        label="Email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        required
        autoComplete="email"
      />

      {error && (
        <div className="rounded-[var(--radius-md)] border border-accent-rose/20 bg-accent-rose/10 p-3">
          <p className="text-sm text-accent-rose">{error}</p>
        </div>
      )}

      <Button type="submit" disabled={isLoading}>
        {isLoading ? "Sending..." : "Send reset link"}
      </Button>

      <p className="text-center text-sm text-text-muted">
        <Link
          href="/auth/login"
          className="text-accent-purple hover:underline"
        >
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
