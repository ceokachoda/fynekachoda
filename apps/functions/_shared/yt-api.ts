// Phase 9 CP3 — YouTube Data API v3 live-streaming helper.
//
// Reads the institute's OAuth credentials from Supabase Vault (YT_CLIENT_ID,
// YT_CLIENT_SECRET, YT_REFRESH_TOKEN, INSTITUTE_CHANNEL_ID), exchanges the
// refresh token for a short-lived access token (cached ~50 min per instance),
// and wraps the liveBroadcasts / liveStreams flow:
//   create broadcast  -> create stream -> bind -> (auto)transition / complete.
//
// Robustness: a single 401 triggers a forced token refresh + one retry; 5xx
// responses retry with exponential backoff (up to 3 attempts).
//
// "Not configured" path: if any of the three required secrets is absent we
// throw YtNotConfiguredError so the calling edge fn can return a clean 503
// instead of a 500 — Phase 9 ships before the institute's YouTube channel +
// OAuth dance is done, so the deployed fns must degrade gracefully.

import { getVaultSecret } from "./vault.ts";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const API_BASE = "https://www.googleapis.com/youtube/v3";
const ACCESS_TOKEN_TTL_SEC = 3000; // cap at ~50 min even if Google says 3600

export class YtNotConfiguredError extends Error {
  missing: string[];
  constructor(missing: string[]) {
    super(`YouTube not configured (missing Vault secrets: ${missing.join(", ")})`);
    this.name = "YtNotConfiguredError";
    this.missing = missing;
  }
}

export class YtApiError extends Error {
  status: number;
  body: string;
  constructor(status: number, message: string, body = "") {
    super(message);
    this.name = "YtApiError";
    this.status = status;
    this.body = body;
  }
}

interface YtCredentials {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  channelId: string | null;
}

let cachedToken: { token: string; expiresAt: number } | null = null;

async function loadCredentials(): Promise<YtCredentials> {
  const [clientId, clientSecret, refreshToken, channelId] = await Promise.all([
    getVaultSecret("YT_CLIENT_ID"),
    getVaultSecret("YT_CLIENT_SECRET"),
    getVaultSecret("YT_REFRESH_TOKEN"),
    getVaultSecret("INSTITUTE_CHANNEL_ID"),
  ]);
  const missing: string[] = [];
  if (!clientId) missing.push("YT_CLIENT_ID");
  if (!clientSecret) missing.push("YT_CLIENT_SECRET");
  if (!refreshToken) missing.push("YT_REFRESH_TOKEN");
  if (missing.length > 0) throw new YtNotConfiguredError(missing);
  return {
    clientId: clientId!,
    clientSecret: clientSecret!,
    refreshToken: refreshToken!,
    channelId: channelId ?? null,
  };
}

export async function isYtConfigured(): Promise<boolean> {
  try {
    await loadCredentials();
    return true;
  } catch (err) {
    if (err instanceof YtNotConfiguredError) return false;
    throw err;
  }
}

async function getAccessToken(force = false): Promise<string> {
  const now = Date.now();
  if (!force && cachedToken && cachedToken.expiresAt > now + 60_000) {
    return cachedToken.token;
  }
  const creds = await loadCredentials();
  const body = new URLSearchParams({
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    refresh_token: creds.refreshToken,
    grant_type: "refresh_token",
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    // 400 "invalid_grant" here means the refresh token was revoked/expired —
    // surfaced to the caller so admin can re-run the OAuth dance.
    throw new YtApiError(res.status, "OAuth token refresh failed", text.slice(0, 300));
  }
  const json = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!json.access_token) {
    throw new YtApiError(500, "OAuth token refresh returned no access_token");
  }
  const ttl = Math.min(json.expires_in ?? ACCESS_TOKEN_TTL_SEC, ACCESS_TOKEN_TTL_SEC);
  cachedToken = { token: json.access_token, expiresAt: now + ttl * 1000 };
  return json.access_token;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Authenticated YouTube REST call with 401-refresh-retry + 5xx backoff.
// Returns parsed JSON (or null for 204). Responses are loosely-typed Google
// JSON; callers narrow the few fields they read.
async function ytFetch<T>(
  method: "GET" | "POST",
  path: string,
  jsonBody?: unknown,
): Promise<T> {
  let token = await getAccessToken();
  // Two independent recovery budgets so a 5xx never consumes the 401-refresh try
  // (and vice-versa): one forced token refresh + up to 3 backed-off 5xx retries.
  let refreshed = false;
  let backoff = 0;
  while (true) {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    };
    if (jsonBody !== undefined) headers["Content-Type"] = "application/json";
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: jsonBody !== undefined ? JSON.stringify(jsonBody) : undefined,
    });

    if (res.status === 401 && !refreshed) {
      refreshed = true;
      token = await getAccessToken(true);
      continue;
    }
    if (res.status >= 500 && backoff < 3) {
      backoff++;
      await sleep(300 * 2 ** (backoff - 1));
      continue;
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new YtApiError(
        res.status,
        `youtube ${method} ${path.split("?")[0]} failed (${res.status})`,
        text.slice(0, 400),
      );
    }
    if (res.status === 204) return null as T;
    return (await res.json()) as T;
  }
}

