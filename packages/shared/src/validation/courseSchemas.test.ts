import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CreateCourseInput,
  UpdateCourseInput,
  CreateSubjectInput,
  CreateChapterInput,
  CreateTopicInput,
} from "./courseSchemas";

test("CreateCourseInput accepts canonical seeds", () => {
  const r = CreateCourseInput.parse({ code: "NEET_UG", name: "NEET UG" });
  assert.equal(r.code, "NEET_UG");
  assert.equal(r.is_active, true);
});

test("CreateCourseInput rejects lowercase / invalid code", () => {
  assert.equal(CreateCourseInput.safeParse({ code: "neet_ug", name: "x" }).success, false);
  assert.equal(CreateCourseInput.safeParse({ code: "1NEET", name: "x" }).success, false);
  assert.equal(CreateCourseInput.safeParse({ code: "NEET-UG", name: "x" }).success, false);
});

test("CreateCourseInput rejects too-short name", () => {
  assert.equal(CreateCourseInput.safeParse({ code: "NEET_UG", name: "x" }).success, false);
});

test("UpdateCourseInput allows partials", () => {
  assert.equal(UpdateCourseInput.safeParse({}).success, true);
  assert.equal(UpdateCourseInput.safeParse({ is_active: false }).success, true);
});

const uuid = "00000000-0000-0000-0000-000000000001";

test("CreateSubjectInput/Chapter/Topic require parent uuid + name", () => {
  assert.equal(CreateSubjectInput.safeParse({ course_id: uuid, name: "Physics" }).success, true);
  assert.equal(CreateChapterInput.safeParse({ subject_id: uuid, name: "Mechanics" }).success, true);
  assert.equal(CreateTopicInput.safeParse({ chapter_id: uuid, name: "Kinematics" }).success, true);
});

test("CreateSubjectInput rejects bad uuid", () => {
  assert.equal(CreateSubjectInput.safeParse({ course_id: "not-uuid", name: "x" }).success, false);
});

test("CreateTopicInput rejects empty name", () => {
  assert.equal(CreateTopicInput.safeParse({ chapter_id: uuid, name: "" }).success, false);
});

test("sort_order defaults to 0 and accepts ints", () => {
  const r = CreateSubjectInput.parse({ course_id: uuid, name: "Physics" });
  assert.equal(r.sort_order, 0);
  assert.equal(CreateSubjectInput.safeParse({ course_id: uuid, name: "x", sort_order: 1.5 }).success, false);
  assert.equal(CreateSubjectInput.safeParse({ course_id: uuid, name: "x", sort_order: -1 }).success, false);
});
