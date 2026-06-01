import { requireAdmin } from "@/lib/auth";
import { RouteProgress } from "@/components/route-progress";
import { FyneLogo } from "@/components/fyne-logo";
import { SidebarContent } from "@/components/sidebar-content";
import { MobileSidebar } from "@/components/mobile-sidebar";

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
  { label: "Admins", href: "/admins", ownerOnly: true },
  { label: "Batches", href: "/batches" },
  { label: "Courses", href: "/courses" },
  { label: "Attendance", href: "/attendance" },
  { label: "Content", href: "/content" },
  { label: "Quizzes", href: "/quizzes" },
  { label: "Exams", href: "/exams" },
  { label: "Offline scores", href: "/offline-scores" },
  { label: "Question bank", href: "/questions" },
  { label: "Audit log", href: "/audit" },
] as const;

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAdmin();

  const items = NAV.filter((n) => !n.ownerOnly || session.isOwnerAdmin);

  const initials =
    session.full_name
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "FS";

  const user = {
    fullName: session.full_name,
    email: session.email,
    isOwnerAdmin: session.isOwnerAdmin,
    initials,
  };

  return (
    <div className="min-h-screen bg-slate-50 md:grid md:grid-cols-[240px_1fr]">
      <RouteProgress />

      {/* Desktop rail */}
      <aside className="hidden bg-white md:sticky md:top-0 md:block md:h-screen md:border-r md:border-slate-200">
        <SidebarContent items={items} user={user} />
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:hidden">
        <FyneLogo variant="header" />
        <MobileSidebar items={items} user={user} />
      </header>

      <main className="min-w-0 px-4 py-5 sm:px-6 md:px-8 md:py-6">
        {children}
      </main>
    </div>
  );
}
