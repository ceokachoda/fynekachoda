"use client";

// Phase 4 Track 4B — every teacher-side privileged write goes through an edge
// fn so `audit_log` captures before/after (mobile D-172). This file collects
// the mutation hooks so the call sites only deal with a uniform `mutateAsync`
// surface. The hooks intentionally don't invalidate React Query caches
// themselves — the call sites do that (each screen knows what to refresh).

import { useMutation } from "@tanstack/react-query";
import { invokeEdgeFn, type EdgeFnResult } from "@/lib/edge-fn";

interface AttendanceCorrectInput {
  attendance_id: string;
  new_status: "present" | "late" | "absent";
  reason: string;
}

interface ManualMarkInput {
  session_id: string;
  student_id: string;
  status: "present" | "late" | "absent";
}

interface UnmarkInput {
  session_id: string;
  student_id: string;
}

interface BulkMarkInput {
  session_id: string;
  mark_remaining: "present" | "absent";
}

interface AdHocCreateInput {
  batch_id: string;
  scheduled_start: string;
  scheduled_end: string;
  is_live_class: boolean;
}

interface YtBroadcastCreateResp {
  rtmp_url?: string;
  stream_key?: string;
  error?: string;
}

interface OfflineScoreInput {
  batch_id: string;
  test_name: string;
  test_date: string;
  subject_id?: string;
  max_score: number;
  entries: Array<{
    student_id: string;
    score: number;
    notes?: string;
  }>;
}

interface ContentCreateVideoInput {
  yt_url_or_id: string;
  topic_id: string;
  title: string;
  description?: string;
  batch_id?: string;
}

interface ContentPresignInput {
  kind: "pdf" | "note";
  topic_id: string;
  title: string;
  batch_id?: string;
  content_size_bytes: number;
  mime_type: string;
}

interface ContentPresignResp {
  upload_url: string;
  path: string;
  token: string;
  expires_at: string;
  bucket: string;
  course_id: string;
}

interface ContentFinalizeInput {
  kind: "pdf" | "note";
  topic_id: string;
  title: string;
  description?: string;
  batch_id?: string;
  file_path: string;
  file_size_bytes: number;
  mime_type: string;
}

interface QuizImagePresignInput {
  question_id: string;
  option_id?: string;
  content_size_bytes: number;
  mime_type: string;
}

interface QuizImagePresignResp {
  upload_url: string;
  path: string;
  expires_at: string;
}

interface ExamReleaseInput {
  exam_id: string;
}

interface ExamRegradeInput {
  exam_id: string;
  question_id: string;
  action: "change_correct" | "mark_no_correct" | "mark_all_correct";
  reason: string;
  new_correct_option_id?: string;
}

interface ChatDeleteInput {
  message_id: string;
}

interface ChatBanInput {
  session_id: string;
  user_id: string;
  action: "ban" | "unban";
}

function ensureOk<T>(res: EdgeFnResult<T>): T {
  if (res.status === 200 && res.body !== null) return res.body;
  const errMsg =
    (res.body as { error?: string } | null)?.error ??
    res.error ??
    `Server responded ${res.status}.`;
  throw new Error(errMsg);
}

export function useAttendanceCorrect() {
  return useMutation({
    mutationFn: async (input: AttendanceCorrectInput) => {
      const res = await invokeEdgeFn<{ ok?: boolean; error?: string }>(
        "attendance-correct",
        input,
      );
      return ensureOk(res);
    },
  });
}

export function useAttendanceManualMark() {
  return useMutation({
    mutationFn: async (input: ManualMarkInput) => {
      const res = await invokeEdgeFn<{ ok?: boolean; error?: string }>(
        "attendance-manual-mark",
        input,
      );
      return ensureOk(res);
    },
  });
}

export function useAttendanceUnmark() {
  return useMutation({
    mutationFn: async (input: UnmarkInput) => {
      const res = await invokeEdgeFn<{ ok?: boolean; error?: string }>(
        "attendance-unmark",
        input,
      );
      return ensureOk(res);
    },
  });
}

export function useAttendanceBulkMark() {
  return useMutation({
    mutationFn: async (input: BulkMarkInput) => {
      const res = await invokeEdgeFn<{ ok?: boolean; error?: string }>(
        "attendance-bulk-mark",
        input,
      );
      return ensureOk(res);
    },
  });
}

export function useCreateAdHocSession() {
  return useMutation({
    mutationFn: async (input: AdHocCreateInput) => {
      const res = await invokeEdgeFn<{ session_id?: string; error?: string }>(
        "session-create-ad-hoc",
        input,
      );
      const body = ensureOk(res);
      if (!body.session_id) throw new Error("Server returned an unexpected response.");
      return { session_id: body.session_id };
    },
  });
}

