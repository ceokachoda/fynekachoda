// A class session's display name: the teacher-given title, else the subject
// name, else the generic "Class". Used everywhere a session is shown to
// students or teachers so ad-hoc/offline classes carry the teacher's label.

export function sessionDisplayName(
  title: string | null | undefined,
  subjectName: string | null | undefined,
): string {
  const t = title?.trim();
  if (t) return t;
  const s = subjectName?.trim();
  if (s) return s;
  return "Class";
}
