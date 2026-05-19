// Shapes returned by the Phase 6 edge functions. Keep in sync with
// `apps/functions/quiz-{start,submit,attempt-result}/index.ts`.

export interface QuizStartOption {
  id: string;
  text_md: string;
  image_url: string | null;
}

export interface QuizStartQuestion {
  id: string;
  prompt_md: string;
  prompt_image_url: string | null;
  difficulty: "easy" | "medium" | "hard" | null;
  options: QuizStartOption[];
}

export interface QuizStartResponse {
  attempt_id: string;
  status: "in_flight";
  started_at: string;
  server_now: string;
  deadline_at: string;
  duration_min: number;
  marks_correct: number;
  marks_wrong: number;
  marks_skip: number;
  quiz: {
    id: string;
    title: string;
    topic_id: string | null;
    chapter_id: string | null;
    randomize_questions: boolean;
    randomize_options: boolean;
  };
  questions: QuizStartQuestion[];
  saved_answers: SavedAnswer[];
}

export interface SavedAnswer {
  question_id: string;
  selected_option_id: string | null;
  is_flagged: boolean;
  answered_at: string | null;
}

export interface SolutionOption {
  id: string;
  text_md: string;
  image_url: string | null;
  is_correct: boolean;
}

export interface SolutionRelatedContent {
  id: string;
  title: string;
  kind: string;
}

export interface SolutionQuestion {
  id: string;
  prompt_md: string;
  prompt_image_url: string | null;
  difficulty: "easy" | "medium" | "hard" | null;
  topic_id: string | null;
  options: SolutionOption[];
  explanation_md: string | null;
  related_content: SolutionRelatedContent | null;
  your_option_id: string | null;
  correct_option_id: string | null;
  outcome: "correct" | "wrong" | "skipped";
  points: number;
  is_flagged: boolean;
}

export interface QuizSubmitResponse {
  attempt_id: string;
  status: "submitted";
  quiz: {
    id: string;
    title: string;
    marks_correct: number;
    marks_wrong: number;
    marks_skip: number;
    duration_min: number;
  };
  score: number;
  max_score: number;
  correct_count: number;
  wrong_count: number;
  skipped_count: number;
  started_at: string;
  submitted_at: string;
  is_auto_submit: boolean;
  questions: SolutionQuestion[];
}

export interface QuizSummary {
  id: string;
  title: string;
  topic_id: string | null;
  chapter_id: string | null;
  duration_min: number;
  marks_correct: number;
  marks_wrong: number;
  marks_skip: number;
  is_published: boolean;
  created_at: string;
  question_count?: number;
  attempts?: Array<{ id: string; submitted_at: string | null; score: number | null; max_score: number | null }>;
}

export interface QuestionBankRow {
  id: string;
  topic_id: string;
  prompt_md: string;
  difficulty: "easy" | "medium" | "hard" | null;
  is_archived: boolean;
  created_by: string;
  created_at: string;
}
