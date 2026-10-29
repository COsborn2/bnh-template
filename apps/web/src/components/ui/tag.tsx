import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export type TagTone = "yellow" | "green" | "pink" | "blue" | "violet" | "orange" | "red";

interface TagProps extends ComponentProps<"span"> {
  /** Bright `--app-fill-*` block with dark text; omit for the muted surface. */
  tone?: TagTone;
}

/** Small square uppercase label for statuses and roles (`.app-tag` in globals.css). */
export function Tag({ tone, className, ...props }: TagProps) {
  return <span data-tone={tone} className={cn("app-tag", className)} {...props} />;
}
