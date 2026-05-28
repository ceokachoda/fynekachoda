import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useExamTabSwitchLogger } from "@/features/exams/useExamTabSwitchLogger";

// Mock the edge-fn invoker — the logger is fire-and-forget, but the local
// banner count comes from the server response if it returns 200.
vi.mock("@/lib/edge-fn", () => ({
  invokeEdgeFn: vi.fn(async () => ({
    status: 200,
    body: { tab_switch_count: 1 },
    error: null,
  })),
}));

import { invokeEdgeFn } from "@/lib/edge-fn";

describe("useExamTabSwitchLogger", () => {
  beforeEach(() => {
    (invokeEdgeFn as ReturnType<typeof vi.fn>).mockReset();
    (invokeEdgeFn as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: 200,
      body: { tab_switch_count: 1 },
      error: null,
    });
  });

  afterEach(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    });
  });

  it("starts at zero and does not call the edge fn on mount", () => {
    const { result } = renderHook(() => useExamTabSwitchLogger("attempt-1"));
    expect(result.current.count).toBe(0);
    expect(invokeEdgeFn).not.toHaveBeenCalled();
  });

  it("does nothing when attemptId is null", () => {
    renderHook(() => useExamTabSwitchLogger(null));
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    });
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(invokeEdgeFn).not.toHaveBeenCalled();
  });

  it("logs once on visibilitychange→hidden and surfaces the server count", async () => {
    (invokeEdgeFn as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      status: 200,
      body: { tab_switch_count: 1 },
      error: null,
    });
    const { result } = renderHook(() => useExamTabSwitchLogger("attempt-7"));
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    });
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
      // Let the microtask queue drain.
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(invokeEdgeFn).toHaveBeenCalledTimes(1);
    expect(invokeEdgeFn).toHaveBeenCalledWith("exam-tab-switch", {
      attempt_id: "attempt-7",
    });
    expect(result.current.count).toBe(1);
  });

  it("setInitial seeds the counter from a saved server value", () => {
    const { result } = renderHook(() => useExamTabSwitchLogger("attempt-1"));
    act(() => {
      result.current.setInitial(5);
    });
    expect(result.current.count).toBe(5);
  });

  it("silent on 404 (D-182 fire-and-forget; already submitted)", async () => {
    (invokeEdgeFn as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      status: 404,
      body: { error: "attempt not found" },
      error: null,
    });
    const { result } = renderHook(() => useExamTabSwitchLogger("attempt-x"));
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    });
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
      await Promise.resolve();
      await Promise.resolve();
    });
    // Local optimistic bump still applies; server didn't crash the UI.
    expect(result.current.count).toBe(1);
    // No throw — that's the "silent" bit.
  });
});
