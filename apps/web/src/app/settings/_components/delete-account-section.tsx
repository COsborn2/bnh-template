"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { describeDeleteError } from "./errors";

interface DeleteAccountSectionProps {
  email: string;
}

export function DeleteAccountSection({ email }: DeleteAccountSectionProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [error, setError] = useState("");

  async function handleDelete() {
    setIsSending(true);
    setError("");
    try {
      // Better Auth never deletes inline here — with deletion verification
      // enabled (see the API's auth.ts) it emails a one-time confirmation
      // link and returns success. Deletion only happens once that's opened.
      const { error: deleteError } = await authClient.deleteUser({
        callbackURL: "/",
      });
      if (deleteError) {
        setError(describeDeleteError(deleteError));
        return;
      }
      setEmailSent(true);
    } catch {
      setError("Couldn't start account deletion. Please try again.");
    } finally {
      setIsSending(false);
      setShowConfirm(false);
    }
  }

  return (
    <>
      <div className="rounded-[var(--radius-xl)] border border-accent-rose/20 bg-bg-raised p-8">
        <h2 className="font-display text-xl font-semibold text-accent-rose">
          {emailSent ? "Check your email" : "Delete account"}
        </h2>

        {emailSent ? (
          <div className="mt-1 space-y-3 text-sm text-text-muted">
            <p>
              We&apos;ve emailed a confirmation link to{" "}
              <span className="font-medium text-text">{email}</span>. Open it to
              permanently delete your account.
            </p>
            <p>
              The link expires in 24 hours. Until you click it, your account
              stays exactly as it is — you can safely leave this page.
            </p>
          </div>
        ) : (
          <>
            <p className="mt-1 text-sm text-text-muted">
              Permanently delete your account and the data you own. This
              can&apos;t be undone.
            </p>
            {/* What deletion removes: better-auth drops the user row, its
                sessions and sign-in methods; anything app-specific is cleaned
                up by deleteAccountData in apps/api/src/services/account.ts.
                Keep this sentence in step with what that function does. */}
            <p className="mt-3 text-sm text-text-muted">
              Deleting your account removes your profile, your sign-in methods,
              and everything you own. To make sure it&apos;s really you,
              we&apos;ll email you a confirmation link before anything is
              deleted.
            </p>
            {error && <p className="mt-3 text-sm text-accent-rose">{error}</p>}
            <div className="mt-6">
              <Button
                variant="danger"
                size="sm"
                onClick={() => setShowConfirm(true)}
              >
                Delete account
              </Button>
            </div>
          </>
        )}
      </div>

      <ConfirmDialog
        open={showConfirm}
        title="Delete your account?"
        message={`This permanently deletes your account and cannot be undone. We'll send a confirmation link to ${email} — deletion only happens after you open it.`}
        confirmLabel="Email me a confirmation link"
        confirmVariant="danger"
        typeToConfirm={email}
        loading={isSending}
        onConfirm={handleDelete}
        onCancel={() => {
          if (!isSending) setShowConfirm(false);
        }}
      />
    </>
  );
}
