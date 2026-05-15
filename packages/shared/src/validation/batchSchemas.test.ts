import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CreateBatchInput,
  UpdateBatchInput,
  AssignTeacherInput,
  BatchScheduleRowInput,
  BatchTransferInput,
} from "./batchSchemas";

const uuid = "00000000-0000-0000-0000-000000000001";
const uuid2 = "00000000-0000-0000-0000-000000000002";

test("CreateBatchInput accepts a full row", () => {
  const r = CreateBatchInput.parse({
    course_id: uuid,
    name: "NEET 2027 Morning",
    starts_on: "2026-06-01",
    ends_on: "2027-05-31",
    capacity: 80,
  });
  assert.equal(r.is_active, true);
  assert.equal(r.capacity, 80);
});

test("CreateBatchInput defaults capacity + is_active", () => {
  const r = CreateBatchInput.parse({
    course_id: uuid,
    name: "B1",
    starts_on: "2026-06-01",
  });
  assert.equal(r.capacity, 80);
  assert.equal(r.is_active, true);
});

test("CreateBatchInput rejects ends_on before starts_on", () => {
  const r = CreateBatchInput.safeParse({
    course_id: uuid,
    name: "B1",
    starts_on: "2026-06-01",
    ends_on: "2026-05-31",
  });
  assert.equal(r.success, false);
});

test("CreateBatchInput rejects zero / negative capacity", () => {
  assert.equal(
    CreateBatchInput.safeParse({ course_id: uuid, name: "B1", starts_on: "2026-06-01", capacity: 0 }).success,
    false,
  );
  assert.equal(
    CreateBatchInput.safeParse({ course_id: uuid, name: "B1", starts_on: "2026-06-01", capacity: -1 }).success,
    false,
  );
});

test("CreateBatchInput rejects malformed starts_on", () => {
  assert.equal(
    CreateBatchInput.safeParse({ course_id: uuid, name: "B1", starts_on: "06-01-2026" }).success,
    false,
  );
});

test("UpdateBatchInput allows partials but still validates date ordering when both present", () => {
  assert.equal(UpdateBatchInput.safeParse({}).success, true);
  assert.equal(UpdateBatchInput.safeParse({ name: "Renamed" }).success, true);
  const r = UpdateBatchInput.safeParse({
    starts_on: "2026-06-01",
    ends_on: "2026-05-31",
  });
  assert.equal(r.success, false);
});

test("AssignTeacherInput requires both uuids", () => {
  assert.equal(AssignTeacherInput.safeParse({ batch_id: uuid, teacher_id: uuid2 }).success, true);
  assert.equal(AssignTeacherInput.safeParse({ batch_id: "x", teacher_id: uuid2 }).success, false);
});

test("BatchScheduleRowInput enforces HH:MM + end_time > start_time + weekday range", () => {
  const r = BatchScheduleRowInput.parse({
    batch_id: uuid,
    weekday: 1,
    start_time: "18:00",
    end_time: "21:00",
  });
  assert.equal(r.is_active, true);

  assert.equal(
    BatchScheduleRowInput.safeParse({
      batch_id: uuid,
      weekday: 1,
      start_time: "18:00",
      end_time: "17:59",
    }).success,
    false,
  );
  assert.equal(
    BatchScheduleRowInput.safeParse({
      batch_id: uuid,
      weekday: 7,
      start_time: "18:00",
      end_time: "21:00",
    }).success,
    false,
  );
  assert.equal(
    BatchScheduleRowInput.safeParse({
      batch_id: uuid,
      weekday: -1,
      start_time: "18:00",
      end_time: "21:00",
    }).success,
    false,
  );
  assert.equal(
    BatchScheduleRowInput.safeParse({
      batch_id: uuid,
      weekday: 1,
      start_time: "9:00",
      end_time: "21:00",
    }).success,
    false,
  );
});

test("BatchTransferInput requires student_id + to_batch_id + reason min 3", () => {
  assert.equal(
    BatchTransferInput.safeParse({
      student_id: uuid,
      to_batch_id: uuid2,
      reason: "ok",
    }).success,
    false,
  );
  assert.equal(
    BatchTransferInput.safeParse({
      student_id: uuid,
      to_batch_id: uuid2,
      reason: "transferring due to schedule clash",
    }).success,
    true,
  );
});
