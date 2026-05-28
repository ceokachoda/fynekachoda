import { notFound } from "next/navigation";
import { BookOpen, Home, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { FyneLogo } from "@/components/fyne/FyneLogo";
import { EmptyState } from "@/components/fyne/EmptyState";
import { PageHeader } from "@/components/fyne/PageHeader";
import { Pill } from "@/components/fyne/Pill";
import { StatusBadge } from "@/components/fyne/StatusBadge";
import { ListRow } from "@/components/fyne/ListRow";

export const metadata = { title: "Style guide" };

// Dev-only design-system reference. Hidden from production builds.
export default function StyleguidePage() {
  if (process.env.NODE_ENV === "production") notFound();

  const swatches = [
    { name: "primary", token: "var(--primary)" },
    { name: "primary-dark", token: "var(--primary-dark)" },
    { name: "primary-light", token: "var(--primary-light)" },
    { name: "background", token: "var(--background)" },
    { name: "muted", token: "var(--muted)" },
    { name: "border", token: "var(--border)" },
    { name: "success", token: "var(--success)" },
    { name: "warning", token: "var(--warning)" },
    { name: "destructive", token: "var(--destructive)" },
  ];

  return (
    <main className="min-h-svh bg-slate-50 px-4 py-10">
      <div className="mx-auto w-full max-w-4xl space-y-10">
        <PageHeader title="FyneStudy style guide" description="Dev-only design tokens & primitives." />

        <section className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">Logo</h2>
          <div className="rounded-2xl bg-white p-6 ring-1 ring-slate-100">
            <FyneLogo variant="large" />
            <div className="mt-4">
              <FyneLogo variant="header" />
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">
            Palette tokens
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {swatches.map((s) => (
              <div
                key={s.name}
                className="overflow-hidden rounded-xl ring-1 ring-slate-200"
              >
                <div className="h-12 w-full" style={{ background: s.token }} />
                <div className="px-3 py-2 text-xs text-slate-600">{s.name}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">Buttons</h2>
          <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-white p-6 ring-1 ring-slate-100">
            <Button>Primary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Destructive</Button>
            <Button disabled>Disabled</Button>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">
            Pills + badges + status
          </h2>
          <div className="flex flex-wrap gap-2 rounded-2xl bg-white p-6 ring-1 ring-slate-100">
            <Pill tone="primary">Primary pill</Pill>
            <Pill tone="success">Active</Pill>
            <Pill tone="warning">Flagged</Pill>
            <Pill tone="error">Absent</Pill>
            <Badge>Badge</Badge>
            <StatusBadge tone="info">INFO</StatusBadge>
            <StatusBadge tone="success">PRESENT</StatusBadge>
            <StatusBadge tone="error">ABSENT</StatusBadge>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">Card</h2>
          <Card>
            <CardHeader>
              <CardTitle>Sample card</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600">
                Card body. Used for dashboards, profile sections and lists.
              </p>
            </CardContent>
          </Card>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">Form</h2>
          <div className="rounded-2xl bg-white p-6 ring-1 ring-slate-100">
            <div className="space-y-1.5">
              <Label htmlFor="sg-email">Email</Label>
              <Input id="sg-email" placeholder="you@example.com" />
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">
            List rows
          </h2>
          <div className="rounded-2xl bg-white ring-1 ring-slate-100">
            <ListRow icon={Home} label="Account information" subLabel="Manage your profile details" />
            <ListRow icon={QrCode} label="Attendance" subLabel="Show your QR" />
            <ListRow icon={BookOpen} label="Library" subLabel="Videos and PDFs" isLast />
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">
            Empty state
          </h2>
          <EmptyState
            icon={BookOpen}
            title="Coming in Phase 2"
            description="Tab content lands here once the feature ports."
          />
        </section>
      </div>
    </main>
  );
}
