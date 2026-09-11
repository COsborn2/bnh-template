/** Small green "Verified" / "Connected" style badge used by the settings cards. */
export function StatusPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-[var(--radius-sm)] bg-accent-green/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent-green">
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
