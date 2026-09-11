"use client";

import { useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusPill } from "./status-pill";

interface EmailSectionProps {
  user: { email: string; emailVerified: boolean };
}

export function EmailSection({ user }: EmailSectionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function handleCancel() {
    setIsEditing(false);
    setNewEmail("");
    setError("");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setIsSubmitting(true);
    try {
      // Step 1 of the two-step flow (see the API's auth.ts): better-auth
      // emails an approval link to the CURRENT address; only after that is
      // opened does the verification link go out to the new one.
      const { error: changeError } = await authClient.changeEmail({
        newEmail,
        callbackURL: "/settings",
      });
      if (changeError) {
        setError(changeError.message || "Failed to change email");
        return;
      }
      setSuccess(`Approval email sent to ${user.email}`);
      setIsEditing(false);
      setNewEmail("");
    } catch {
      setError("Failed to change email");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="rounded-[var(--radius-xl)] border border-border bg-bg-raised p-8">
      <h2 className="font-display text-xl font-semibold text-text">Email</h2>
      <p className="mt-1 text-sm text-text-muted">
        The address you sign in with and where we reach you.
      </p>

      {success && (
        <p className="mt-4 rounded-[var(--radius-md)] border border-accent-green/20 bg-accent-green/10 px-3 py-2 text-sm text-accent-green">
          {success}
        </p>
      )}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-medium text-text">
            {user.email}
          </span>
          {user.emailVerified && <StatusPill>Verified</StatusPill>}
        </div>
        {!isEditing && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => {
              setSuccess("");
              setIsEditing(true);
            }}
          >
            Change email
          </Button>
        )}
      </div>

      {isEditing && (
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <Input
              label="New email"
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              required
              autoComplete="email"
              autoFocus
              error={error || undefined}
            />
            <p className="mt-1.5 text-xs text-text-faint">
              We&apos;ll first email your current address to approve the change,
              then send a verification link to the new address.
            </p>
          </div>
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting || !newEmail}
            >
              {isSubmitting ? "Sending..." : "Update email"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
