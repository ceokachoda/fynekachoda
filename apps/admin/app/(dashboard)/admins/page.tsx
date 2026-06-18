import { createSupabaseServerClient } from "@/lib/supabase-server";
import { requireOwnerAdmin } from "@/lib/auth";
import { NewAdmin } from "./new-admin";
import { ShieldCheck, ShieldAlert, KeyRound, Mail, Clock, Smartphone } from "lucide-react";

export const metadata = {
  title: "Roles & Permissions · FyneStudy Admin",
};

export const dynamic = "force-dynamic";

interface AdminRow {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  is_active: boolean;
  created_at: string;
  user_roles: { role: string }[];
}

async function fetchAdmins(): Promise<AdminRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("app_users")
    .select(
      "id, full_name, email, phone, is_active, created_at, user_roles!user_id!inner(role)",
    )
    .in("user_roles.role", ["owner_admin", "staff_admin"])
    .order("created_at", { ascending: false });
  if (error) {
    console.error("admins list query failed:", error.message);
    return [];
  }
  return (data ?? []) as unknown as AdminRow[];
}

function getInitials(name: string) {
  return name.split(" ").map(n => n[0]).join("").toUpperCase().substring(0, 2);
}

export default async function AdminsPage() {
  const session = await requireOwnerAdmin();
  const rows = await fetchAdmins();

  const owners = rows.filter(r => r.user_roles.some(ur => ur.role === "owner_admin"));
  const staff = rows.filter(r => !r.user_roles.some(ur => ur.role === "owner_admin"));

  return (
    <div className="space-y-8 animate-in-fade pb-8">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 bg-card p-6 rounded-2xl border border-border shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
          <ShieldCheck className="w-64 h-64" />
        </div>
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-primary/10 rounded-lg">
              <ShieldCheck className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Roles & Permissions
            </h1>
          </div>
          <p className="text-sm text-muted-foreground max-w-lg leading-relaxed">
            Manage administrative access to the FyneStudy platform. Owner accounts have unrestricted access, while staff accounts follow delegated permission scopes.
          </p>
        </div>
        <div className="relative z-10 shrink-0">
          <NewAdmin />
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Owners Column */}
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-border/60">
            <h2 className="text-lg font-semibold flex items-center gap-2 text-foreground">
              <KeyRound className="w-5 h-5 text-violet-500" />
              Owner Administrators
            </h2>
            <span className="bg-violet-500/10 text-violet-600 text-xs font-bold px-2 py-1 rounded-full border border-violet-500/20">
              {owners.length} Account{owners.length !== 1 ? 's' : ''}
            </span>
          </div>
          
          <div className="grid gap-4">
            {owners.map(row => (
              <AdminCard key={row.id} row={row} sessionUserId={session.app_user_id} isOwner={true} />
            ))}
          </div>
        </div>

        {/* Staff Column */}
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-border/60">
            <h2 className="text-lg font-semibold flex items-center gap-2 text-foreground">
              <ShieldAlert className="w-5 h-5 text-blue-500" />
              Staff Administrators
            </h2>
            <span className="bg-blue-500/10 text-blue-600 text-xs font-bold px-2 py-1 rounded-full border border-blue-500/20">
              {staff.length} Account{staff.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="grid gap-4">
            {staff.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-card/50 p-8 text-center text-sm text-muted-foreground">
                No staff administrators have been provisioned.
              </div>
            ) : (
              staff.map(row => (
                <AdminCard key={row.id} row={row} sessionUserId={session.app_user_id} isOwner={false} />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function AdminCard({ row, sessionUserId, isOwner }: { row: AdminRow, sessionUserId: string, isOwner: boolean }) {
  const isSelf = row.id === sessionUserId;
  
  return (
    <div className={`relative p-5 rounded-2xl border bg-card shadow-sm transition-all hover:shadow-md ${isSelf ? 'border-primary/40 ring-1 ring-primary/10' : 'border-border'}`}>
      <div className="flex items-start gap-4">
        <div className={`flex size-12 shrink-0 items-center justify-center rounded-xl font-bold shadow-sm border ${
          isOwner 
            ? 'bg-violet-500/10 text-violet-600 border-violet-500/20' 
            : 'bg-blue-500/10 text-blue-600 border-blue-500/20'
        }`}>
          {getInitials(row.full_name)}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-2 truncate">
              <h3 className="font-semibold text-foreground truncate">{row.full_name}</h3>
              {isSelf && (
                <span className="shrink-0 bg-primary/10 text-primary text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded border border-primary/20">
                  Current User
                </span>
              )}
            </div>
            {!row.is_active && (
              <span className="shrink-0 bg-destructive/10 text-destructive text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded border border-destructive/20">
                Suspended
              </span>
            )}
          </div>
          
          <div className="space-y-1.5 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5 truncate">
              <Mail className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{row.email}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-1.5 shrink-0">
                <Smartphone className="w-3.5 h-3.5" />
                <span>{row.phone ?? "No phone"}</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0 opacity-70">
                <Clock className="w-3.5 h-3.5" />
                <span>Since {new Date(row.created_at).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Decorative gradient line */}
      <div className={`absolute bottom-0 left-0 right-0 h-1 rounded-b-2xl opacity-50 ${isOwner ? 'bg-gradient-to-r from-violet-500 to-transparent' : 'bg-gradient-to-r from-blue-500 to-transparent'}`} />
    </div>
  );
}
