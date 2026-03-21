"use client";

import Link from "next/link";
import { useSession } from "@/lib/auth-client";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { Skeleton } from "@/components/ui/skeleton";

const navItems = [
  { label: "Users", href: "/admin/users" },
  { label: "App Admin", href: "/admin/app" },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, isPending } = useSession();

  if (isPending) {
    return (
      <div className="flex min-h-screen">
        <div className="w-60 bg-bg-raised border-r border-border p-4">
          <Skeleton className="h-6 w-24 mb-4" />
          <Skeleton className="h-8 w-full mb-2" />
          <Skeleton className="h-8 w-full mb-2" />
          <Skeleton className="h-8 w-full" />
        </div>
        <div className="flex-1 p-8">
          <Skeleton className="h-8 w-48 mb-4" />
          <Skeleton className="h-4 w-96 mb-6" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (
    !session ||
    (session.user as Record<string, unknown>).role !== "admin"
  ) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center">
        <h1 className="font-display text-4xl font-bold text-text">
          404 — Page not found
        </h1>
        <Link
          href="/"
          className="mt-4 text-sm text-text-muted hover:text-text transition-colors"
        >
          Go home
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <AdminSidebar items={navItems} />
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