export function useYtBroadcastCreate() {
  return useMutation({
    mutationFn: async (sessionId: string) => {
      const res = await invokeEdgeFn<YtBroadcastCreateResp>(
        "yt-broadcast-create",
        { session_id: sessionId },
      );
      if (res.status === 200 && res.body) return res.body;
      const errMsg =
        res.body?.error ??
        res.error ??
        (res.status === 503
          ? "YouTube isn't configured yet — Vault secrets missing."
          : `Server responded ${res.status}.`);
      throw new Error(errMsg);
    },
  });
}

export function useYtBroadcastGoLive() {
  return useMutation({
    mutationFn: async (sessionId: string) => {
      const res = await invokeEdgeFn<{ ok?: boolean; error?: string }>(
        "yt-broadcast-golive",
        { session_id: sessionId },
      );
      return ensureOk(res);
    },
  });
}

export function useYtBroadcastStop() {
  return useMutation({
    mutationFn: async (sessionId: string) => {
      const res = await invokeEdgeFn<{ ok?: boolean; error?: string }>(
        "yt-broadcast-stop",
        { session_id: sessionId },
      );
      return ensureOk(res);
    },
  });
}

export function useChatDelete() {
  return useMutation({
    mutationFn: async (input: ChatDeleteInput) => {
      const res = await invokeEdgeFn<{ ok?: boolean; error?: string }>(
        "chat-delete",
        input,
      );
      return ensureOk(res);
    },
  });
}

export function useChatBan() {
  return useMutation({
    mutationFn: async (input: ChatBanInput) => {
      const res = await invokeEdgeFn<{ ok?: boolean; error?: string }>(
        "chat-ban",
        input,
      );
      return ensureOk(res);
    },
  });
}

export function useOfflineScoreUpsert() {
  return useMutation({
    mutationFn: async (input: OfflineScoreInput) => {
      const res = await invokeEdgeFn<{
        inserted_count?: number;
        updated_count?: number;
        error?: string;
      }>("offline-score-upsert", input);
      return ensureOk(res);
    },
  });
}

export function useExamRelease() {
  return useMutation({
    mutationFn: async (input: ExamReleaseInput) => {
      const res = await invokeEdgeFn<{
        exam_id?: string;
        results_released_at?: string;
        error?: string;
      }>("exam-release-results", input);
      return ensureOk(res);
    },
  });
}

export function useExamRegrade() {
  return useMutation({
    mutationFn: async (input: ExamRegradeInput) => {
      const res = await invokeEdgeFn<{
        attempts_updated?: number;
        error?: string;
      }>("exam-regrade", input);
      return ensureOk(res);
    },
  });
}

export function useContentCreateVideo() {
  return useMutation({
    mutationFn: async (input: ContentCreateVideoInput) => {
      const res = await invokeEdgeFn<{
        ok?: boolean;
        yt_verified?: boolean;
        error?: string;
      }>("content-create-video", input);
      return ensureOk(res);
    },
  });
}

export function useContentPresignUpload() {
  return useMutation({
    mutationFn: async (input: ContentPresignInput) => {
      const res = await invokeEdgeFn<ContentPresignResp & { error?: string }>(
        "content-presign-upload",
        input,
      );
      return ensureOk(res);
    },
  });
}

export function useContentFinalize() {
  return useMutation({
    mutationFn: async (input: ContentFinalizeInput) => {
      const res = await invokeEdgeFn<{ id?: string; error?: string }>(
        "content-finalize",
        input,
      );
      return ensureOk(res);
    },
  });
}

export function useQuizImagePresign() {
  return useMutation({
    mutationFn: async (input: QuizImagePresignInput) => {
      const res = await invokeEdgeFn<QuizImagePresignResp & { error?: string }>(
        "quiz-image-presign",
        input,
      );
      return ensureOk(res);
    },
  });
}

// PUT a file blob to the presigned URL with progress reporting via XHR. Mirrors
// the mobile content.tsx XHR flow (fetch+`uploadProgress` isn't broadly
// available yet; XHR is the lowest-common-denominator that works on every
// target browser we care about).
export function putBlobWithProgress(
  url: string,
  blob: Blob,
  mimeType: string,
  onProgress?: (pct: number) => void,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`upload http ${xhr.status}: ${xhr.responseText}`));
    };
    xhr.onerror = () => reject(new Error("upload network error"));
    xhr.open("PUT", url, true);
    xhr.setRequestHeader("Content-Type", mimeType);
    xhr.send(blob);
  });
}
