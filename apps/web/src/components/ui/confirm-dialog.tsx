"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  confirmVariant?: "primary" | "danger";
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
  typeToConfirm?: string;
  /** Extra content between the message and the actions (e.g. a password
   *  field); pair with `confirmDisabled` when it gates confirmation. */
  children?: ReactNode;
  confirmDisabled?: boolean;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  confirmVariant = "primary",
  onConfirm,
  onCancel,
  loading = false,
  typeToConfirm,
  children,
  confirmDisabled: confirmDisabledProp = false,
}: ConfirmDialogProps) {
  const [confirmInput, setConfirmInput] = useState("");

  // The component stays mounted with open=false, so a typed confirmation would
  // otherwise survive into the next open: reset it when `open` flips.
  const [prevOpen, setPrevOpen] = useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (!open) {
      setConfirmInput("");
    }
  }

  if (!open) return null;

  const confirmDisabled =
    loading ||
    confirmDisabledProp ||
    (typeToConfirm !== undefined && confirmInput !== typeToConfirm);

  return (
    <Modal
      onClose={onCancel}
      title={title}
      maxWidth="max-w-md"
      // Confirmations can be triggered from inside another modal (100, or 200
      // for nested hosts), so always stack above — see the z-index contract in
      // globals.css.
      zIndex={300}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant={confirmVariant}
            onClick={onConfirm}
            disabled={confirmDisabled}
          >
            {loading ? "Loading…" : confirmLabel}
          </Button>
        </div>
      }
    >
      <p className="text-sm text-text-muted">{message}</p>
      {children}
      {typeToConfirm !== undefined && (
        <div className="mt-4">
          <Input
            label={`Type ${typeToConfirm} to confirm`}
            value={confirmInput}
            onChange={(e) => setConfirmInput(e.target.value)}
            autoFocus
          />
        </div>
      )}
    </Modal>
  );
}
