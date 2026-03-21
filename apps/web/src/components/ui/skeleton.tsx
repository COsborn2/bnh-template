import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse-soft rounded-[var(--radius-md)] bg-bg-hover",
        className
      )}
    />
  );
}
