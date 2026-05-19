// Phase 5 — End-to-end smoke for every Phase 5 edge fn.
//
// Verifies: auth gate, schema validation, happy path, and selected error
// cases for content-presign-upload, content-finalize, content-create-video,
// yt-playback-sign, yt-thumb-sign, content-toggle-publish,
// content-promote-coursewide, content-pdf-sign, content-delete.
//
// Run: pnpm exec tsx scripts/smoke-test-content-edge-fns.ts

import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { formatWatermark } from "../apps/functions/_shared/watermark.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({
  path: resolve(__dirname, "..", "apps", "admin", ".env.local"),
  override: false,
});

const SUPABASE_URL = required("NEXT_PUBLIC_SUPABASE_URL");
const ANON_KEY = required("NEXT_PUBLIC_SUPABASE_ANON_KEY");
const SERVICE_KEY = required("SUPABASE_SERVICE_ROLE_KEY");
const OWNER_EMAIL = process.env.OWNER_EMAIL ?? "owner@fynestudy.example.com";
const OWNER_PASSWORD = process.env.OWNER_INITIAL_PASSWORD ?? "FyneStudy01";

function required(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`missing env var ${name}`);
    process.exit(1);
  }
  return v;
}
function header(s: string) { console.log(`\n=== ${s} ===`); }
function pass(s: string) { console.log(`  PASS  ${s}`); }
function fail(s: string): never {
  console.error(`  FAIL  ${s}`);
  process.exit(1);
}

async function callFn(name: string, body: unknown, jwt: string | null) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (jwt) headers.Authorization = `Bearer ${jwt}`;
  else headers.apikey = ANON_KEY;
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, body: data as Record<string, unknown> };
}

async function signIn(email: string, password: string) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) fail(`signIn ${email}: ${res.status} ${JSON.stringify(data)}`);
  return data.access_token as string;
}

