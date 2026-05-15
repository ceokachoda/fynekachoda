import { z } from "zod";

const CourseCode = z
  .string()
  .trim()
  .min(2)
  .max(30)
  .regex(/^[A-Z][A-Z0-9_]*$/, "code must be UPPER_SNAKE_CASE (e.g. NEET_UG)");
const CourseName = z.string().trim().min(2).max(100);
const CourseDescription = z.string().trim().max(2000).optional();
const NodeName = z.string().trim().min(1).max(120);
const SortOrder = z.number().int().min(0).max(10_000);

export const CreateCourseInput = z.object({
  code: CourseCode,
  name: CourseName,
  description: CourseDescription,
  is_active: z.boolean().default(true),
});
export type CreateCourseInput = z.infer<typeof CreateCourseInput>;

export const UpdateCourseInput = z.object({
  name: CourseName.optional(),
  description: CourseDescription,
  is_active: z.boolean().optional(),
});
export type UpdateCourseInput = z.infer<typeof UpdateCourseInput>;

export const CreateSubjectInput = z.object({
  course_id: z.string().uuid(),
  name: NodeName,
  sort_order: SortOrder.default(0),
});
export type CreateSubjectInput = z.infer<typeof CreateSubjectInput>;

export const UpdateSubjectInput = z.object({
  name: NodeName.optional(),
  sort_order: SortOrder.optional(),
});
export type UpdateSubjectInput = z.infer<typeof UpdateSubjectInput>;

export const CreateChapterInput = z.object({
  subject_id: z.string().uuid(),
  name: NodeName,
  sort_order: SortOrder.default(0),
});
export type CreateChapterInput = z.infer<typeof CreateChapterInput>;

export const UpdateChapterInput = z.object({
  name: NodeName.optional(),
  sort_order: SortOrder.optional(),
});
export type UpdateChapterInput = z.infer<typeof UpdateChapterInput>;

export const CreateTopicInput = z.object({
  chapter_id: z.string().uuid(),
  name: NodeName,
  sort_order: SortOrder.default(0),
});
export type CreateTopicInput = z.infer<typeof CreateTopicInput>;

export const UpdateTopicInput = z.object({
  name: NodeName.optional(),
  sort_order: SortOrder.optional(),
});
export type UpdateTopicInput = z.infer<typeof UpdateTopicInput>;
