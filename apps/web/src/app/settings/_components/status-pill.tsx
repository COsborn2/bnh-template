/** Small green "Verified" / "Connected" style badge used by the settings cards. */
export function StatusPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-[var(--radius-sm)] border border-border bg-fill-green px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide text-on-fill">
      <svg
        width="9"
        height="9"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        aria-hidden="true"
      >
        <path d="M20 6L9 17l-5-5" />
      </svg>
      {children}
    </span>
  );
}
