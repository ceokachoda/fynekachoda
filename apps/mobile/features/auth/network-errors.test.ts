import { describe, it, expect } from "@jest/globals";
import {
  isNetworkError,
  NETWORK_ERROR_MESSAGE,
  TimeoutError,
  withTimeout,
} from "./network-errors";

describe("isNetworkError", () => {
  it("returns true for TypeError (RN's fetch-failed shape)", () => {
    expect(isNetworkError(new TypeError("Network request failed"))).toBe(true);
  });

  it("returns true for Error with 'Network request failed' message", () => {
    expect(isNetworkError(new Error("Network request failed"))).toBe(true);
  });

  it("returns true for Error with 'Failed to fetch' message (web)", () => {
    expect(isNetworkError(new Error("Failed to fetch"))).toBe(true);
  });

  it("matches case-insensitively", () => {
    expect(isNetworkError(new Error("NETWORK error during request"))).toBe(true);
  });

  it("returns true for non-Error throwables matching the pattern", () => {
    expect(isNetworkError("Network request failed at line 42")).toBe(true);
  });

  it("returns false for unrelated errors", () => {
    expect(isNetworkError(new Error("Invalid login credentials"))).toBe(false);
  });

  it("returns false for null / undefined", () => {
    expect(isNetworkError(null)).toBe(false);
    expect(isNetworkError(undefined)).toBe(false);
  });

  it("returns false for an empty string", () => {
    expect(isNetworkError("")).toBe(false);
  });
});

describe("NETWORK_ERROR_MESSAGE", () => {
  it("is a user-facing string", () => {
    expect(NETWORK_ERROR_MESSAGE).toMatch(/internet|connection/i);
  });
});

describe("TimeoutError", () => {
  it("is classified as a network error", () => {
    expect(isNetworkError(new TimeoutError())).toBe(true);
  });

  it("matches 'timed out' substring in regular Error", () => {
    expect(isNetworkError(new Error("Request timed out after 15s"))).toBe(true);
  });

  it("matches AbortController's 'aborted' message", () => {
    expect(isNetworkError(new Error("The operation was aborted"))).toBe(true);
  });
});

describe("withTimeout", () => {
  it("resolves when the inner promise wins the race", async () => {
    const result = await withTimeout(Promise.resolve("ok"), 100);
    expect(result).toBe("ok");
  });

  it("rejects with TimeoutError when the timer wins", async () => {
    const slow = new Promise((resolve) => setTimeout(resolve, 200, "late"));
    await expect(withTimeout(slow, 10)).rejects.toBeInstanceOf(TimeoutError);
  });

  it("propagates the inner promise's rejection unchanged", async () => {
    const failed = Promise.reject(new Error("upstream fail"));
    await expect(withTimeout(failed, 100)).rejects.toThrow("upstream fail");
  });

  it("uses the default timeout when ms is omitted", async () => {
    // The default is 15s — we just confirm it accepts no second arg without
    // throwing. We don't wait 15s in the test suite.
    const result = await withTimeout(Promise.resolve(42));
    expect(result).toBe(42);
  });
});
