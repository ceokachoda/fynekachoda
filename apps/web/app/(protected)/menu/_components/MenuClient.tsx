"use client";

import { useState } from "react";
import Link from "next/link";
import {
  User,
  Bell,
  Languages,
  SunMoon,
  ShieldCheck,
  Smartphone,
  HelpCircle,
  FileText,
  LogOut,
  ChevronRight,
} from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

interface RowProps {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  onClick?: () => void;
  href?: string;
  destructive?: boolean;
}

function MenuRow({ icon, label, hint, onClick, href, destructive }: RowProps) {
  const inner = (
    <div
      className={`flex items-center gap-3 px-4 py-3.5 ${
        destructive ? "text-red-600" : "text-slate-900"
      }`}
    >
      <div
        className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${
          destructive ? "bg-red-50" : "bg-slate-100"
        }`}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{label}</p>
      </div>
      {hint ? <p className="text-xs text-slate-400">{hint}</p> : null}
      <ChevronRight className="size-4 text-slate-300" />
    </div>
  );
  if (href) {
    return (
      <Link href={href} className="block transition hover:bg-slate-50">
        {inner}
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className="block w-full text-left transition hover:bg-slate-50"
    >
      {inner}
    </button>
  );
}

function Group({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <p className="mb-2 px-4 text-[11px] font-bold uppercase tracking-wide text-slate-400">
        {title}
      </p>
      <div className="divide-y divide-slate-100 rounded-2xl border border-slate-100 bg-white">
        {children}
      </div>
    </section>
  );
}

export function MenuClient() {
  const [busy, setBusy] = useState(false);

  const handleLogout = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.signOut();
      window.location.href = "/login";
    } catch {
      setBusy(false);
    }
  };

  const futureUpdate = () => {
    window.alert("This setting will be available in a future update.");
  };

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-extrabold text-slate-900">Settings</h1>
      <Group title="General">
        <MenuRow
          icon={<User className="size-4" />}
          label="Account information"
          href="/profile"
        />
        <MenuRow
          icon={<Bell className="size-4" />}
          label="Notifications"
          onClick={futureUpdate}
        />
        <MenuRow
          icon={<Languages className="size-4" />}
          label="Language"
          hint="English"
          onClick={futureUpdate}
        />
        <MenuRow
          icon={<SunMoon className="size-4" />}
          label="Display theme"
          hint="System"
          onClick={futureUpdate}
        />
      </Group>
      <Group title="Security">
        <MenuRow
          icon={<ShieldCheck className="size-4" />}
          label="Privacy settings"
          onClick={futureUpdate}
        />
        <MenuRow
          icon={<Smartphone className="size-4" />}
          label="Connected devices"
          onClick={futureUpdate}
        />
      </Group>
      <Group title="About">
        <MenuRow
          icon={<HelpCircle className="size-4" />}
          label="Help &amp; support"
          onClick={futureUpdate}
        />
        <MenuRow
          icon={<FileText className="size-4" />}
          label="Terms &amp; policies"
          href="/privacy"
        />
      </Group>
      <div className="rounded-2xl border border-slate-100 bg-white">
        <MenuRow
          icon={<LogOut className="size-4" />}
          label={busy ? "Signing out…" : "Sign out"}
          onClick={handleLogout}
          destructive
        />
      </div>
    </div>
  );
}
