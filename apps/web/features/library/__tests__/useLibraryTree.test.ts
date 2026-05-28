import { describe, it, expect } from "vitest";
import { buildLibraryTree } from "@/features/library/useLibraryTree";

const subjects = [
  {
    id: "s1",
    name: "Physics",
    sort_order: 1,
    chapters: [
      {
        id: "c1",
        name: "Mechanics",
        sort_order: 1,
        topics: [
          { id: "t1", name: "Kinematics", sort_order: 1 },
          { id: "t2", name: "Dynamics", sort_order: 2 },
        ],
      },
    ],
  },
  {
    id: "s2",
    name: "Chemistry",
    sort_order: 2,
    chapters: [],
  },
];

const items = [
  {
    id: "i1",
    title: "Newton intro",
    kind: "video" as const,
    description: null,
    duration_sec: 600,
    yt_video_id: null,
    file_path: null,
    is_published: true,
    topic_id: "t1",
    chapter_id: "c1",
    subject_id: "s1",
    batch_id: null,
    course_id: "course-1",
    created_at: "2026-05-01T00:00:00Z",
  },
  {
    id: "i2",
    title: "Force vectors PDF",
    kind: "pdf" as const,
    description: null,
    duration_sec: null,
    yt_video_id: null,
    file_path: "x.pdf",
    is_published: true,
    topic_id: "t2",
    chapter_id: "c1",
    subject_id: "s1",
    batch_id: null,
    course_id: "course-1",
    created_at: "2026-05-02T00:00:00Z",
  },
];

describe("buildLibraryTree", () => {
  it("groups items under their topics and counts up the tree", () => {
    const tree = buildLibraryTree(subjects, items, "");
    expect(tree.subjects).toHaveLength(2);
    const physics = tree.subjects.find((s) => s.id === "s1")!;
    expect(physics.item_count).toBe(2);
    const mech = physics.chapters[0]!;
    expect(mech.item_count).toBe(2);
    expect(mech.topics).toHaveLength(2);
    expect(mech.topics[0]!.items).toHaveLength(1);
    expect(mech.topics[1]!.items).toHaveLength(1);
  });

  it("filters by search query (case-insensitive title match)", () => {
    const tree = buildLibraryTree(subjects, items, "newton");
    expect(tree.subjects).toHaveLength(1); // Chemistry drops out (no items)
    const physics = tree.subjects[0]!;
    expect(physics.item_count).toBe(1);
    expect(physics.chapters[0]!.topics[0]!.items).toHaveLength(1);
    expect(physics.chapters[0]!.topics[1]!.items).toHaveLength(0);
  });

  it("hides subjects with zero items when searching", () => {
    const tree = buildLibraryTree(subjects, items, "xyz-no-match");
    expect(tree.subjects).toHaveLength(0);
  });

  it("keeps all subjects when no search query", () => {
    const tree = buildLibraryTree(subjects, [], "");
    expect(tree.subjects).toHaveLength(2);
    expect(tree.subjects[0]!.item_count).toBe(0);
  });
});
