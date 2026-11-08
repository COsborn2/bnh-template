import { expect, test } from "bun:test";
import { getViewerId, registerViewerScopedStore, setViewer } from "./viewer-scope";

test("resets viewer-scoped stores only when a signed-in account goes away", () => {
  setViewer(null); // module state is shared with other test files
  let resets = 0;
  registerViewerScopedStore(() => {
    resets += 1;
  });

  setViewer("alice"); // session resolving on a fresh tab
  expect(getViewerId()).toBe("alice");
  expect(resets).toBe(0);

  setViewer("alice"); // a refetch that changes nothing
  expect(resets).toBe(0);

  setViewer("bob"); // impersonation, or a second sign-in
  expect(resets).toBe(1);

  setViewer(null); // sign-out
  expect(getViewerId()).toBeNull();
  expect(resets).toBe(2);

  setViewer("carol"); // next person signs in: already reset at sign-out
  expect(resets).toBe(2);
});
