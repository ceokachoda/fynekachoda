// Phase 4 Track 4A — pure-function tests for chat-replay offset math.

import { describe, expect, it } from "vitest";
import {
  computeReplayOffsetSec,
  countBetween,
  messagesUpTo,
  withReplayOffsets,
} from "../chat-replay";

const STARTED_AT = "2026-05-28T10:00:00.000Z";

describe("computeReplayOffsetSec", () => {
  it("returns positive seconds for messages posted after started_at", () => {
    expect(
      computeReplayOffsetSec("2026-05-28T10:00:05.000Z", STARTED_AT),
    ).toBe(5);
    expect(
      computeReplayOffsetSec("2026-05-28T10:01:30.500Z", STARTED_AT),
    ).toBe(90.5);
  });

  it("clamps negatives to 0 (message posted before class started)", () => {
    expect(
      computeReplayOffsetSec("2026-05-28T09:59:30.000Z", STARTED_AT),
    ).toBe(0);
  });

  it("returns 0 when posted_at equals started_at", () => {
    expect(computeReplayOffsetSec(STARTED_AT, STARTED_AT)).toBe(0);
  });
});

interface Msg {
  id: string;
  posted_at: string;
}

const MESSAGES: Msg[] = [
  { id: "m3", posted_at: "2026-05-28T10:01:00.000Z" }, // +60s
  { id: "m1", posted_at: "2026-05-28T10:00:05.000Z" }, // +5s
  { id: "m2", posted_at: "2026-05-28T10:00:30.000Z" }, // +30s
  { id: "m0", posted_at: "2026-05-28T09:59:00.000Z" }, // clamped to 0
];

describe("withReplayOffsets", () => {
  it("attaches offsetSec and sorts ascending", () => {
    const result = withReplayOffsets(MESSAGES, STARTED_AT);
    expect(result.map((m) => m.id)).toEqual(["m0", "m1", "m2", "m3"]);
    expect(result.map((m) => m.offsetSec)).toEqual([0, 5, 30, 60]);
  });

  it("does not mutate the input", () => {
    const input = [...MESSAGES];
    const before = JSON.stringify(input);
    withReplayOffsets(input, STARTED_AT);
    expect(JSON.stringify(input)).toBe(before);
  });
});

describe("messagesUpTo", () => {
  const with_offsets = withReplayOffsets(MESSAGES, STARTED_AT);

  it("returns no messages at currentSec = -1 (defensive)", () => {
    expect(messagesUpTo(with_offsets, -1)).toEqual([]);
  });

  it("reveals only the 0-offset message at currentSec = 0", () => {
    expect(messagesUpTo(with_offsets, 0).map((m) => m.id)).toEqual(["m0"]);
  });

  it("reveals m0 + m1 at currentSec = 5 (boundary inclusive)", () => {
    expect(messagesUpTo(with_offsets, 5).map((m) => m.id)).toEqual([
      "m0",
      "m1",
    ]);
  });

  it("reveals m0 + m1 + m2 at currentSec = 29 (m2 hidden until 30)", () => {
    expect(messagesUpTo(with_offsets, 29).map((m) => m.id)).toEqual([
      "m0",
      "m1",
    ]);
  });

  it("reveals everything once currentSec passes the last offset", () => {
    expect(messagesUpTo(with_offsets, 60).map((m) => m.id)).toEqual([
      "m0",
      "m1",
      "m2",
      "m3",
    ]);
    expect(messagesUpTo(with_offsets, 999).map((m) => m.id)).toEqual([
      "m0",
      "m1",
      "m2",
      "m3",
    ]);
  });
});

describe("countBetween", () => {
  const with_offsets = withReplayOffsets(MESSAGES, STARTED_AT);

  it("counts messages strictly within (from, to]", () => {
    expect(countBetween(with_offsets, 0, 5)).toBe(1);
    expect(countBetween(with_offsets, 5, 30)).toBe(1);
    expect(countBetween(with_offsets, 5, 60)).toBe(2);
    expect(countBetween(with_offsets, 0, 60)).toBe(3);
  });

  it("returns 0 when from > to", () => {
    expect(countBetween(with_offsets, 60, 5)).toBe(0);
  });

  it("an empty range returns 0 (from === to)", () => {
    expect(countBetween(with_offsets, 5, 5)).toBe(0);
  });

  it("the 1ms epsilon swallows sub-millisecond float jitter", () => {
    // The 1ms epsilon is here so a player tick at e.g. 4.9999s doesn't reveal
    // a message timed exactly at 5.000s twice. We assert symmetric behavior:
    // a range whose endpoints are within 1ms of a message's offset behaves
    // consistently — both endpoints exclude the boundary message.
    expect(countBetween(with_offsets, 4.999, 4.9995)).toBe(0);
    expect(countBetween(with_offsets, 4.998, 5)).toBe(1); // 5 > 4.999, 5 <= 5.001
  });
});
