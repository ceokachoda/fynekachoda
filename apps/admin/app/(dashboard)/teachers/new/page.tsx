import { NewTeacherForm } from "./new-teacher-form";
import { PageHeader } from "@/components/page-header";

export const metadata = {
  title: "New teacher · FyneStudy Admin",
};

export default function NewTeacherPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="New teacher"
        breadcrumbs={[
          { label: "Overview", href: "/" },
          { label: "Teachers", href: "/teachers" },
          { label: "New teacher" }
        ]}
        description="Creating the account generates an initial password. After creation, you can assign the teacher to one or more batches from their profile."
      />

      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <NewTeacherForm />
      </div>
    </div>
  );
}
