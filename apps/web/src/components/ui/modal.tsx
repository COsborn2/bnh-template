"use client";

import { Modal as SharedModal } from "@cosborn2/ui/modal";
import "@cosborn2/ui/modal.css";
import type { ReactNode } from "react";
import { DOCUMENT_MODAL_OPEN_CLASS, useDocumentClass } from "@/hooks/use-document-class";

interface ModalProps {
  onClose: () => void;
  children: ReactNode;
  title?: ReactNode;
  subtitle?: ReactNode;
  headerActions?: ReactNode;
  ariaLabel?: string;
  maxWidth?: string;
  footer?: ReactNode;
  persistent?: boolean;
  zIndex?: number;
  bodyClassName?: string;
}

/** App adapter preserves document chrome coordination and legacy width utilities. */
export function Modal({ onClose, maxWidth, ...props }: ModalProps) {
  useDocumentClass(DOCUMENT_MODAL_OPEN_CLASS);
  return <SharedModal {...props} open onOpenChange={(open) => { if (!open) onClose(); }} className={maxWidth} />;
}
