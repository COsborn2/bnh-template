import { cn } from "@/lib/utils";
import { type SelectHTMLAttributes, forwardRef } from "react";

interface SelectProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "size"> {
  label?: string;
  wrapperClassName?: string;
  /** "md" is the standard form-field height; "sm" is compact for in-row use.
   *  Shadows the native `size` (visible rows) attribute on purpose. */
  size?: "md" | "sm";
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    { className, wrapperClassName, label, id, size = "md", children, ...props },
    ref,
  ) => {
    const selectId = id || label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className={cn("flex flex-col gap-1.5", wrapperClassName)}>
        {label && (
          <label
            htmlFor={selectId}
            className="text-sm font-medium text-text-muted"
          >
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={cn(
            "w-full appearance-none rounded-[var(--radius-md)] border border-border bg-bg-input text-text",
            // Mix accents toward transparent (opacity modifier), never into
            // border tokens — oklch hue arcs turn purple-into-warm-brown red
            // in light mode.
            "focus:border-accent-purple/55 focus:outline-none focus:ring-2 focus:ring-accent-purple/20",
            "transition-colors duration-150",
            "bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%239a9389%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat",
            size === "sm"
              ? "h-8 px-2.5 pr-7 text-xs bg-[position:right_6px_center]"
              : "h-10 px-3 pr-8 text-sm bg-[position:right_8px_center]",
            className
          )}
          {...props}
        >
          {children}
        </select>
      </div>
    );
  }
);
Select.displayName = "Select";
