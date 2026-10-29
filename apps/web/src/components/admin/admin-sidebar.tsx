"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Users, Settings, ArrowLeft, type LucideIcon } from "lucide-react";

const navIcons: Record<string, LucideIcon> = {
  Users: Users,
  "App Admin": Settings,
};

interface NavItem {
  label: string;
  href: string;
}

interface AdminSidebarProps {
  items: NavItem[];
}

export function AdminSidebar({ items }: AdminSidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="flex min-h-screen w-60 flex-col border-r border-border bg-bg-raised p-4">
      <h2 className="mb-5 inline-block self-start -rotate-2 rounded-[var(--radius-sm)] border border-border bg-fill-violet px-2.5 py-0.5 font-display text-lg text-on-fill shadow-control">
        Admin
      </h2>
      <nav className="flex flex-col gap-1.5">
        {items.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = navIcons[item.label];
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 rounded-[var(--radius-md)] border px-3 py-2 text-sm font-semibold transition-colors",
                isActive
                  ? "border-border bg-primary text-primary-text shadow-control"
                  : "border-transparent text-text hover:border-border hover:bg-bg-hover"
              )}
            >
              {Icon && (
                <Icon aria-hidden="true" className="h-4 w-4" />
              )}
              {item.label}
            </Link>
          );
        })}
      </nav>
      <Link
        href="/dashboard"
        className="mt-auto flex items-center gap-2 rounded-[var(--radius-md)] border border-transparent px-3 py-2 text-sm font-semibold text-text-muted transition-colors hover:border-border hover:bg-bg-hover hover:text-text"
      >
        <ArrowLeft aria-hidden="true" className="h-3.5 w-3.5" />
        Back to dashboard
      </Link>
    </aside>
  );
}
