"use client";

import { useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  PasswordRequirements,
  passwordMeetsRequirements,
} from "@/components/ui/password-strength-bar";
import { toast } from "@/components/ui/toaster";

interface PasswordSectionProps {
  /** Whether a credential (password) account exists — null while the
   *  /list-accounts fetch is still settling, which keeps the change form. */
  hasPassword: boolean | null;
  /** Called after a password is first set so the caller refetches accounts
   *  and this section flips to "Change password". */
  onPasswordSet: () => Promise<void> | void;
}

export function PasswordSection({
  hasPassword,
  onPasswordSet,
}: PasswordSectionProps) {
  // Only a settled list with no "credential" row (an OAuth-only account)
  // gets the set-password path; "unknown" behaves like "has a password".
  const needsPassword = hasPassword === false;
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (!passwordMeetsRequirements(newPassword)) {
      toast("Password does not meet requirements", "error");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast("Passwords do not match", "error");
      return;
    }

    setIsSaving(true);

    try {
      if (needsPassword) {
        // better-auth's setPassword is server-only (no client route), so the
        // API wraps it: POST /account/set-password { newPassword }.
        await api("/account/set-password", {
          method: "POST",
          body: JSON.stringify({ newPassword }),
        });
        toast("Password set", "success");
        await onPasswordSet();
      } else {
        const { error } = await authClient.changePassword({
          currentPassword,
          newPassword,
          revokeOtherSessions: true,
        });

        if (error) {
          toast(error.message || "Failed to change password", "error");
          return;
        }

        toast("Password changed successfully", "success");
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      toast(
        err instanceof Error && err.message
          ? err.message
          : needsPassword
            ? "Failed to set password"
            : "Failed to change password",
        "error",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="rounded-[var(--radius-xl)] border border-border bg-bg-raised p-8">
      <h2 className="font-display text-xl font-semibold text-text">
        {needsPassword ? "Set a password" : "Change password"}
      </h2>
      <p className="mt-1 text-sm text-text-muted">
        {needsPassword
          ? "Your account has no password yet. Set one to also sign in with your email address."
          : "Update your password. This will revoke all other sessions."}
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        {!needsPassword && (
          <Input
            label="Current password"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        )}
        <Input
          label="New password"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
          autoComplete="new-password"
        />
        <PasswordRequirements password={newPassword} />
        <Input
          label="Confirm new password"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          autoComplete="new-password"
        />
        <div className="flex justify-end">
          <Button type="submit" size="sm" disabled={isSaving}>
            {needsPassword
              ? isSaving
                ? "Setting..."
                : "Set password"
              : isSaving
                ? "Changing..."
                : "Change password"}
          </Button>
        </div>
      </form>
    </div>
  );
}
