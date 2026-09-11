"use client";

import { useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UsernameInput } from "@/components/ui/username-input";
import { toast } from "@/components/ui/toaster";

interface ProfileSectionProps {
  user: { name: string; username?: string | null };
}

export function ProfileSection({ user }: ProfileSectionProps) {
  const [name, setName] = useState(user.name);
  const currentUsername = user.username ?? "";
  const [username, setUsername] = useState(currentUsername);
  const [isSaving, setIsSaving] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<
    "idle" | "checking" | "available" | "taken"
  >("idle");

  const trimmedName = name.trim();
  const dirty = trimmedName !== user.name || username !== currentUsername;

  async function handleProfileSubmit(e: FormEvent) {
    e.preventDefault();

    if (!trimmedName) {
      toast("Name cannot be empty", "error");
      return;
    }

    if (usernameStatus === "taken") {
      toast("That username is already taken", "error");
      return;
    }

    setIsSaving(true);

    try {
      if (trimmedName !== user.name) {
        const { error } = await authClient.updateUser({ name: trimmedName });
        if (error) {
          toast(error.message || "Failed to update name", "error");
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
            msg.toLowerCase().includes("unique") ||
              msg.toLowerCase().includes("taken")
              ? "That username is already taken"
              : msg,
            "error",
          );
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
            disabled={
              !dirty ||
              isSaving ||
              usernameStatus === "taken" ||
              usernameStatus === "checking"
            }
          >
            {isSaving ? "Saving..." : "Save changes"}
          </Button>
        </div>
      </form>
    </div>
  );
}
