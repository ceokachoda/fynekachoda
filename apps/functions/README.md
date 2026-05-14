# @fynestudy/functions

Supabase Edge Functions (Deno runtime).

- `_shared/` — modules imported by functions; never deployed as standalone.
- One folder per function (e.g., `health/`), each with an `index.ts` entrypoint.

## Deploy

Phase 1 deploys via Supabase MCP / CLI:

```bash
supabase functions deploy health --project-ref <project-ref> --no-verify-jwt
```

Function names use `verb-noun` (e.g., `auth-bootstrap`, `attendance-qr-sign`). Future phases add the rest of the inventory documented in `docs/file-structure.md`.
