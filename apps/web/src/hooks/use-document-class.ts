"use client";

import { useEffect } from "react";

export const DOCUMENT_MODAL_OPEN_CLASS = "modal-open";

const classCounts = new Map<string, number>();

function getDocumentTargets(): HTMLElement[] {
  if (typeof document === "undefined") return [];

  const targets = [document.documentElement];
  if (document.body) targets.push(document.body);
  return targets;
}

function addDocumentClass(className: string) {
  const count = classCounts.get(className) ?? 0;
  if (count === 0) {
    for (const target of getDocumentTargets()) {
      target.classList.add(className);
    }
  }
  classCounts.set(className, count + 1);
}

function removeDocumentClass(className: string) {
  const count = classCounts.get(className) ?? 0;
  if (count <= 1) {
    classCounts.delete(className);
    for (const target of getDocumentTargets()) {
      target.classList.remove(className);
    }
    return;
  }

  classCounts.set(className, count - 1);
}

/** Holds `className` on <html> and <body> while `active`. Refcounted so
 *  several components can share one class (stacked modals) and it only comes
 *  off when the last of them unmounts. */
export function useDocumentClass(className: string, active = true) {
  useEffect(() => {
    if (!active) return;

    addDocumentClass(className);
    return () => removeDocumentClass(className);
  }, [active, className]);
}
