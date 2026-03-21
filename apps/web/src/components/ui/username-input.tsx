"use client";

import { useState, useRef, useCallback } from "react";
import { Input } from "@/components/ui/input";

interface UsernameInputProps {
  value: string;
  onChange: (value: string) => void;
  /** The user's current username — skips the availability check when unchanged */
  currentUsername?: string;
  required?: boolean;
  placeholder?: string;
  label?: string;
  /** Called when availability status changes */
  onAvailabilityChange?: (status: "idle" | "checking" | "available" | "taken") => void;
}

export function UsernameInput({
  value,
  onChange,
  currentUsername = "",
  required,
  placeholder = "janedoe",
  label = "Username",
  onAvailabilityChange,
}: UsernameInputProps) {
  const [status, setStatus] = useState<
    "idle" | "checking" | "available" | "taken"
  >("idle");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateStatus = useCallback(
    (newStatus: "idle" | "checking" | "available" | "taken") => {
      setStatus(newStatus);
      onAvailabilityChange?.(newStatus);
    },
    [onAvailabilityChange],
  );

  const checkAvailability = useCallback(
    (username: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);

      const normalized = username.toLowerCase().trim();
      if (!normalized || normalized === currentUsername.toLowerCase()) {
        updateStatus("idle");
        return;
      }

      updateStatus("checking");
      debounceRef.current = setTimeout(async () => {
        try {
          const res = await fetch("/api/auth/is-username-available", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ username: normalized }),
          });
          if (res.ok) {
            const body = await res.json();
            updateStatus(body.available ? "available" : "taken");
          } else {
            updateStatus("idle");
          }
        } catch {
          updateStatus("idle");
        }
      }, 400);
    },
    [currentUsername, updateStatus],
  );

  function handleChange(newValue: string) {
    onChange(newValue);
    checkAvailability(newValue);
  }

  const hint =
    status === "checking"
      ? "Checking availability..."
      : status === "available"
        ? "Username is available"
        : undefined;

  const hintColor =
    status === "available" ? "text-accent-green" : "text-text-faint";

  return (
    <div>
      <Input
        label={label}
        type="text"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        autoComplete="username"
        error={status === "taken" ? "Username is already taken" : undefined}
      />
      {hint && (
        <p className={`mt-1 text-xs ${hintColor}`}>{hint}</p>
      )}
    </div>
  );
}
