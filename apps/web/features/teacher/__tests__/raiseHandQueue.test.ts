// Phase 4 Track 4B — FIFO ordering + dedup helpers for the teacher's raise-
// hand queue. The realtime hook calls these on every CDC event so we keep
// them tiny + pure.

import { describe, expect, it } from "vitest";
import {
  dropForBannedUser,
  dropResolved,
  orderQueue,
  type RaiseHandRow,
} from "../raise-hand-queue";

const rows: RaiseHandRow[] = [
  {
    id: "h2",
    student_id: "s-2",
    student_name: "Diya",
    raised_at: "2026-05-28T10:00:02Z",
  },
  {
    id: "h1",
    student_id: "s-1",
    student_name: "Aarav",
    raised_at: "2026-05-28T10:00:01Z",
  },
  {
    id: "h3",
    student_id: "s-3",
    student_name: "Mira",
    raised_at: "2026-05-28T10:00:03Z",
    resolved_at: "2026-05-28T10:01:00Z",
  },
];

describe("orderQueue", () => {
  it("returns oldest-first, filters resolved", () => {
    const q = orderQueue(rows);
    expect(q.map((r) => r.id)).toEqual(["h1", "h2"]);
  });

  it("returns empty if everyone is resolved", () => {
    const allResolved = rows.map((r) => ({
      ...r,
      resolved_at: "2026-05-28T10:05:00Z",
    }));
    expect(orderQueue(allResolved)).toEqual([]);
  });

  it("does not mutate the input", () => {
    const snapshot = JSON.parse(JSON.stringify(rows));
    orderQueue(rows);
    expect(rows).toEqual(snapshot);
  });
});

describe("dropResolved", () => {
  it("removes the matching id", () => {
    const q = orderQueue(rows);
    expect(dropResolved(q, "h1").map((r) => r.id)).toEqual(["h2"]);
  });
});

describe("dropForBannedUser", () => {
  it("removes every queued hand for that student", () => {
    const dup = [
      ...orderQueue(rows),
      {
        id: "h4",
        student_id: "s-1",
        student_name: "Aarav",
        raised_at: "2026-05-28T10:00:04Z",
      },
    ];
    expect(dropForBannedUser(dup, "s-1").map((r) => r.id)).toEqual(["h2"]);
  });
});
