import { useEffect, useState } from "react";
import { env } from "@/lib/env";

export type PingStatus = "loading" | "ok" | "fail";

export function usePingBackend(): PingStatus {
  const [status, setStatus] = useState<PingStatus>("loading");

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    fetch(`${env.supabaseUrl}/functions/v1/health`, {
      headers: { Authorization: `Bearer ${env.supabaseAnonKey}` },
      signal: controller.signal,
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(() => {
        if (!cancelled) setStatus("ok");
      })
      .catch(() => {
        if (!cancelled) setStatus("fail");
      })
      .finally(() => clearTimeout(timeout));

    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timeout);
    };
  }, []);

  return status;
}
