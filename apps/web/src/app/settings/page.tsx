"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authClient, useSession } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UsernameInput } from "@/components/ui/username-input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  PasswordRequirements,
  passwordMeetsRequirements,
} from "@/components/ui/password-strength-bar";
import { toast } from "@/components/ui/toaster";

export default function SettingsPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();

  useEffect(() => {
    if (!isPending && !session) {
      router.replace("/auth/login");
    }
  }, [isPending, session, router]);

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-text-muted">Loading...</div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="font-display text-3xl font-bold text-text">Settings</h1>
        <Link href="/dashboard">
          <Button variant="secondary" size="sm">
            Back to dashboard
          </Button>
        </Link>
      </div>

      <div className="space-y-6">
        <ProfileSection user={session.user} />
        <ChangePasswordSection />
        <DeleteAccountSection email={session.user.email} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Profile section                                                    */
/* ------------------------------------------------------------------ */

function ProfileSection({
  user,
}: {
  user: { name: string; email: string } & Record<string, unknown>;
}) {
  const [name, setName] = useState(user.name);
  const currentUsername = typeof user.username === "string" ? user.username : "";
  const [username, setUsername] = useState(currentUsername);
  const [isSaving, setIsSaving] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<
    "idle" | "checking" | "available" | "taken"
  >("idle");

  async function handleProfileSubmit(e: FormEvent) {
    e.preventDefault();

    if (usernameStatus === "taken") {
      toast("That username is already taken", "error");
      return;
    }

    setIsSaving(true);

    try {
      if (name !== user.name) {
        const { error } = await authClient.updateUser({ name });
        if (error) {
          toast(error.message || "Failed to update name", "error");
          setIsSaving(false);
          return;
        }
      }

      if (username !== currentUsername) {
        const { error } = await authClient.updateUser({
          username,
        } as Parameters<typeof authClient.updateUser>[0]);
        if (error) {
          const msg = error.message || "Failed to update username";
          toast(
            msg.toLowerCase().includes("unique") || msg.toLowerCase().includes("taken")
              ? "That username is already taken"
              : msg,
            "error",
          );
          setIsSaving(false);
          return;
        }
      }

      toast("Profile updated", "success");
    } catch {
      toast("Failed to update profile", "error");
    } finally {
      setIsSaving(false);
    }
  }


  return (
    <div className="rounded-[var(--radius-xl)] border border-border bg-bg-raised p-8">
      <h2 className="font-display text-xl font-semibold text-text">Profile</h2>
      <p className="mt-1 text-sm text-text-muted">
        Update your personal information.
      </p>

      <form onSubmit={handleProfileSubmit} className="mt-6 space-y-4">
        <Input
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <UsernameInput
          value={username}
          onChange={setUsername}
          currentUsername={currentUsername}
          placeholder="optional"
          onAvailabilityChange={setUsernameStatus}
        />
        <div className="flex justify-end">
          <Button
            type="submit"
            size="sm"
            disabled={isSaving || usernameStatus === "taken" || usernameStatus === "checking"}
          >
            {isSaving ? "Saving..." : "Save changes"}
          </Button>
        </div>
      </form>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Change password section                                            */
/* ------------------------------------------------------------------ */

function ChangePasswordSection() {
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
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      toast("Failed to change password", "error");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="rounded-[var(--radius-xl)] border border-border bg-bg-raised p-8">
      <h2 className="font-display text-xl font-semibold text-text">
        Change password
      </h2>
      <p className="mt-1 text-sm text-text-muted">
        Update your password. This will revoke all other sessions.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <Input
          label="Current password"
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          required
          autoComplete="current-password"
        />
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
          <Button
            type="submit"
            size="sm"
            disabled={isSaving}
          >
            {isSaving ? "Changing..." : "Change password"}
          </Button>
        </div>
      </form>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Delete account section                                             */
/* ------------------------------------------------------------------ */

function DeleteAccountSection({ email }: { email: string }) {
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete() {
    setIsDeleting(true);

    try {
      const { error } = await authClient.deleteUser({
        password: undefined,
      });

      if (error) {
        toast(error.message || "Failed to delete account", "error");
        setIsDeleting(false);
        return;
      }

      toast("Account deleted", "success");
      router.push("/auth/login");
    } catch {
      toast("Failed to delete account", "error");
      setIsDeleting(false);
    }
  }

  return (
    <>
      <div className="rounded-[var(--radius-xl)] border border-accent-rose/20 bg-bg-raised p-8">
        <h2 className="font-display text-xl font-semibold text-accent-rose">
          Delete account
        </h2>
        <p className="mt-1 text-sm text-text-muted">
          Permanently delete your account and all associated data. This action
          cannot be undone.
        </p>

        <div className="mt-6">
          <Button
            variant="danger"
            size="sm"
            onClick={() => setShowConfirm(true)}
          >
            Delete account
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={showConfirm}
        title="Delete your account?"
        message="This will permanently delete your account, sessions, and all associated data. This action cannot be undone."
        confirmLabel="Delete account"
        confirmVariant="danger"
        typeToConfirm={email}
        loading={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => setShowConfirm(false)}
      />
    </>
  );
}
