"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { authClient, useSession } from "@/lib/auth-client";
import { DataTable } from "@/components/ui/data-table";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toaster";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBan,
  faCheck,
  faUserSecret,
  faTrash,
  faRightFromBracket,
  faShield,
} from "@fortawesome/free-solid-svg-icons";

interface AdminUser {
  id: string;
  name: string | null;
  email: string;
  emailVerified: boolean;
  username?: string | null;
  role: string;
  banned: boolean;
  banReason: string | null;
  banExpires: string | null;
  createdAt: Date;
}

interface AdminSession {
  token: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: Date;
  expiresAt?: Date | null;
}

export default function UserDetailPage() {
  const router = useRouter();
  const params = useParams();
  const userId = params.id as string;
  const { data: sessionData } = useSession();

  const [user, setUser] = useState<AdminUser | null>(null);
  const [userLoading, setUserLoading] = useState(true);
  const [userError, setUserError] = useState(false);

  const [sessions, setSessions] = useState<AdminSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);

  // Role change
  const [selectedRole, setSelectedRole] = useState<string>("user");

  // Ban form
  const [banReason, setBanReason] = useState("");
  const [banDuration, setBanDuration] = useState<string>("");

  // Confirm dialogs
  const [revokeAllOpen, setRevokeAllOpen] = useState(false);
  const [revokeAllLoading, setRevokeAllLoading] = useState(false);
  const [impersonateOpen, setImpersonateOpen] = useState(false);
  const [impersonateLoading, setImpersonateLoading] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const currentUserId = sessionData?.user?.id;
  const isSelf = currentUserId === userId;

  // Fetch user
  const fetchUser = useCallback(async () => {
    setUserLoading(true);
    setUserError(false);
    try {
      const res = await authClient.admin.getUser(
        { query: { id: userId } } as Parameters<typeof authClient.admin.getUser>[0],
      );
      if (res.error || !res.data) {
        setUserError(true);
        setUserLoading(false);
        return;
      }
      const u = res.data as AdminUser;
      setUser(u);
      setSelectedRole((u.role as string) ?? "user");
    } catch {
      setUserError(true);
    } finally {
      setUserLoading(false);
    }
  }, [userId]);

  // Fetch sessions
  const fetchSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      const res = await authClient.admin.listUserSessions(
        { userId } as Parameters<
          typeof authClient.admin.listUserSessions
        >[0],
      );
      if (res.error) {
        toast(res.error.message ?? "Failed to fetch sessions", "error");
        setSessionsLoading(false);
        return;
      }
      setSessions(res.data.sessions ?? []);
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Failed to fetch sessions", "error");
    } finally {
      setSessionsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchUser();
    fetchSessions();
  }, [fetchUser, fetchSessions]);

  // ---------- Actions ----------

  async function handleRoleUpdate() {
    try {
      const res = await authClient.admin.setRole({
        userId,
        role: selectedRole as "admin" | "user",
      } as Parameters<typeof authClient.admin.setRole>[0]);
      if (res.error) {
        toast(res.error.message ?? "Failed to update role", "error");
        return;
      }
      toast(`Role updated to ${selectedRole}`, "success");
      fetchUser();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Failed to update role", "error");
    }
  }

  async function handleBan() {
    try {
      const banParams: {
        userId: string;
        banReason?: string;
        banExpiresIn?: number;
      } = { userId };
      if (banReason) banParams.banReason = banReason;
      if (banDuration) banParams.banExpiresIn = Number(banDuration);

      const res = await authClient.admin.banUser(
        banParams as Parameters<typeof authClient.admin.banUser>[0],
      );
      if (res.error) {
        toast(res.error.message ?? "Failed to ban user", "error");
        return;
      }
      toast("User banned", "success");
      setBanReason("");
      setBanDuration("");
      fetchUser();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Failed to ban user", "error");
    }
  }

  async function handleUnban() {
    try {
      const res = await authClient.admin.unbanUser(
        { userId } as Parameters<typeof authClient.admin.unbanUser>[0],
      );
      if (res.error) {
        toast(res.error.message ?? "Failed to unban user", "error");
        return;
      }
      toast("User unbanned", "success");
      fetchUser();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Failed to unban user", "error");
    }
  }

  async function handleRevokeAll() {
    setRevokeAllLoading(true);
    try {
      const res = await authClient.admin.revokeUserSessions(
        { userId } as Parameters<
          typeof authClient.admin.revokeUserSessions
        >[0],
      );
      if (res.error) {
        toast(res.error.message ?? "Failed to revoke sessions", "error");
        return;
      }
      toast("All sessions revoked", "success");
      setRevokeAllOpen(false);
      fetchSessions();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Failed to revoke sessions", "error");
    } finally {
      setRevokeAllLoading(false);
    }
  }

  async function handleImpersonate() {
    setImpersonateLoading(true);
    try {
      const res = await authClient.admin.impersonateUser(
        { userId } as Parameters<
          typeof authClient.admin.impersonateUser
        >[0],
      );
      if (res.error) {
        toast(res.error.message ?? "Failed to impersonate user", "error");
        return;
      }
      setImpersonateOpen(false);
      // Hard reload to pick up the new impersonation session cookie
      window.location.href = "/dashboard";
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Failed to impersonate user", "error");
    } finally {
      setImpersonateLoading(false);
    }
  }

  async function handleDelete() {
    setDeleteLoading(true);
    try {
      const res = await authClient.admin.removeUser(
        { userId } as Parameters<typeof authClient.admin.removeUser>[0],
      );
      if (res.error) {
        toast(res.error.message ?? "Failed to delete user", "error");
        return;
      }
      toast("User deleted", "success");
      setDeleteOpen(false);
      router.push("/admin/users");
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Failed to delete user", "error");
    } finally {
      setDeleteLoading(false);
    }
  }

  async function handleRevokeSession(token: string) {
    try {
      const res = await authClient.admin.revokeUserSession(
        { sessionToken: token } as Parameters<
          typeof authClient.admin.revokeUserSession
        >[0],
      );
      if (res.error) {
        toast(res.error.message ?? "Failed to revoke session", "error");
        return;
      }
      toast("Session revoked", "success");
      fetchSessions();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Failed to revoke session", "error");
    }
  }

  // ---------- Session table columns ----------

  const sessionColumns = [
    {
      key: "ipAddress",
      header: "IP Address",
      render: (s: AdminSession) => (
        <span className="font-mono text-xs">
          {s.ipAddress ?? <span className="text-text-muted">&mdash;</span>}
        </span>
      ),
    },
    {
      key: "userAgent",
      header: "User Agent",
      render: (s: AdminSession) => {
        const ua: string = s.userAgent ?? "";
        return (
          <span className="text-xs" title={ua}>
            {ua.length > 60 ? `${ua.slice(0, 60)}...` : ua || <span className="text-text-muted">&mdash;</span>}
          </span>
        );
      },
    },
    {
      key: "createdAt",
      header: "Created At",
      render: (s: AdminSession) =>
        s.createdAt
          ? new Date(s.createdAt).toLocaleString()
          : <span className="text-text-muted">&mdash;</span>,
    },
    {
      key: "expiresAt",
      header: "Expires At",
      render: (s: AdminSession) =>
        s.expiresAt
          ? new Date(s.expiresAt).toLocaleString()
          : <span className="text-text-muted">&mdash;</span>,
    },
    {
      key: "actions",
      header: "",
      render: (s: AdminSession) => (
        <Button
          variant="danger"
          size="sm"
          onClick={() => handleRevokeSession(s.token)}
        >
          Revoke
        </Button>
      ),
    },
  ];

  // ---------- Loading state ----------

  if (userLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-6 w-48" />
        <div className="rounded-[var(--radius-xl)] border border-border bg-bg-raised p-6 space-y-4">
          <Skeleton className="h-5 w-64" />
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="rounded-[var(--radius-xl)] border border-border bg-bg-raised p-6 space-y-4">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    );
  }

  // ---------- Error state ----------

  if (userError || !user) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <h1 className="font-display text-2xl font-bold text-text">
          User not found
        </h1>
        <Link
          href="/admin/users"
          className="mt-4 text-sm text-text-muted hover:text-text transition-colors"
        >
          Back to users
        </Link>
      </div>
    );
  }

  // ---------- Render ----------

  const isBanned = user.banned === true;

  return (
    <div className="space-y-6">
      {/* Back link + heading */}
      <div>
        <Link
          href="/admin/users"
          className="text-sm text-text-muted hover:text-text transition-colors"
        >
          &larr; Back to users
        </Link>
        <h1 className="mt-2 font-display text-2xl font-bold text-text">
          {user.name ?? "Unnamed User"}
        </h1>
      </div>

      {/* 1. User Info Card */}
      <div className="rounded-[var(--radius-xl)] border border-border bg-bg-raised p-6 space-y-3">
        <h2 className="font-display text-lg font-semibold text-text">
          User Info
        </h2>

        <div className="grid gap-2 text-sm">
          <div className="flex gap-2">
            <span className="font-medium text-text-muted w-28">Name</span>
            <span className="text-text">{user.name ?? <span className="text-text-muted">&mdash;</span>}</span>
          </div>
          <div className="flex gap-2">
            <span className="font-medium text-text-muted w-28">Email</span>
            <span className="text-text">
              {user.email}
              {user.emailVerified && (
                <span className="ml-2 rounded-full bg-accent-green/10 px-1.5 py-0.5 text-xs text-accent-green">
                  verified
                </span>
              )}
            </span>
          </div>
          <div className="flex gap-2">
            <span className="font-medium text-text-muted w-28">Username</span>
            <span className="text-text">
              {user.username ? `@${user.username}` : <span className="text-text-muted">&mdash;</span>}
            </span>
          </div>
          <div className="flex gap-2">
            <span className="font-medium text-text-muted w-28">Role</span>
            <span className="text-text">
              {((user.role as string) ?? "user").charAt(0).toUpperCase() +
                ((user.role as string) ?? "user").slice(1)}
            </span>
          </div>
          <div className="flex gap-2">
            <span className="font-medium text-text-muted w-28">Created</span>
            <span className="text-text">
              {new Date(user.createdAt).toLocaleString()}
            </span>
          </div>
        </div>

        {/* Banned notice */}
        {isBanned && (
          <div className="mt-4 rounded-[var(--radius-md)] border border-accent-rose/20 bg-accent-rose/5 p-4 space-y-1">
            <p className="text-sm font-medium text-accent-rose">
              This user is banned
            </p>
            {user.banReason && (
              <p className="text-sm text-accent-rose/80">
                <span className="font-medium">Reason:</span> {user.banReason}
              </p>
            )}
            {user.banExpires && (
              <p className="text-sm text-accent-rose/80">
                <span className="font-medium">Expires:</span>{" "}
                {new Date(user.banExpires).toLocaleString()}
              </p>
            )}
          </div>
        )}
      </div>

      {/* 2. Actions Card */}
      <div className="rounded-[var(--radius-xl)] border border-border bg-bg-raised p-6 space-y-6">
        <h2 className="font-display text-lg font-semibold text-text">
          Actions
        </h2>

        {isSelf && (
          <p className="text-sm text-text-muted">
            You cannot perform destructive actions on your own account.
          </p>
        )}

        {/* Change role */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-text-muted">
            Change role
          </label>
          <div className="flex items-center gap-3">
            <Select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              disabled={isSelf}
            >
              <option value="admin">Admin</option>
              <option value="user">User</option>
            </Select>
            <Button
              onClick={handleRoleUpdate}
              disabled={isSelf}
              size="sm"
            >
              <FontAwesomeIcon icon={faShield} className="mr-1.5 h-3.5 w-3.5" />
              Update role
            </Button>
          </div>
        </div>

        {/* Ban / Unban */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-text-muted">
            {isBanned ? "Unban user" : "Ban user"}
          </label>
          {isBanned ? (
            <div>
              <Button
                onClick={handleUnban}
                disabled={isSelf}
              >
                <FontAwesomeIcon icon={faCheck} className="mr-1.5 h-3.5 w-3.5" />
                Unban user
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-end gap-3">
              <Input
                label="Reason (optional)"
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                disabled={isSelf}
                wrapperClassName="w-64"
              />
              <Select
                label="Duration"
                value={banDuration}
                onChange={(e) => setBanDuration(e.target.value)}
                disabled={isSelf}
              >
                <option value="3600">1 hour</option>
                <option value="86400">24 hours</option>
                <option value="604800">7 days</option>
                <option value="2592000">30 days</option>
                <option value="">Permanent</option>
              </Select>
              <Button
                variant="danger"
                onClick={handleBan}
                disabled={isSelf}
              >
                <FontAwesomeIcon icon={faBan} className="mr-1.5 h-3.5 w-3.5" />
                Ban user
              </Button>
            </div>
          )}
        </div>

        {/* Revoke all sessions */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-text-muted">
            Revoke all sessions
          </label>
          <div>
            <Button
              variant="secondary"
              onClick={() => setRevokeAllOpen(true)}
            >
              <FontAwesomeIcon icon={faRightFromBracket} className="mr-1.5 h-3.5 w-3.5" />
              Revoke all sessions
            </Button>
          </div>
        </div>

        {/* Impersonate */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-text-muted">
            Impersonate
          </label>
          <div>
            <Button
              variant="secondary"
              onClick={() => setImpersonateOpen(true)}
              disabled={isSelf}
            >
              <FontAwesomeIcon icon={faUserSecret} className="mr-1.5 h-3.5 w-3.5" />
              Impersonate user
            </Button>
          </div>
        </div>

        {/* Delete user */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-text-muted">
            Delete user
          </label>
          <div>
            <Button
              variant="danger"
              onClick={() => setDeleteOpen(true)}
              disabled={isSelf}
            >
              <FontAwesomeIcon icon={faTrash} className="mr-1.5 h-3.5 w-3.5" />
              Delete user
            </Button>
          </div>
        </div>
      </div>

      {/* 3. Sessions Table */}
      <div className="rounded-[var(--radius-xl)] border border-border bg-bg-raised p-6 space-y-4">
        <h2 className="font-display text-lg font-semibold text-text">
          Sessions
        </h2>
        <DataTable
          columns={sessionColumns}
          data={sessions}
          loading={sessionsLoading}
          emptyMessage="No active sessions."
        />
      </div>

      {/* Confirm dialogs */}
      <ConfirmDialog
        open={revokeAllOpen}
        title="Revoke all sessions"
        message="Are you sure you want to revoke all sessions for this user? They will be logged out everywhere."
        confirmLabel="Revoke all"
        confirmVariant="danger"
        onConfirm={handleRevokeAll}
        onCancel={() => setRevokeAllOpen(false)}
        loading={revokeAllLoading}
      />

      <ConfirmDialog
        open={impersonateOpen}
        title="Impersonate user"
        message="You will be logged in as this user. Use the banner at the top to stop impersonating."
        confirmLabel="Impersonate"
        onConfirm={handleImpersonate}
        onCancel={() => setImpersonateOpen(false)}
        loading={impersonateLoading}
      />

      <ConfirmDialog
        open={deleteOpen}
        title="Delete user"
        message={`This action cannot be undone. This will permanently delete the user account for ${user.email}.`}
        confirmLabel="Delete user"
        confirmVariant="danger"
        typeToConfirm={user.email}
        onConfirm={handleDelete}
        onCancel={() => setDeleteOpen(false)}
        loading={deleteLoading}
      />
    </div>
  );
}
