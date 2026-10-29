import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

interface SectionHeadingProps {
  title: ReactNode;
  icon?: LucideIcon;
  /** Fill behind the icon tile — one of the `--app-fill-*` tokens. */
  fill?: string;
  count?: number;
  /** Right-hand content after the rule: meta text, actions. */
  children?: ReactNode;
}

/**
 * Page section heading: tilted icon tile, big uppercase title, inverse count
 * badge, then a heavy rule out to the section's own actions
 * (`.app-section-heading` in globals.css).
 */
export function SectionHeading({
  title,
  icon: Icon,
  fill = "var(--app-fill-yellow)",
  count,
  children,
}: SectionHeadingProps) {
  return (
    <div className="app-section-heading">
      {Icon && (
        <span aria-hidden className="app-section-heading__icon" style={{ background: fill }}>
          <Icon size={18} strokeWidth={2.5} />
        </span>
      )}
      <h2 className="app-section-heading__title font-display">{title}</h2>
      {count != null && <span className="app-section-heading__count font-mono">{count}</span>}
      <div className="app-section-heading__rule" />
      {children}
    </div>
  );
}
