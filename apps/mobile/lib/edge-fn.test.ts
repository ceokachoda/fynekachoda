// Covers the stale-session recovery added 2026-06-14: a 401 from an edge fn
// (its `getUser()` rejecting a token whose GoTrue session was deleted) must
// trigger a single refresh-and-retry, and a clean local sign-out when the
// session is truly gone — never an infinite retry loop.

import { invokeEdgeFn, invokeEdgeFnPublic } from "./edge-fn";

const mockGetSession = jest.fn();
const mockRefreshSession = jest.fn();
const mockSignOut = jest.fn();

jest.mock("./supabase", () => ({
  supabase: {
    auth: {
      getSession: (...a: unknown[]) => mockGetSession(...a),
      refreshSession: (...a: unknown[]) => mockRefreshSession(...a),
      signOut: (...a: unknown[]) => mockSignOut(...a),
    },
  },
}));

type FakeRes = { status: number; text: () => Promise<string> };
function res(status: number, body: unknown = {}): FakeRes {
  return { status, text: async () => JSON.stringify(body) };
}

function authOf(call: unknown[]): string | undefined {
  const init = call[1] as RequestInit | undefined;
  const headers = init?.headers as Record<string, string> | undefined;
  return headers?.Authorization;
}

const realFetch = global.fetch;

beforeEach(() => {
  mockGetSession.mockReset();
  mockRefreshSession.mockReset();
  mockSignOut.mockReset();
  mockGetSession.mockResolvedValue({ data: { session: { access_token: "stale" } } });
  mockSignOut.mockResolvedValue({ error: null });
});

afterEach(() => {
  global.fetch = realFetch;
});

describe("invokeEdgeFn", () => {
  it("returns a 200 body without touching refresh", async () => {
    global.fetch = jest.fn(async () => res(200, { ok: true })) as unknown as typeof fetch;

    const r = await invokeEdgeFn<{ ok: boolean }>("fn", { x: 1 });

    expect(r.status).toBe(200);
    expect(r.body).toEqual({ ok: true });
    expect(mockRefreshSession).not.toHaveBeenCalled();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("preserves a non-401 error status (e.g. 409) without retrying", async () => {
    global.fetch = jest.fn(async () => res(409, { error: "conflict" })) as unknown as typeof fetch;

    const r = await invokeEdgeFn("fn", {});

    expect(r.status).toBe(409);
    expect(mockRefreshSession).not.toHaveBeenCalled();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("on 401 refreshes the session and retries once with the fresh token", async () => {
    // stale token -> 401; fresh token -> 200
    global.fetch = jest.fn(async (...call: unknown[]) =>
      authOf(call) === "Bearer fresh" ? res(200, { ok: true }) : res(401, { error: "invalid token" }),
    ) as unknown as typeof fetch;
    mockRefreshSession.mockResolvedValue({ data: { session: { access_token: "fresh" } }, error: null });

    const r = await invokeEdgeFn<{ ok: boolean }>("yt-playback-sign", {});

    expect(r.status).toBe(200);
    expect(r.body).toEqual({ ok: true });
    expect(mockRefreshSession).toHaveBeenCalledTimes(1);
    expect(mockSignOut).not.toHaveBeenCalled();
    expect((global.fetch as jest.Mock).mock.calls).toHaveLength(2);
    expect(authOf((global.fetch as jest.Mock).mock.calls[1])).toBe("Bearer fresh");
  });

  it("on 401 with an unrecoverable session signs out locally and returns the 401", async () => {
    global.fetch = jest.fn(async () => res(401, { error: "invalid token" })) as unknown as typeof fetch;
    mockRefreshSession.mockResolvedValue({ data: { session: null }, error: { message: "refresh_token_not_found" } });

    const r = await invokeEdgeFn("yt-playback-sign", {});

    expect(r.status).toBe(401);
    expect(mockRefreshSession).toHaveBeenCalledTimes(1);
    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(mockSignOut).toHaveBeenCalledWith({ scope: "local" });
    // one initial attempt + no retry (no fresh token)
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("de-dupes concurrent 401s into a single refresh", async () => {
    global.fetch = jest.fn(async (...call: unknown[]) =>
      authOf(call) === "Bearer fresh" ? res(200, { ok: true }) : res(401, {}),
    ) as unknown as typeof fetch;
    let resolveRefresh: (v: unknown) => void = () => {};
    mockRefreshSession.mockImplementation(
      () => new Promise((r) => { resolveRefresh = r; }),
    );

    const p1 = invokeEdgeFn("fn-a", {});
    const p2 = invokeEdgeFn("fn-b", {});
    // Let both calls drain getSession + the first fetch and park on the shared
    // pending refresh before we resolve it.
    await new Promise((r) => setImmediate(r));
    resolveRefresh({ data: { session: { access_token: "fresh" } }, error: null });
    const [r1, r2] = await Promise.all([p1, p2]);

    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect(mockRefreshSession).toHaveBeenCalledTimes(1);
  });

  it("returns 401 'no session' without calling fetch when signed out", async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    global.fetch = jest.fn() as unknown as typeof fetch;

    const r = await invokeEdgeFn("fn", {});

    expect(r.status).toBe(401);
    expect(r.error).toBe("no session");
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe("invokeEdgeFnPublic", () => {
  it("omits Authorization but keeps apikey", async () => {
    const fetchSpy = jest.fn(async () => res(200, {}));
    global.fetch = fetchSpy as unknown as typeof fetch;

    await invokeEdgeFnPublic("server-time", {});

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const init = (fetchSpy.mock.calls[0] as unknown[])[1] as RequestInit | undefined;
    const headers = init?.headers as Record<string, string> | undefined;
    expect(headers?.Authorization).toBeUndefined();
    expect(headers?.apikey).toBeDefined();
  });
});
