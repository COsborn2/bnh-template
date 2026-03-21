import { cn } from "@/lib/utils";
import { type ButtonHTMLAttributes, forwardRef } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled}
        className={cn(
          "inline-flex items-center justify-center rounded-[var(--radius-md)] font-medium transition-all duration-150 focus-ring",
          "disabled:pointer-events-none disabled:opacity-40",
          {
            "bg-primary text-bg hover:bg-primary-hover active:scale-[0.98]":
              variant === "primary",
            "bg-bg-card text-text border border-border hover:bg-bg-hover active:scale-[0.98]":
              variant === "secondary",
            "text-text-muted hover:text-text hover:bg-bg-hover":
              variant === "ghost",
            "bg-accent-rose/10 text-accent-rose border border-accent-rose/20 hover:bg-accent-rose/20":
              variant === "danger",
          },
          {
            "h-8 px-3 text-sm gap-1.5": size === "sm",
            "h-10 px-4 text-sm gap-2": size === "md",
            "h-12 px-6 text-base gap-2.5": size === "lg",
          },
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
