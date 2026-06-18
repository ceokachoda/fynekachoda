"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface InitialFilters {
  actorRole: string;
  action: string;
  entity: string;
  from: string;
  to: string;
}

export function AuditFilters({
  initial,
  roleOptions,
}: {
  initial: InitialFilters;
  roleOptions: string[];
}) {
  const router = useRouter();
  const [actorRole, setActorRole] = useState(initial.actorRole);
  const [action, setAction] = useState(initial.action);
  const [entity, setEntity] = useState(initial.entity);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [pending, startTransition] = useTransition();

  function apply() {
    const next = new URLSearchParams();
    if (actorRole) next.set("actor_role", actorRole);
    if (action.trim()) next.set("action", action.trim());
    if (entity.trim()) next.set("entity", entity.trim());
    if (from) next.set("from", from);
    if (to) next.set("to", to);
    const qs = next.toString();
    startTransition(() => router.push(qs ? `/audit?${qs}` : "/audit"));
  }

  function clear() {
    setActorRole("");
    setAction("");
    setEntity("");
    setFrom("");
    setTo("");
    startTransition(() => router.push("/audit"));
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        apply();
      }}
      className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4 shadow-sm"
    >
      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
        Actor role
        <select
          value={actorRole}
          onChange={(e) => setActorRole(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value="">Any</option>
          {roleOptions.map((r) => (
            <option key={r} value={r}>
              {r.replace(/_/g, " ")}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
        Action
        <Input
          value={action}
          onChange={(e) => setAction(e.target.value)}
          placeholder="e.g. create_user"
          className="w-44"
        />
      </label>

      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
        Entity table
        <Input
          value={entity}
          onChange={(e) => setEntity(e.target.value)}
          placeholder="e.g. app_users"
          className="w-44"
        />
      </label>

      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
        From
        <Input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
        />
      </label>

      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
        To
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
      </label>

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          Apply
        </Button>
        <Button type="button" variant="outline" onClick={clear} disabled={pending}>
          Clear
        </Button>
      </div>
    </form>
  );
}
