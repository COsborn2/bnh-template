import { cn } from "@/lib/utils";
import { type InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  wrapperClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, wrapperClassName, label, error, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className={cn("flex flex-col gap-1.5", wrapperClassName)}>
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-text-muted"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            "h-10 w-full rounded-[var(--radius-md)] border border-border bg-bg-input px-3 text-sm text-text",
            "placeholder:text-text-faint",
            "focus:border-border-focus focus:outline-none focus:ring-2 focus:ring-accent-purple/20",
            "transition-colors duration-150",
            error && "border-accent-rose focus:ring-accent-rose/20",
            className
          )}
          {...props}
        />
        {error && <p className="text-xs text-accent-rose">{error}</p>}
      </div>
    );
  }
);
Input.displayName = "Input";
