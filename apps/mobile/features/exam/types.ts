// Shapes returned by the Phase 7 exam-* edge functions. Keep in sync with
// `apps/functions/exam-{start,submit,attempt-result,tab-switch,release-results,regrade,admin-mutate}/index.ts`
// and `apps/functions/offline-score-upsert/index.ts`.

export interface ExamStartOption {
  id: string;
  text_md: string;
  image_url: string | null;
}

export interface ExamStartQuestion {
  id: string;
  prompt_md: string;
  prompt_image_url: string | null;
  difficulty: "easy" | "medium" | "hard" | null;
  options: ExamStartOption[];
}

export interface ExamStartResponse {
  attempt_id: string;
  status: "in_flight";
  started_at: string;
  deadline_at: string;
  server_now: string;
  tab_switch_count: number;
  exam: {
    id: string;
    title: string;
    duration_min: number;
    marks_correct: number;
    marks_wrong: number;
    marks_skip: number;
    result_release: "manual" | "instant";
    randomize_questions: boolean;
    randomize_options: boolean;
  };
  questions: ExamStartQuestion[];
  saved_answers: ExamSavedAnswer[];
}

export interface ExamSavedAnswer {
  question_id: string;
  selected_option_id: string | null;
  is_flagged: boolean;
  answered_at: string | null;
}

export interface ExamSubmitResponseSubmitted {
  attempt_id: string;
  status: "submitted";
  submitted_at: string;
  auto_submitted: boolean;
  tab_switch_count: number;
  results_released: false;
}

export interface ExamSubmitResponseReleased {
  attempt_id: string;
  status: "submitted";
  submitted_at: string;
  auto_submitted: boolean;
  tab_switch_count: number;
  results_released: true;
  score: number;
  max_score: number;
  correct_count: number;
  wrong_count: number;
  skipped_count: number;
}

export type ExamSubmitResponse =
  | ExamSubmitResponseSubmitted
  | ExamSubmitResponseReleased;

export interface ExamSolutionOption {
  id: string;
  text_md: string;
  image_url: string | null;
  is_correct: boolean;
}

export interface ExamSolutionRelatedContent {
  id: string;
  title: string;
  kind: string;
}

export interface ExamSolutionQuestion {
  id: string;
  prompt_md: string;
  prompt_image_url: string | null;
  difficulty: "easy" | "medium" | "hard" | null;
  topic_id: string | null;
  options: ExamSolutionOption[];
  explanation_md: string | null;
  related_content: ExamSolutionRelatedContent | null;
  your_option_id: string | null;
  correct_option_id: string | null;
  outcome: "correct" | "wrong" | "skipped";
  points: number;
  is_flagged: boolean;
}

export interface ExamAttemptResultResponse {
  attempt_id: string;
  status: "submitted";
  exam: {
    id: string;
    title: string;
    marks_correct: number;
    marks_wrong: number;
    marks_skip: number;
    duration_min: number;
    result_release: "manual" | "instant";
    results_released_at: string | null;
  };
  score: number;
  max_score: number;
  correct_count: number;
  wrong_count: number;
  skipped_count: number;
  started_at: string;
  submitted_at: string;
  auto_submitted: boolean;
  tab_switch_count: number;
  questions: ExamSolutionQuestion[];
}

export interface TeacherExamRow {
  id: string;
  title: string;
  batch_id: string;
  batch_name: string;
  starts_at: string;
  duration_min: number;
  is_published: boolean;
  results_released_at: string | null;
  question_count: number;
  attempt_count: number;
  result_release: "manual" | "instant";
}

export interface StudentExamRow {
  id: string;
  title: string;
  starts_at: string;
  duration_min: number;
  is_published: boolean;
  results_released_at: string | null;
  result_release: "manual" | "instant";
  attempt?: {
    id: string;
    submitted_at: string | null;
    score: number | null;
    max_score: number | null;
  };
}

export interface OfflineScoreRow {
  id: string;
  batch_id: string;
  student_id: string;
  test_name: string;
  test_date: string;
  subject_id: string | null;
  score: number;
  max_score: number;
  notes: string | null;
}
