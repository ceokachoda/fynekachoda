import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

// Mock the browser-side Web Push helpers so the hook is tested in isolation.
const subscribeWebPush = vi.fn(async () => true);
let supported = true;
vi.mock("@/lib/web-push", () => ({
  webPushSupported: () => supported,
  subscribeWebPush: () => subscribeWebPush(),
}));

import { useWebPushStatus } from "@/features/notifications/useWebPushStatus";

function setNotificationPermission(p: NotificationPermission | undefined) {
  if (p === undefined) {
    // @ts-expect-error simulate a browser without the Notification API
    delete globalThis.Notification;
    return;
  }
  // @ts-expect-error minimal Notification stub for jsdom
  globalThis.Notification = { permission: p };
}

describe("useWebPushStatus", () => {
  beforeEach(() => {
    supported = true;
    subscribeWebPush.mockClear();
    setNotificationPermission("default");
  });
  afterEach(() => {
    setNotificationPermission("default");
  });

  it("reports 'unsupported' when Web Push is unavailable", async () => {
    supported = false;
    const { result } = renderHook(() => useWebPushStatus());
    await waitFor(() => expect(result.current.permission).toBe("unsupported"));
    expect(result.current.supported).toBe(false);
  });

  it("reflects the granted permission and stays 'supported'", async () => {
    setNotificationPermission("granted");
    const { result } = renderHook(() => useWebPushStatus());
    await waitFor(() => expect(result.current.permission).toBe("granted"));
    expect(result.current.supported).toBe(true);
  });

  it("enable() subscribes when permission is default", async () => {
    const { result } = renderHook(() => useWebPushStatus());
    await waitFor(() => expect(result.current.permission).toBe("default"));
    await act(async () => {
      await result.current.enable();
    });
    expect(subscribeWebPush).toHaveBeenCalledTimes(1);
  });

  it("enable() is a no-op when unsupported (never calls subscribe)", async () => {
    supported = false;
    const { result } = renderHook(() => useWebPushStatus());
    await waitFor(() => expect(result.current.permission).toBe("unsupported"));
    await act(async () => {
      await result.current.enable();
    });
    expect(subscribeWebPush).not.toHaveBeenCalled();
  });
});
