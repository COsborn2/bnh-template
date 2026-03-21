"use client";

const RULES = [
  { test: (p: string) => p.length >= 8, label: "At least 8 characters" },
  { test: (p: string) => /[A-Z]/.test(p), label: "One uppercase letter" },
  { test: (p: string) => /[a-z]/.test(p), label: "One lowercase letter" },
  { test: (p: string) => /\d/.test(p), label: "One number" },
] as const;

interface PasswordRequirementsProps {
  password: string;
}

export function PasswordRequirements({ password }: PasswordRequirementsProps) {
  if (!password) return null;

  return (
    <ul className="-mt-3 space-y-1">
      {RULES.map((rule) => {
        const passed = rule.test(password);
        return (
          <li
            key={rule.label}
            className={`flex items-center gap-1.5 text-xs transition-colors duration-200 ${
              passed ? "text-accent-green" : "text-text-faint"
            }`}
          >
            <span className="text-[10px]">{passed ? "\u2713" : "\u2022"}</span>
            {rule.label}
          </li>
        );
      })}
    </ul>
  );
}

/** Check all rules pass — use for form validation */
export function passwordMeetsRequirements(password: string): boolean {
  return RULES.every((rule) => rule.test(password));
}
