import { afterEach, describe, expect, test } from "bun:test";
import { toast, useToastStore } from "./toaster";

afterEach(() => useToastStore.setState({ toasts: [] }));

describe("application notification policy", () => {
  test("success and default info notifications expire after five seconds", () => {
    toast("Saved", "success");
    toast("Ready");
    const notifications = useToastStore.getState().toasts;
    expect(notifications.map(({ type, duration }) => ({ type, duration }))).toEqual([
      { type: "success", duration: 5000 }, { type: "info", duration: 5000 },
    ]);
    expect(notifications[0].id).not.toBe(notifications[1].id);
  });

  test("errors remain until acknowledged and preserve their optional action", () => {
    let retried = false;
    const action = { label: "Retry", onClick: () => { retried = true; } };
    toast("Could not save", "error", action);
    const notification = useToastStore.getState().toasts[0];
    expect(notification.duration).toBe(0);
    expect(notification.action).toBe(action);
    expect(retried).toBe(false);
  });

  test("acknowledging one notification preserves the others", () => {
    toast("First", "error");
    toast("Second", "error");
    const [first, second] = useToastStore.getState().toasts;
    useToastStore.getState().removeToast(first.id);
    expect(useToastStore.getState().toasts).toEqual([second]);
  });
});
