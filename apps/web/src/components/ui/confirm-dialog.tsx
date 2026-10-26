"use client";

import { ConfirmDialog as SharedConfirmDialog, type ConfirmDialogProps } from "@cosborn2/ui/confirm-dialog";
import "@cosborn2/ui/confirm-dialog.css";
import { DOCUMENT_MODAL_OPEN_CLASS, useDocumentClass } from "@/hooks/use-document-class";

export function ConfirmDialog(props: ConfirmDialogProps) {
  useDocumentClass(DOCUMENT_MODAL_OPEN_CLASS, props.open);
  return <SharedConfirmDialog {...props} />;
}
