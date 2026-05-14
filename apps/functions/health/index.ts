import "jsr:@supabase/functions-js/edge-runtime.d.ts";

Deno.serve((req: Request) => {
  const url = new URL(req.url);
  if (url.pathname !== "/health") {
    return new Response("Not Found", { status: 404 });
  }
  return Response.json({
    ok: true,
    runtime: "deno",
    version: 1,
    now: new Date().toISOString(),
  });
});
