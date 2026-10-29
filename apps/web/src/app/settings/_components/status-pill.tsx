import { Tag } from "@/components/ui/tag";

/** Small green "Verified" / "Connected" style badge used by the settings cards. */
export function StatusPill({ children }: { children: React.ReactNode }) {
  return (
    <Tag tone="green">
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
    </Tag>
  );
}
