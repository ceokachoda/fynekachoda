import { requireAdmin } from "@/lib/auth";
import { RouteProgress } from "@/components/route-progress";
import { SidebarContent } from "@/components/sidebar-content";
import { TopNav } from "@/components/top-nav";

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
  { label: "Performance", href: "/performance" },
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
    <div className="min-h-screen bg-muted/40 md:grid md:grid-cols-[240px_1fr]">
      <RouteProgress />

      {/* Desktop rail */}
      <aside className="hidden bg-background md:sticky md:top-0 md:block md:h-screen md:border-r md:border-border">
        <SidebarContent items={items} user={user} />
      </aside>

      <div className="flex flex-col min-w-0 flex-1">
        <TopNav items={items} user={user} />
        
        <main className="flex-1 px-4 py-6 sm:px-6 md:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
