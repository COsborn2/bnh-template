"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient, useSession } from "@/lib/auth-client";
import { DataTable } from "@/components/ui/data-table";
import { ActionsMenu } from "@/components/ui/actions-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { toast } from "@/components/ui/toaster";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronLeft, faChevronRight } from "@fortawesome/free-solid-svg-icons";

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

const LIMIT = 20;

export default function AdminUsersPage() {
  const router = useRouter();
  const { data: session } = useSession();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
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

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const query: Record<string, string | number> = {
        limit: LIMIT,
        offset: page * LIMIT,
        sortBy: "createdAt",
        sortDirection: "desc",
      };

      if (debouncedSearch) {
        query.searchValue = debouncedSearch;
        query.searchField = "name";
        query.searchOperator = "contains";
      }

      // API supports only one filterField per call
      if (roleFilter !== "all") {
        query.filterField = "role";
        query.filterValue = roleFilter;
      } else if (statusFilter !== "all") {
        query.filterField = "banned";
        query.filterValue = statusFilter === "banned" ? "true" : "false";
      }

      const res = await authClient.admin.listUsers({ query } as Parameters<typeof authClient.admin.listUsers>[0]);

      if (res.error) {
        toast(res.error.message ?? "Failed to fetch users", "error");
        setLoading(false);
        return;
      }

      let data: AdminUser[] = (res.data as { users?: AdminUser[] })?.users ?? [];
      const fetchedTotal: number = (res.data as { total?: number })?.total ?? data.length;

      // Client-side status filter when role filter consumed the API filter slot
      if (roleFilter !== "all" && statusFilter !== "all") {
        data = data.filter((u: AdminUser) =>
          statusFilter === "banned" ? u.banned === true : u.banned !== true,
        );
      }

      setUsers(data);
      setTotal(fetchedTotal);
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Failed to fetch users", "error");
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, roleFilter, statusFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Reset page when filters change
  useEffect(() => {
    setPage(0);
  }, [roleFilter, statusFilter]);

  async function handleUnban(userId: string) {
    try {
      const res = await authClient.admin.unbanUser({ userId });
      if (res.error) {
        toast(res.error.message ?? "Failed to unban user", "error");
        return;
      }
      toast("User unbanned", "success");
      fetchUsers();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Failed to unban user", "error");
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
      const res = await authClient.admin.banUser(banParams as Parameters<typeof authClient.admin.banUser>[0]);
      if (res.error) {
        toast(res.error.message ?? "Failed to ban user", "error");
        return;
      }
      toast(`${banTarget.name ?? "User"} banned`, "success");
      setBanTarget(null);
      setBanReason("");
      setBanDuration("");
      fetchUsers();
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
          {user.name}
        </Link>
      ),
    },
    {
      key: "email",
      header: "Email",
      render: (user: AdminUser) => (
        <span>
          {user.email}
          {user.emailVerified && (
            <span className="ml-2 rounded-full bg-accent-green/10 px-1.5 py-0.5 text-xs text-accent-green">
              verified
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
        const role = (user.role as string) ?? "user";
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

  const offset = page * LIMIT;
  const showingStart = total === 0 ? 0 : offset + 1;
  const showingEnd = Math.min(offset + LIMIT, total);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-text">Users</h1>
        <p className="mt-1 text-sm text-text-muted">
          Manage users, roles, and access
        </p>
      </div>

      {/* Top bar controls */}
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Filter users..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          wrapperClassName="w-64"
        />
        <Select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
        >
          <option value="all">All Roles</option>
          <option value="admin">Admin</option>
          <option value="user">User</option>
        </Select>
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="banned">Banned</option>
        </Select>
      </div>

      {/* Table */}
      <DataTable columns={columns} data={users} loading={loading} />

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-text-muted">
          Showing {showingStart}&ndash;{showingEnd} of {total} users
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            <FontAwesomeIcon icon={faChevronLeft} className="mr-1.5 h-3 w-3" />
            Previous
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={offset + LIMIT >= total}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
            <FontAwesomeIcon icon={faChevronRight} className="ml-1.5 h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Ban dialog */}
      {banTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-[var(--radius-xl)] border border-border bg-bg-raised p-6 shadow-2xl">
            <h2 className="font-display text-lg font-bold text-text">
              Ban {banTarget.name}
            </h2>
            <div className="mt-4 space-y-4">
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
            <div className="mt-6 flex justify-end gap-3">
              <Button
                variant="secondary"
                onClick={() => {
                  setBanTarget(null);
                  setBanReason("");
                  setBanDuration("");
                }}
              >
                Cancel
              </Button>
              <Button variant="danger" onClick={handleBan}>
                Ban
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
