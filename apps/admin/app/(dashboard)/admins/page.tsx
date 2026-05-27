import { createSupabaseServerClient } from "@/lib/supabase-server";
import { requireOwnerAdmin } from "@/lib/auth";
import { NewAdmin } from "./new-admin";

export const metadata = {
  title: "Admins · FyneStudy Admin",
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

export default async function AdminsPage() {
  const session = await requireOwnerAdmin();
  const rows = await fetchAdmins();

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Admins</h1>
          <p className="text-sm text-slate-500">
            Owner-only. {rows.length} admin {rows.length === 1 ? "account" : "accounts"}.
          </p>
        </div>
        <NewAdmin />
      </header>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Phone</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {rows.map((row) => {
              const isOwner = row.user_roles.some(
                (r) => r.role === "owner_admin",
              );
              const isSelf = row.id === session.app_user_id;
              return (
                <tr key={row.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <span className="font-medium text-slate-900">
                      {row.full_name}
                    </span>
                    {isSelf ? (
                      <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-slate-500">
                        You
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{row.email}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {row.phone ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        isOwner
                          ? "bg-violet-100 text-violet-800"
                          : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {isOwner ? "Owner admin" : "Staff admin"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        row.is_active
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {row.is_active ? "Active" : "Suspended"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {new Date(row.created_at).toLocaleDateString("en-IN")}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