export interface CreatedBroadcast {
  broadcastId: string;
  videoId: string; // identical to broadcastId for YouTube Live
}

export interface StreamIngestion {
  rtmpUrl: string;
  streamKey: string;
  backupRtmpUrl: string | null;
}

export interface CreatedStream extends StreamIngestion {
  streamId: string;
}

export async function createBroadcast(opts: {
  title: string;
  description?: string;
  scheduledStartTime: string; // ISO 8601
}): Promise<CreatedBroadcast> {
  const json = await ytFetch<{ id: string }>(
    "POST",
    "/liveBroadcasts?part=snippet,status,contentDetails",
    {
      snippet: {
        title: opts.title.slice(0, 100),
        description: (opts.description ?? "").slice(0, 5000),
        scheduledStartTime: opts.scheduledStartTime,
      },
      status: {
        privacyStatus: "unlisted",
        selfDeclaredMadeForKids: false,
      },
      contentDetails: {
        enableAutoStart: true,
        enableAutoStop: true,
        enableDvr: true,
        recordFromStart: true,
        latencyPreference: "low",
        monitorStream: { enableMonitorStream: false },
      },
    },
  );
  return { broadcastId: json.id, videoId: json.id };
}

export async function createStream(opts: { title: string }): Promise<CreatedStream> {
  const json = await ytFetch<{
    id: string;
    cdn?: {
      ingestionInfo?: {
        ingestionAddress?: string;
        streamName?: string;
        backupIngestionAddress?: string;
      };
    };
  }>("POST", "/liveStreams?part=snippet,cdn,contentDetails", {
    snippet: { title: opts.title.slice(0, 128) },
    cdn: { frameRate: "30fps", ingestionType: "rtmp", resolution: "720p" },
    contentDetails: { isReusable: false },
  });
  const ing = json.cdn?.ingestionInfo ?? {};
  return {
    streamId: json.id,
    rtmpUrl: ing.ingestionAddress ?? "",
    streamKey: ing.streamName ?? "",
    backupRtmpUrl: ing.backupIngestionAddress ?? null,
  };
}

export async function bindBroadcast(broadcastId: string, streamId: string): Promise<void> {
  await ytFetch(
    "POST",
    `/liveBroadcasts/bind?id=${encodeURIComponent(broadcastId)}&streamId=${encodeURIComponent(streamId)}&part=id,contentDetails`,
  );
}

export type BroadcastLifeCycle =
  | "created"
  | "ready"
  | "testStarting"
  | "testing"
  | "liveStarting"
  | "live"
  | "complete"
  | "revoked"
  | string;

export async function getBroadcast(
  broadcastId: string,
): Promise<{ lifeCycleStatus: BroadcastLifeCycle; boundStreamId: string | null } | null> {
  const json = await ytFetch<{
    items?: Array<{
      status?: { lifeCycleStatus?: string };
      contentDetails?: { boundStreamId?: string };
    }>;
  }>("GET", `/liveBroadcasts?id=${encodeURIComponent(broadcastId)}&part=status,contentDetails`);
  const item = (json.items ?? [])[0];
  if (!item) return null;
  return {
    lifeCycleStatus: item.status?.lifeCycleStatus ?? "created",
    boundStreamId: item.contentDetails?.boundStreamId ?? null,
  };
}

export async function transitionBroadcast(
  broadcastId: string,
  to: "testing" | "live" | "complete",
): Promise<void> {
  await ytFetch(
    "POST",
    `/liveBroadcasts/transition?broadcastStatus=${to}&id=${encodeURIComponent(broadcastId)}&part=id,status`,
  );
}

export async function getStreamIngestion(streamId: string): Promise<StreamIngestion | null> {
  const json = await ytFetch<{
    items?: Array<{
      cdn?: {
        ingestionInfo?: {
          ingestionAddress?: string;
          streamName?: string;
          backupIngestionAddress?: string;
        };
      };
    }>;
  }>("GET", `/liveStreams?id=${encodeURIComponent(streamId)}&part=cdn`);
  const item = (json.items ?? [])[0];
  if (!item) return null;
  const ing = item.cdn?.ingestionInfo ?? {};
  return {
    rtmpUrl: ing.ingestionAddress ?? "",
    streamKey: ing.streamName ?? "",
    backupRtmpUrl: ing.backupIngestionAddress ?? null,
  };
}
