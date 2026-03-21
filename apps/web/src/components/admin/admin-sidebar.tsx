"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUsers, faGear, faArrowLeft, type IconDefinition } from "@fortawesome/free-solid-svg-icons";

const navIcons: Record<string, IconDefinition> = {
  Users: faUsers,
  "App Admin": faGear,
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
    <aside className="bg-bg-raised border-r border-border p-4 flex flex-col w-60 min-h-screen">
      <h2 className="text-lg font-semibold mb-4">Admin</h2>
      <nav className="flex flex-col gap-1">
        {items.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 rounded-[var(--radius-md)] px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-bg-hover text-text"
                  : "text-text-muted hover:text-text hover:bg-bg-hover"
              )}
            >
              {navIcons[item.label] && (
                <FontAwesomeIcon icon={navIcons[item.label]} className="h-4 w-4" />
              )}
              {item.label}
            </Link>
          );
        })}
      </nav>
      <Link
        href="/dashboard"
        className="mt-auto flex items-center gap-2 rounded-[var(--radius-md)] px-3 py-2 text-sm transition-colors text-text-muted hover:text-text hover:bg-bg-hover"
      >
        <FontAwesomeIcon icon={faArrowLeft} className="h-3.5 w-3.5" />
        Back to dashboard
      </Link>
    </aside>
  );
}
