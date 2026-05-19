import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { logoutAction } from "../actions/logout";

interface NavItem {
  label: string;
  href: string;
  ownerOnly?: boolean;
  comingPhase?: string;
}

const NAV: readonly NavItem[] = [
  { label: "Overview", href: "/" },
  { label: "Students", href: "/students" },
  { label: "Teachers", href: "/teachers" },
  { label: "Admins", href: "/admins", ownerOnly: true, comingPhase: "Phase 11" },
  { label: "Batches", href: "/batches" },
  { label: "Courses", href: "/courses" },
  { label: "Attendance", href: "/attendance" },
  { label: "Content", href: "/content" },
  { label: "Quizzes", href: "/quizzes" },
  { label: "Question bank", href: "/questions" },
  { label: "Audit log", href: "/audit", comingPhase: "Phase 11" },
] as const;

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAdmin();

  const items = NAV.filter((n) => !n.ownerOnly || session.isOwnerAdmin);

  return (
    <div className="grid min-h-screen grid-cols-[240px_1fr] bg-slate-50">
      <aside className="flex flex-col border-r border-slate-200 bg-white px-4 py-6">
        <div className="mb-6 px-2">
          <p className="text-xs uppercase tracking-wide text-slate-400">
            FyneStudy
          </p>
          <p className="font-semibold text-slate-900">Admin panel</p>
        </div>
        <nav className="flex-1 space-y-1">
          {items.map((item) => {
            const disabled = !!item.comingPhase;
            const className = disabled
              ? "block rounded-md px-3 py-2 text-sm text-slate-400 cursor-not-allowed"
              : "block rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100";
            const content = (
              <span className="flex items-center justify-between">
                <span>{item.label}</span>
                {item.comingPhase ? (
                  <span className="text-[10px] uppercase text-slate-400">
                    {item.comingPhase}
                  </span>
                ) : null}
              </span>
            );
            return disabled ? (
              <span key={item.href} className={className}>
                {content}
              </span>
            ) : (
              <Link key={item.href} href={item.href} className={className}>
                {content}
              </Link>
            );
          })}
        </nav>
        <form action={logoutAction} className="border-t border-slate-200 pt-4">
          <div className="mb-3 px-3">
            <p className="truncate text-sm font-medium text-slate-700">
              {session.full_name}
            </p>
            <p className="truncate text-xs text-slate-500">{session.email}</p>
            <p className="mt-1 text-[10px] uppercase tracking-wide text-slate-400">
              {session.isOwnerAdmin ? "Owner admin" : "Staff admin"}
            </p>
          </div>
          <button
            type="submit"
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
          >
            Sign out
          </button>
        </form>
      </aside>

      <main className="px-8 py-6">{children}</main>
    </div>
  );
}
