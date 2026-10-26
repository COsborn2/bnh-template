import Link from "next/link";
import { TriangleAlert } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 p-4 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-[var(--radius-md)] border border-border bg-fill-yellow text-on-fill shadow-control">
        <TriangleAlert aria-hidden="true" size={40} />
      </span>
      <h1 className="-rotate-2 font-display text-8xl font-extrabold tracking-tight">404</h1>
      <p className="font-mono text-sm font-bold uppercase tracking-wide text-text-muted">Page not found</p>
      <Link href="/" className="link-underline">
        Go home
      </Link>
    </div>
  );
}
