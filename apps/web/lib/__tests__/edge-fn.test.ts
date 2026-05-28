import { afterEach, describe, expect, it, vi } from "vitest";

// invokeEdgeFn imports `@/lib/supabase/browser`, which itself reads env at
// module load. Provide stubs before importing.
vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://fake.supabase.co");
vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "fake-anon");

vi.mock("@/lib/supabase/browser", () => {
  return {
    createSupabaseBrowserClient: () => ({
      auth: {
        getSession: vi.fn(async () => ({
          data: {
            session: {
              access_token: "test-jwt",
            } as never,
          },
        })),
      },
    }),
  };
});

import { invokeEdgeFn, invokeEdgeFnPublic } from "@/lib/edge-fn";

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("invokeEdgeFn", () => {
  it("preserves 200 status + parses JSON body", async () => {
    global.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ ok: true, value: 42 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    ) as unknown as typeof fetch;

    const r = await invokeEdgeFn<{ ok: boolean; value: number }>("test", { x: 1 });
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ ok: true, value: 42 });
    expect(r.error).toBeNull();
  });

  it("preserves NON-2xx status (e.g. 409) instead of throwing", async () => {
    global.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ error: "conflict" }), {
        status: 409,
        headers: { "content-type": "application/json" },
      }),
    ) as unknown as typeof fetch;

    const r = await invokeEdgeFn<{ error: string }>("conflict-fn", {});
    expect(r.status).toBe(409);
    expect(r.body).toEqual({ error: "conflict" });
  });

  it("preserves 423 Locked (mobile relies on this for replay protection)", async () => {
    global.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ error: "locked" }), { status: 423 }),
    ) as unknown as typeof fetch;

    const r = await invokeEdgeFn("locked-fn", {});
    expect(r.status).toBe(423);
  });

  it("attaches Authorization + apikey headers", async () => {
    const fetchSpy = vi.fn<typeof fetch>(
      async () => new Response("{}", { status: 200 }),
    );
    global.fetch = fetchSpy as unknown as typeof fetch;

    await invokeEdgeFn("any-fn", { a: 1 });

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [, init] = fetchSpy.mock.calls[0] ?? [];
    const headers = (init as RequestInit | undefined)?.headers as
      | Record<string, string>
      | undefined;
    expect(headers?.Authorization).toBe("Bearer test-jwt");
    expect(headers?.apikey).toBe("fake-anon");
    expect(headers?.["Content-Type"]).toBe("application/json");
  });

  it("returns 401 if no session is available", async () => {
    vi.doMock("@/lib/supabase/browser", () => ({
      createSupabaseBrowserClient: () => ({
        auth: {
          getSession: vi.fn(async () => ({ data: { session: null } })),
        },
      }),
    }));
    vi.resetModules();
    const reloaded = await import("@/lib/edge-fn");
    const r = await reloaded.invokeEdgeFn("any", {});
    expect(r.status).toBe(401);
    expect(r.error).toBe("no session");
  });
});

describe("invokeEdgeFnPublic", () => {
  it("omits Authorization but keeps apikey", async () => {
    const fetchSpy = vi.fn<typeof fetch>(
      async () => new Response("{}", { status: 200 }),
    );
    global.fetch = fetchSpy as unknown as typeof fetch;

    await invokeEdgeFnPublic("server-time", {});

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [, init] = fetchSpy.mock.calls[0] ?? [];
    const headers = (init as RequestInit | undefined)?.headers as
      | Record<string, string>
      | undefined;
    expect(headers?.Authorization).toBeUndefined();
    expect(headers?.apikey).toBe("fake-anon");
  });
});
