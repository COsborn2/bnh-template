"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  PasswordRequirements,
  passwordMeetsRequirements,
} from "@/components/ui/password-strength-bar";

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-5 text-center">
          <p className="text-sm text-text-muted">Loading...</p>
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (!passwordMeetsRequirements(password)) {
      setError("Password does not meet the requirements");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (!token) {
      setError("Invalid or missing reset token");
      return;
    }

    setIsLoading(true);
    try {
      const { error: resetError } = await authClient.resetPassword({
        newPassword: password,
        token,
      });

      if (resetError) {
        setError(resetError.message || "Failed to reset password");
        return;
      }

      setSuccess(true);
    } catch {
      setError("Failed to reset password");
    } finally {
      setIsLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="flex flex-col gap-5 text-center">
        <h2 className="font-display text-2xl font-semibold">Invalid link</h2>
        <p className="text-sm text-text-muted">
          This password reset link is invalid or has expired.
        </p>
        <Link
          href="/auth/forgot-password"
          className="text-sm text-accent-purple hover:underline"
        >
          Request a new reset link
        </Link>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex flex-col gap-5 text-center">
        <h2 className="font-display text-2xl font-semibold">
          Password updated
        </h2>
        <p className="text-sm text-text-muted">
          Your password has been reset successfully.
        </p>
        <Link
          href="/auth/login"
          className="text-sm text-accent-purple hover:underline"
        >
          Sign in with your new password
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="text-center">
        <h2 className="font-display text-2xl font-semibold">
          Set a new password
        </h2>
        <p className="mt-1 text-sm text-text-muted">
          Choose a strong password for your account
        </p>
      </div>

      <Input
        label="New password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="••••••••"
        required
        autoComplete="new-password"
      />
      <PasswordRequirements password={password} />
      <Input
        label="Confirm password"
        type="password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        placeholder="••••••••"
        required
        autoComplete="new-password"
        error={confirmPassword && password !== confirmPassword ? "Passwords do not match" : undefined}
      />

      {error && (
        <div className="rounded-[var(--radius-md)] border border-accent-rose/20 bg-accent-rose/10 p-3">
          <p className="text-sm text-accent-rose">{error}</p>
        </div>
      )}

      <Button type="submit" disabled={isLoading}>
        {isLoading ? "Resetting..." : "Reset password"}
      </Button>
    </form>
  );
}
