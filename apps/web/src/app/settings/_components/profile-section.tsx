"use client";

import { SettingsCard, SettingsCardHeader } from "@cosborn2/ui/settings";

import { useEffect, useState, type FormEvent } from "react";
import dynamic from "next/dynamic";
import { Pencil } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { UserAvatar } from "@/components/avatar/user-avatar";
import { useAvatarStore, type Avatar } from "@/stores/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UsernameInput } from "@/components/ui/username-input";
import { toast } from "@/components/ui/toaster";

// The editor (renderer + option grids) only loads when someone opens it;
// warmAvatarEditor starts fetching the chunk on hover, focus or touch.
const AvatarEditorModal = dynamic(
  () => import("@/components/avatar/avatar-editor-modal").then((m) => m.AvatarEditorModal),
  { ssr: false },
);
function warmAvatarEditor() {
  void import("@/components/avatar/avatar-editor-modal");
}

interface ProfileSectionProps {
  user: { id: string; name: string; username?: string | null };
  /** The avatar the server page prefetched; shown on first paint and used
   *  to seed the avatar store instead of fetching it again. */
  initialAvatar?: Avatar | null;
}

export function ProfileSection({ user, initialAvatar = null }: ProfileSectionProps) {
  const [name, setName] = useState(user.name);
  const currentUsername = user.username ?? "";
  const [username, setUsername] = useState(currentUsername);
  const [isSaving, setIsSaving] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<
    "idle" | "checking" | "available" | "taken"
  >("idle");
  const storedAvatar = useAvatarStore((s) => s.avatar);
  const avatar = storedAvatar ?? initialAvatar;
  const loadAvatar = useAvatarStore((s) => s.load);
  const primeAvatar = useAvatarStore((s) => s.prime);
  const [editingAvatar, setEditingAvatar] = useState(false);

  useEffect(() => {
    if (initialAvatar) primeAvatar(initialAvatar, user.id);
    loadAvatar().catch(() => {});
  }, [loadAvatar, primeAvatar, initialAvatar, user.id]);

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
    <>
    <SettingsCard>
      <SettingsCardHeader title="Profile" subtitle="Update your personal information." />

      <div className="mt-6 flex items-center gap-4">
        <button
          type="button"
          onClick={() => setEditingAvatar(true)}
          onMouseEnter={warmAvatarEditor}
          onFocus={warmAvatarEditor}
          onTouchStart={warmAvatarEditor}
          aria-label="Change avatar"
          title="Change avatar"
          className="relative shrink-0 cursor-pointer rounded-full border-0 bg-transparent p-0"
        >
          <span className="block rounded-full" style={{ boxShadow: "var(--app-shadow-md)" }}>
            <UserAvatar svg={avatar?.svg} name={user.name} size={64} />
          </span>
          {/* Always visible (not hover-only) so touch screens get the cue. */}
          <span
            aria-hidden
            style={{
              position: "absolute",
              right: -6,
              bottom: -6,
              width: 26,
              height: 26,
              boxSizing: "border-box",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "2px solid var(--app-ink)",
              borderRadius: 4,
              background: "var(--app-select)",
              color: "var(--app-on-fill)",
              boxShadow: "var(--app-shadow-sm)",
            }}
          >
            <Pencil size={13} strokeWidth={2.6} />
          </span>
        </button>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-text">Avatar</div>
          <div className="text-xs text-text-muted">
            Shown on your dashboard and next to your chat messages.
          </div>
        </div>
      </div>

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
    </SettingsCard>
    {editingAvatar && <AvatarEditorModal onClose={() => setEditingAvatar(false)} />}
    </>
  );
}
