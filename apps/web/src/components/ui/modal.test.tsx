import { expect, test } from "bun:test";
import { renderToString } from "react-dom/server";
import { Modal } from "./modal";
import { ConfirmDialog } from "./confirm-dialog";

test("dialog adapters are safe to render before a browser portal exists", () => {
  // Dialog roles, focus restoration and nested Escape behavior are exercised
  // against the package's packed artifact in its browser suite.
  expect(renderToString(<Modal title="Preview" onClose={() => {}}>Content</Modal>)).not.toContain('role="dialog"');
  expect(renderToString(<ConfirmDialog open title="Delete" message="Confirm deletion" confirmDisabled onConfirm={() => {}} onCancel={() => {}}><input autoFocus /></ConfirmDialog>)).not.toContain('role="dialog"');
});