async function main() {
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  header("Setup — owner sign-in + fixtures");
  const ownerJwt = await signIn(OWNER_EMAIL, OWNER_PASSWORD);
  pass("owner JWT");

  const ts = Date.now();
  const courseCode = `EF_${ts}`;
  const cRes = await callFn(
    "curriculum-mutate",
    { op: "create_course", payload: { code: courseCode, name: `EF ${ts}` } },
    ownerJwt,
  );
  if (cRes.status !== 200) fail(`create course: ${JSON.stringify(cRes.body)}`);
  const courseId = (cRes.body.row as { id: string }).id;
  const sRes = await callFn(
    "curriculum-mutate",
    { op: "create_subject", payload: { course_id: courseId, name: "S", sort_order: 0 } },
    ownerJwt,
  );
  const subjectId = (sRes.body.row as { id: string }).id;
  const chRes = await callFn(
    "curriculum-mutate",
    { op: "create_chapter", payload: { subject_id: subjectId, name: "C", sort_order: 0 } },
    ownerJwt,
  );
  const chapterId = (chRes.body.row as { id: string }).id;
  const topRes = await callFn(
    "curriculum-mutate",
    { op: "create_topic", payload: { chapter_id: chapterId, name: "T", sort_order: 0 } },
    ownerJwt,
  );
  const topicId = (topRes.body.row as { id: string }).id;
  const bRes = await callFn(
    "batch-mutate",
    {
      op: "create_batch",
      payload: {
        course_id: courseId,
        name: `EF-A-${ts}`,
        starts_on: new Date().toISOString().slice(0, 10),
        capacity: 10,
      },
    },
    ownerJwt,
  );
  const batchId = (bRes.body.row as { id: string }).id;
  const stuFullName = `EF stu ${ts}`;
  const stuPhone = "+919876541234"; // last4 = 1234 — watermark assertion below
  const stuRes = await callFn(
    "auth-bootstrap",
    {
      role: "student",
      full_name: stuFullName,
      email: `ef-stu-${ts}@example.com`,
      phone: stuPhone,
      parent_consent_method: "verbal",
      batch_id: batchId,
    },
    ownerJwt,
  );
  const stu = stuRes.body as { user_id: string; email: string; initial_password: string };
  const tchRes = await callFn(
    "auth-bootstrap",
    {
      role: "teacher",
      full_name: `EF teacher ${ts}`,
      email: `ef-t-${ts}@example.com`,
      subjects: ["physics"],
    },
    ownerJwt,
  );
  const tch = tchRes.body as { user_id: string; email: string; initial_password: string };
  await callFn(
    "batch-mutate",
    { op: "assign_teacher", batch_id: batchId, teacher_id: tch.user_id },
    ownerJwt,
  );
  pass("course+batch+student+teacher fixtures created");

  const stuJwt = await signIn(stu.email, stu.initial_password);
  const tchJwt = await signIn(tch.email, tch.initial_password);
  pass("student + teacher JWTs acquired");

  // ============ content-presign-upload ============
  header("content-presign-upload — 401 without auth");
  const npa = await callFn("content-presign-upload", {}, null);
  if (npa.status !== 401) fail(`expected 401 anon, got ${npa.status}`);
  pass("401 anon");

  header("content-presign-upload — 403 student");
  const sp = await callFn(
    "content-presign-upload",
    { kind: "pdf", topic_id: topicId, title: "x", content_size_bytes: 100, mime_type: "application/pdf" },
    stuJwt,
  );
  if (sp.status !== 403) fail(`expected 403 student, got ${sp.status} ${JSON.stringify(sp.body)}`);
  pass("403 student");

  header("content-presign-upload — 400 invalid payload");
  const inv = await callFn("content-presign-upload", { kind: "garbage" }, tchJwt);
  if (inv.status !== 400) fail(`expected 400, got ${inv.status} ${JSON.stringify(inv.body)}`);
  pass("400 invalid");

  header("content-presign-upload — 413 oversize");
  const over = await callFn(
    "content-presign-upload",
    {
      kind: "pdf",
      topic_id: topicId,
      title: "x",
      batch_id: batchId,
      content_size_bytes: 60 * 1024 * 1024,
      mime_type: "application/pdf",
    },
    tchJwt,
  );
  // schema-level cap blocks first → 400; runtime check returns 413. Either OK.
  if (![400, 413].includes(over.status)) {
    fail(`expected 400|413 oversize, got ${over.status} ${JSON.stringify(over.body)}`);
  }
  pass(`oversize rejected (${over.status})`);

  header("content-presign-upload — 200 teacher happy path");
  const presign = await callFn(
    "content-presign-upload",
    {
      kind: "pdf",
      topic_id: topicId,
      title: "EF test pdf",
      batch_id: batchId,
      content_size_bytes: 1024,
      mime_type: "application/pdf",
    },
    tchJwt,
  );
  if (presign.status !== 200) {
    fail(`expected 200, got ${presign.status} ${JSON.stringify(presign.body)}`);
  }
  if (!presign.body.upload_url || !presign.body.path || !presign.body.token) {
    fail(`presign body missing fields: ${JSON.stringify(presign.body)}`);
  }
  pass("teacher got signed upload URL");

  // Upload a tiny "PDF" via the signed URL.
  header("Storage — PUT via signed upload URL");
  const tinyPdf = new Uint8Array([
    0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, // %PDF-1.4\n
  ]);
  const putRes = await fetch(presign.body.upload_url as string, {
    method: "PUT",
    headers: { "Content-Type": "application/pdf" },
    body: tinyPdf,
  });
  if (!putRes.ok) {
    fail(`PUT to signed url failed: ${putRes.status} ${await putRes.text()}`);
  }
  pass(`PUT 200 (${putRes.status})`);

  // ============ content-finalize ============
  header("content-finalize — 200 happy path");
  const fin = await callFn(
    "content-finalize",
    {
      kind: "pdf",
      topic_id: topicId,
      title: "EF test pdf",
      batch_id: batchId,
      file_path: presign.body.path,
      file_size_bytes: tinyPdf.length,
      mime_type: "application/pdf",
    },
    tchJwt,
  );
  if (fin.status !== 200) {
    fail(`expected 200, got ${fin.status} ${JSON.stringify(fin.body)}`);
  }
  const pdfContent = (fin.body.content_item as { id: string });
  pass(`content_item id ${pdfContent.id}`);

  header("content-finalize — 404 when file missing");
  const finMissing = await callFn(
    "content-finalize",
    {
      kind: "pdf",
      topic_id: topicId,
      title: "x",
      batch_id: batchId,
      file_path: `${courseId}/${topicId}/no-such-file.pdf`,
    },
    tchJwt,
  );
  if (finMissing.status !== 404) {
    fail(`expected 404, got ${finMissing.status} ${JSON.stringify(finMissing.body)}`);
  }
  pass("404 missing file");

  // ============ content-create-video ============
  header("content-create-video — 400 invalid YT URL");
  const ytBad = await callFn(
    "content-create-video",
    { yt_url_or_id: "not-a-url", topic_id: topicId, title: "x", batch_id: batchId },
    tchJwt,
  );
  if (ytBad.status !== 400) {
    fail(`expected 400 bad YT, got ${ytBad.status} ${JSON.stringify(ytBad.body)}`);
  }
  pass("400 bad YT URL");

  header("content-create-video — 200 happy path (dev mode, no API key)");
  const fakeYtId = `EFt${Math.random().toString(36).slice(2, 10).padEnd(8, "x")}`;
  const ytOk = await callFn(
    "content-create-video",
    {
      yt_url_or_id: `https://www.youtube.com/watch?v=${fakeYtId}`,
      topic_id: topicId,
      title: "EF test video",
      batch_id: batchId,
    },
    tchJwt,
  );
  if (ytOk.status !== 200) {
    fail(`expected 200, got ${ytOk.status} ${JSON.stringify(ytOk.body)}`);
  }
  if ((ytOk.body as { yt_verified: boolean }).yt_verified !== false) {
    pass(`dev mode (no API key) — yt_verified=${(ytOk.body as { yt_verified?: boolean }).yt_verified}`);
  } else {
    pass(`accepted without YT verification`);
  }
  const videoContent = (ytOk.body.content_item as { id: string });

  header("content-create-video — 409 duplicate");
  const ytDup = await callFn(
    "content-create-video",
    {
      yt_url_or_id: `https://www.youtube.com/watch?v=${fakeYtId}`,
      topic_id: topicId,
      title: "EF test video dup",
      batch_id: batchId,
    },
    tchJwt,
  );
  if (ytDup.status !== 409) {
    fail(`expected 409, got ${ytDup.status} ${JSON.stringify(ytDup.body)}`);
  }
  pass("409 duplicate yt_video_id");

  // ============ yt-playback-sign ============
  header("yt-playback-sign — 200 student happy path");
  const pb = await callFn(
    "yt-playback-sign",
    { content_id: videoContent.id },
    stuJwt,
  );
  if (pb.status !== 200) {
    fail(`expected 200, got ${pb.status} ${JSON.stringify(pb.body)}`);
  }
  if (!pb.body.envelope || !pb.body.video_id || !pb.body.watermark || !pb.body.exp) {
    fail(`pb body missing fields: ${JSON.stringify(pb.body)}`);
  }
  if (pb.body.video_id !== fakeYtId) {
    fail(`pb returned wrong video_id: ${pb.body.video_id}`);
  }
  const expectedWm = formatWatermark(stuFullName, stuPhone);
  if (pb.body.watermark !== expectedWm) {
    fail(`watermark mismatch: got "${pb.body.watermark}", expected "${expectedWm}"`);
  }
  pass(`pb env=${(pb.body.envelope as string).slice(0, 16)}… wm="${pb.body.watermark}" (matches formatter)`);

  header("yt-playback-sign — 404 on PDF content");
  const pbPdf = await callFn(
    "yt-playback-sign",
    { content_id: pdfContent.id },
    stuJwt,
  );
  if (pbPdf.status !== 400) {
    fail(`expected 400, got ${pbPdf.status} ${JSON.stringify(pbPdf.body)}`);
  }
  pass("400 on non-video");

  // ============ yt-thumb-sign ============
  header("yt-thumb-sign — 200");
  const th = await callFn("yt-thumb-sign", { content_id: videoContent.id }, stuJwt);
  if (th.status !== 200) {
    fail(`expected 200, got ${th.status} ${JSON.stringify(th.body)}`);
  }
  if (!String(th.body.thumbnail_url).includes(fakeYtId)) {
    fail(`thumb url missing id: ${th.body.thumbnail_url}`);
  }
  pass(`thumb_url ok`);

  // ============ content-pdf-sign (NEW) ============
  header("content-pdf-sign — 200 student happy path");
  const ps = await callFn(
    "content-pdf-sign",
    { content_id: pdfContent.id },
    stuJwt,
  );
  if (ps.status !== 200) {
    fail(`expected 200, got ${ps.status} ${JSON.stringify(ps.body)}`);
  }
  if (!ps.body.signed_url || !String(ps.body.signed_url).includes(courseId)) {
    fail(`pdf-sign body missing/wrong signed_url: ${JSON.stringify(ps.body)}`);
  }
  pass(`signed_url issued`);

  header("content-pdf-sign — 400 on video content");
  const psVideo = await callFn(
    "content-pdf-sign",
    { content_id: videoContent.id },
    stuJwt,
  );
  if (psVideo.status !== 400) {
    fail(`expected 400, got ${psVideo.status} ${JSON.stringify(psVideo.body)}`);
  }
  pass(`400 on video`);

  // Verify the signed URL actually returns the file content
  header("content-pdf-sign — signed URL serves the PDF bytes");
  const psFetch = await fetch(ps.body.signed_url as string);
  if (!psFetch.ok) {
    fail(`signed url GET failed: ${psFetch.status}`);
  }
  const psBytes = new Uint8Array(await psFetch.arrayBuffer());
  if (psBytes.length !== tinyPdf.length || psBytes[0] !== 0x25) {
    fail(`signed url returned wrong bytes (len=${psBytes.length})`);
  }
  pass(`signed URL served ${psBytes.length} bytes`);

  // ============ content-toggle-publish ============
  header("content-toggle-publish — 403 student");
  const tpStu = await callFn(
    "content-toggle-publish",
    { content_id: pdfContent.id, is_published: false },
    stuJwt,
  );
  if (tpStu.status !== 403) {
    fail(`expected 403, got ${tpStu.status} ${JSON.stringify(tpStu.body)}`);
  }
  pass("403 student");

  header("content-toggle-publish — 200 admin unpublish + republish");
  const tpDown = await callFn(
    "content-toggle-publish",
    { content_id: pdfContent.id, is_published: false },
    ownerJwt,
  );
  if (tpDown.status !== 200) {
    fail(`expected 200, got ${tpDown.status} ${JSON.stringify(tpDown.body)}`);
  }
  const tpUp = await callFn(
    "content-toggle-publish",
    { content_id: pdfContent.id, is_published: true },
    ownerJwt,
  );
  if (tpUp.status !== 200) {
    fail(`expected 200, got ${tpUp.status} ${JSON.stringify(tpUp.body)}`);
  }
  pass("admin toggle works both ways");

  header("content-toggle-publish — audit rows present for both actions");
  const { data: pubAudits } = await admin
    .from("audit_log")
    .select("action, before_data, after_data")
    .eq("entity_id", pdfContent.id)
    .in("action", ["content_publish", "content_unpublish"])
    .order("occurred_at", { ascending: true });
  if (!pubAudits || pubAudits.length !== 2) {
    fail(`expected 2 audit rows, got ${pubAudits?.length ?? 0}`);
  }
  if (pubAudits[0].action !== "content_unpublish") {
    fail(`first audit should be unpublish, got ${pubAudits[0].action}`);
  }
  if (
    (pubAudits[0].before_data as { is_published?: boolean })?.is_published !==
      true ||
    (pubAudits[0].after_data as { is_published?: boolean })?.is_published !==
      false
  ) {
    fail(`unpublish before/after wrong: ${JSON.stringify(pubAudits[0])}`);
  }
  if (pubAudits[1].action !== "content_publish") {
    fail(`second audit should be publish, got ${pubAudits[1].action}`);
  }
  if (
    (pubAudits[1].before_data as { is_published?: boolean })?.is_published !==
      false ||
    (pubAudits[1].after_data as { is_published?: boolean })?.is_published !==
      true
  ) {
    fail(`publish before/after wrong: ${JSON.stringify(pubAudits[1])}`);
  }
  pass("audit captures before/after for both publish + unpublish");

  // ============ content-promote-coursewide ============
  header("content-promote-coursewide — 200 promote to course-wide");
  const prom = await callFn(
    "content-promote-coursewide",
    { content_id: pdfContent.id, promote: true },
    ownerJwt,
  );
  if (prom.status !== 200) {
    fail(`expected 200, got ${prom.status} ${JSON.stringify(prom.body)}`);
  }
  if ((prom.body.content_item as { batch_id: string | null }).batch_id !== null) {
    fail(`expected batch_id=null after promote`);
  }
  pass("promoted (batch_id=null)");

  header("content-promote-coursewide — 200 un-promote back to batch");
  const unprom = await callFn(
    "content-promote-coursewide",
    { content_id: pdfContent.id, promote: false, batch_id: batchId },
    ownerJwt,
  );
  if (unprom.status !== 200) {
    fail(`expected 200, got ${unprom.status} ${JSON.stringify(unprom.body)}`);
  }
  if ((unprom.body.content_item as { batch_id: string }).batch_id !== batchId) {
    fail(`expected batch_id=${batchId} after un-promote`);
  }
  pass("un-promoted (batch_id back)");

  header("content-promote-coursewide — audit rows present for both directions");
  const { data: promAudits } = await admin
    .from("audit_log")
    .select("action, before_data, after_data")
    .eq("entity_id", pdfContent.id)
    .in("action", ["content_promote", "content_unpromote"])
    .order("occurred_at", { ascending: true });
  if (!promAudits || promAudits.length !== 2) {
    fail(`expected 2 promote audit rows, got ${promAudits?.length ?? 0}`);
  }
  if (promAudits[0].action !== "content_promote") {
    fail(`first should be promote, got ${promAudits[0].action}`);
  }
  if ((promAudits[0].after_data as { batch_id: string | null })?.batch_id !== null) {
    fail(`promote after_data.batch_id should be null`);
  }
  if (promAudits[1].action !== "content_unpromote") {
    fail(`second should be unpromote, got ${promAudits[1].action}`);
  }
  if (
    (promAudits[1].after_data as { batch_id: string })?.batch_id !== batchId
  ) {
    fail(`unpromote after_data.batch_id should be ${batchId}`);
  }
  pass("audit captures both promote + unpromote with correct batch_id");

  // ============ content-delete (NEW) ============
  header("content-delete — 403 student");
  const dStu = await callFn("content-delete", { content_id: pdfContent.id }, stuJwt);
  if (dStu.status !== 403) {
    fail(`expected 403, got ${dStu.status} ${JSON.stringify(dStu.body)}`);
  }
  pass("403 student");

  header("content-delete — 200 admin");
  const dOk = await callFn("content-delete", { content_id: pdfContent.id }, ownerJwt);
  if (dOk.status !== 200) {
    fail(`expected 200, got ${dOk.status} ${JSON.stringify(dOk.body)}`);
  }
  pass("admin delete OK");

  header("content-delete — verify audit_log row written");
  const { data: audits } = await admin
    .from("audit_log")
    .select("id, action, entity_id, before_data")
    .eq("entity_id", pdfContent.id)
    .eq("action", "content_delete");
  if (!audits || audits.length !== 1) {
    fail(`expected 1 audit row, got ${audits?.length ?? 0}`);
  }
  pass(`audit_log row present for content_delete`);

  // Verify the video content also gone (cleanup)
  await admin.from("content_items").delete().eq("id", videoContent.id);

  console.log("\n✅ All Phase 5 edge fns smoke green.");
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
