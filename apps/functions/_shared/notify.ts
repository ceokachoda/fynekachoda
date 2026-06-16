// Fire-and-forget bridge: ask `push-dispatch` to send a student notification.
//
// Imported by the event edge fns (live go-live, class scheduled, content / quiz
// / exam publish, results release) + push-class-reminders. Deliberately tiny —
// it does NOT import the Web Push crypto stack, so the hot publish paths stay
// light; all the heavy lifting happens inside `push-dispatch`.
//
// Auth: `apikey` = anon key (lets the request through the functions gateway),
// `X-Internal-Key` = service-role key (the actual secret gate that push-dispatch
// checks). Both are already in every edge fn's env. The call never throws and
// never blocks the caller's HTTP response — it is detached and kept alive past
// the response via EdgeRuntime.waitUntil.

export interface NotifyAudience {
  batch_id?: string | null;
  course_id?: string | null;
  user_ids?: string[] | null;
}

export interface NotifyPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

async function doNotify(
  audience: NotifyAudience,
  note: NotifyPayload,
): Promise<void> {
  const base = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!base || !serviceKey || !anonKey) return;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    await fetch(`${base.replace(/\/+$/, "")}/functions/v1/push-dispatch`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": anonKey,
        "X-Internal-Key": serviceKey,
      },
      body: JSON.stringify({ audience, notification: note }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

// Fire-and-forget. Call WITHOUT await — errors are swallowed and the dispatch is
// kept alive after the parent returns its response.
export function notifyStudents(
  audience: NotifyAudience,
  note: NotifyPayload,
): void {
  const p = doNotify(audience, note).catch((e) => {
    console.error("notifyStudents failed:", e instanceof Error ? e.message : e);
  });
  try {
    // deno-lint-ignore no-explicit-any
    const er = (globalThis as any).EdgeRuntime;
    if (er && typeof er.waitUntil === "function") er.waitUntil(p);
  } catch {
    // EdgeRuntime absent (local/test) — the detached promise still runs.
  }
}
