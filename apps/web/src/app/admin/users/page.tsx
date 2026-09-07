"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient, useSession } from "@/lib/auth-client";
import { api } from "@/lib/api";
import { PAGE_SIZE } from "@/lib/pagination";
import { DataTable } from "@/components/ui/data-table";
import { ActionsMenu } from "@/components/ui/actions-menu";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Pagination } from "@/components/ui/pagination";
import { toast } from "@/components/ui/toaster";

/** Row shape of GET /api/admin/users; dates are ISO strings. */
interface AdminUser {
  id: string;
  name: string | null;
  email: string;
  emailVerified: boolean;
  username: string | null;
  role: string;
  banned: boolean;
  banReason: string | null;
  banExpires: string | null;
  createdAt: string;
}

interface AdminUsersResponse {
  users: AdminUser[];
  total: number;
  limit: number;
  offset: number;
}

export default function AdminUsersPage() {
  const router = useRouter();
  const { data: session } = useSession();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [verifiedFilter, setVerifiedFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [banTarget, setBanTarget] = useState<AdminUser | null>(null);
  const [banReason, setBanReason] = useState("");
  const [banDuration, setBanDuration] = useState<string>("");

  // Debounced search value
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(0);
    }, 300);
    return () => {
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }
    };
  }, [search]);

  // Responses can arrive out of order while typing (each debounced keystroke
  // and filter change is its own request); only the latest one may land.
  const requestRef = useRef(0);
  // Bumped by actions (ban/unban) to refetch the current page.
  const [refreshTick, setRefreshTick] = useState(0);
  // Loading is derived rather than set inside the fetch effect: the rows on
  // screen belong to `loadedKey`, so any change to the query (or a refresh)
  // shows the loading state until the matching response lands.
  const queryKey = [
    page,
    debouncedSearch,
    roleFilter,
    statusFilter,
    verifiedFilter,
    refreshTick,
  ].join("|");
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const loading = loadedKey !== queryKey;

  useEffect(() => {
    const requestId = ++requestRef.current;
    const params = new URLSearchParams({
      limit: String(PAGE_SIZE),
      offset: String(page * PAGE_SIZE),
    });
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (roleFilter !== "all") params.set("role", roleFilter);
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (verifiedFilter !== "all") params.set("verified", verifiedFilter);

    api<AdminUsersResponse>(`/admin/users?${params}`)
      .then((data) => {
        if (requestId !== requestRef.current) return;
        setUsers(data.users);
        setTotal(data.total);
        setLoadedKey(queryKey);
      })
      .catch((err: unknown) => {
        if (requestId !== requestRef.current) return;
        toast(
          err instanceof Error ? err.message : "Failed to fetch users",
          "error",
        );
        setLoadedKey(queryKey);
      });
  }, [
    page,
    debouncedSearch,
    roleFilter,
    statusFilter,
    verifiedFilter,
    queryKey,
  ]);

  const refreshUsers = () => setRefreshTick((tick) => tick + 1);

  // Rows navigate to the detail page via router.push from the actions menu,
  // which Next never prefetches (only <Link> targets are): warm the route on
  // hover/focus, once per row.
  const prefetchedIds = useRef(new Set<string>());
  const handleRowIntent = useCallback(
    (user: AdminUser) => {
      if (prefetchedIds.current.has(user.id)) return;
      prefetchedIds.current.add(user.id);
      router.prefetch(`/admin/users/${user.id}`);
    },
    [router],
  );

  function closeBanDialog() {
    setBanTarget(null);
    setBanReason("");
    setBanDuration("");
  }

  async function handleUnban(userId: string) {
    try {
      const res = await authClient.admin.unbanUser({ userId });
      if (res.error) {
        toast(res.error.message ?? "Failed to unban user", "error");
        return;
      }
      toast("User unbanned", "success");
      refreshUsers();
    } catch (err: unknown) {
      toast(
        err instanceof Error ? err.message : "Failed to unban user",
        "error",
      );
    }
  }

  async function handleBan() {
    if (!banTarget) return;
    try {
      const banParams: {
        userId: string;
        banReason?: string;
        banExpiresIn?: number;
      } = { userId: banTarget.id };
      if (banReason) banParams.banReason = banReason;
      if (banDuration) banParams.banExpiresIn = Number(banDuration);
      const res = await authClient.admin.banUser(
        banParams as Parameters<typeof authClient.admin.banUser>[0],
      );
      if (res.error) {
        toast(res.error.message ?? "Failed to ban user", "error");
        return;
      }
      toast(`${banTarget.name ?? "User"} banned`, "success");
      closeBanDialog();
      refreshUsers();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Failed to ban user", "error");
    }
  }

  const currentUserId = session?.user?.id;

  const columns = [
    {
      key: "name",
      header: "Name",
      render: (user: AdminUser) => (
        <Link
          href={`/admin/users/${user.id}`}
          className="text-accent-purple hover:underline"
        >
          {user.name ?? "Unnamed User"}
        </Link>
      ),
    },
    {
      key: "email",
      header: "Email",
      render: (user: AdminUser) => (
        <span>
          {user.email}
          {user.emailVerified ? (
            <span className="ml-2 rounded-full bg-accent-green/10 px-1.5 py-0.5 text-xs text-accent-green">
              verified
            </span>
          ) : (
            <span className="ml-2 rounded-full bg-text-muted/10 px-1.5 py-0.5 text-xs text-text-muted">
              unverified
            </span>
          )}
        </span>
      ),
    },
    {
      key: "username",
      header: "Username",
      render: (user: AdminUser) =>
        user.username ? (
          <span>@{user.username}</span>
        ) : (
          <span className="text-text-muted">&mdash;</span>
        ),
    },
    {
      key: "role",
      header: "Role",
      render: (user: AdminUser) => {
        const role = user.role ?? "user";
        return <span>{role.charAt(0).toUpperCase() + role.slice(1)}</span>;
      },
    },
    {
      key: "status",
      header: "Status",
      render: (user: AdminUser) =>
        user.banned ? (
          <span className="text-accent-rose">Banned</span>
        ) : (
          <span className="text-accent-green">Active</span>
        ),
    },
    {
      key: "created",
      header: "Created",
      render: (user: AdminUser) =>
        new Date(user.createdAt).toLocaleDateString(),
    },
    {
      key: "actions",
      header: "Actions",
      render: (user: AdminUser) => {
        const isSelf = user.id === currentUserId;

        const items = [
          {
            label: "View details",
            onClick: () => router.push(`/admin/users/${user.id}`),
          },
          ...(user.banned
            ? [
                {
                  label: "Unban user",
                  onClick: () => handleUnban(user.id),
                  disabled: isSelf,
                },
              ]
            : [
                {
                  label: "Ban user",
                  onClick: () => {
                    setBanTarget(user);
                    setBanReason("");
                    setBanDuration("");
                  },
                  variant: "danger" as const,
                  disabled: isSelf,
                },
              ]),
        ];

        return <ActionsMenu items={items} />;
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-text">Users</h1>
        <p className="mt-1 text-sm text-text-muted">
          Manage users, roles, and access
        </p>
      </div>

      {/* Top bar controls. Every filter resets to the first page: the server
          combines them, so a page index from another result set is stale. */}
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Filter users..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          wrapperClassName="w-64"
        />
        <Select
          aria-label="Role"
          value={roleFilter}
          onChange={(e) => {
            setRoleFilter(e.target.value);
            setPage(0);
          }}
        >
          <option value="all">All Roles</option>
          <option value="admin">Admin</option>
          <option value="user">User</option>
        </Select>
        <Select
          aria-label="Status"
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(0);
          }}
        >
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="banned">Banned</option>
        </Select>
        <Select
          aria-label="Email verification"
          value={verifiedFilter}
          onChange={(e) => {
            setVerifiedFilter(e.target.value);
            setPage(0);
          }}
        >
          <option value="all">All Verification</option>
          <option value="verified">Verified</option>
          <option value="unverified">Unverified</option>
        </Select>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={users}
        loading={loading}
        onRowIntent={handleRowIntent}
      />

      <Pagination
        page={page}
        total={total}
        itemLabel="user"
        onPageChange={setPage}
      />

      {/* Ban dialog */}
      {banTarget && (
        <Modal
          onClose={closeBanDialog}
          title={`Ban ${banTarget.name ?? "user"}`}
          subtitle="Restrict this user's access."
          maxWidth="max-w-md"
          footer={
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={closeBanDialog}>
                Cancel
              </Button>
              <Button variant="danger" onClick={handleBan}>
                Ban
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            <Input
              label="Reason (optional)"
              value={banReason}
              onChange={(e) => setBanReason(e.target.value)}
            />
            <Select
              label="Duration"
              value={banDuration}
              onChange={(e) => setBanDuration(e.target.value)}
            >
              <option value="">Permanent</option>
              <option value="3600">1 hour</option>
              <option value="86400">24 hours</option>
              <option value="604800">7 days</option>
              <option value="2592000">30 days</option>
            </Select>
          </div>
        </Modal>
      )}
    </div>
  );
}
