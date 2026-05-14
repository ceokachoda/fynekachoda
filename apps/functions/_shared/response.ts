import { corsHeaders } from "./cors.ts";

export function json(
  status: number,
  body: unknown,
  origin: string | null,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(origin),
      "Content-Type": "application/json",
    },
  });
}

export function jsonError(
  status: number,
  message: string,
  origin: string | null,
  detail?: unknown,
): Response {
  return json(
    status,
    detail === undefined ? { error: message } : { error: message, detail },
    origin,
  );
}
