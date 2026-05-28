import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { TimerPill } from "@/components/quiz/TimerPill";

describe("TimerPill — server-anchored countdown", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders MM:SS computed against the device clock + mount offset", () => {
    const base = new Date("2026-05-28T10:00:00.000Z").getTime();
    vi.setSystemTime(new Date(base));
    // serverNow == deviceNow → offset 0. deadline at +90s → 01:30.
    render(
      <TimerPill
        deadlineAt={new Date(base + 90_000).toISOString()}
        serverNow={new Date(base).toISOString()}
      />,
    );
    expect(screen.getByRole("timer")).toHaveTextContent("01:30");
  });

  it("ticks downwards every second", () => {
    const base = new Date("2026-05-28T10:00:00.000Z").getTime();
    vi.setSystemTime(new Date(base));
    render(
      <TimerPill
        deadlineAt={new Date(base + 30_000).toISOString()}
        serverNow={new Date(base).toISOString()}
      />,
    );
    expect(screen.getByRole("timer")).toHaveTextContent("00:30");
    // vi.advanceTimersByTime drives both the fake system clock and the
    // setInterval callbacks; wrapping in act() flushes the React state
    // updates synchronously so the next assertion sees the new value.
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(screen.getByRole("timer")).toHaveTextContent("00:25");
  });

  it("turns red when remaining ≤ 60s", () => {
    const base = new Date("2026-05-28T10:00:00.000Z").getTime();
    vi.setSystemTime(new Date(base));
    render(
      <TimerPill
        deadlineAt={new Date(base + 30_000).toISOString()}
        serverNow={new Date(base).toISOString()}
      />,
    );
    expect(screen.getByRole("timer")).toHaveAttribute("data-warning", "true");
  });

  it("calls onExpire exactly once when remaining reaches 0", () => {
    const base = new Date("2026-05-28T10:00:00.000Z").getTime();
    vi.setSystemTime(new Date(base));
    const onExpire = vi.fn();
    render(
      <TimerPill
        deadlineAt={new Date(base + 2_000).toISOString()}
        serverNow={new Date(base).toISOString()}
        onExpire={onExpire}
      />,
    );
    expect(onExpire).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(3_000);
    });
    expect(onExpire).toHaveBeenCalledTimes(1);
    // After deadline, additional ticks must NOT call onExpire again.
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it("uses live offsetMs (exam mode) over the mount snapshot", () => {
    const base = new Date("2026-05-28T10:00:00.000Z").getTime();
    vi.setSystemTime(new Date(base));
    // Device is 30s ahead of server (attacker). serverNow ISO is the same as
    // device, but the live offset corrects -30s → student loses no extra time.
    render(
      <TimerPill
        deadlineAt={new Date(base + 60_000).toISOString()}
        serverNow={new Date(base).toISOString()}
        offsetMs={-30_000}
      />,
    );
    // remaining = 60s - (0 + -30s) = 90s
    expect(screen.getByRole("timer")).toHaveTextContent("01:30");
  });
});
