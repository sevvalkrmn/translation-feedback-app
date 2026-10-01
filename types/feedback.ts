export type Severity = "minor" | "major" | "critical";

export type TaskMethod = "llm" | "xai";

export type FeedbackType = "llm_feedback" | "xai_feedback";

export type JobStatus = "queued" | "processing" | "succeeded" | "failed";

export type SessionStatus = "active" | "completed";

export type TranslationTaskStatus = "draft" | "submitted" | "feedback_ready" | "revised";

export type ErrorCategory =
  | "meaning_shift" | "omission" | "addition" | "terminology"
  | "grammar" | "fluency" | "register_style" | "cohesion";

export interface EvaluationError {
  id: string;
  source_span: string;
  translation_span: string;
  category: ErrorCategory;
  severity: Severity;
  source_meaning: string;
  detected_problem: string;
  student_hint: string;
}

export interface TranslationEvaluation {
  schema_version: "1.0";
  prompt_version: "translation-evaluation-v1";
  model: "Qwen3.8-27B";
  language_pair: "tr-en";
  overall_score: number;
  dimension_scores: {
    meaning_accuracy: number;
    completeness: number;
    grammar_fluency: number;
    terminology_register: number;
  };
  errors: EvaluationError[];
  summary: string;
}

export interface LLMFeedbackError {
  source_span: string;
  translation_span: string;
  category: ErrorCategory;
  severity: Severity;
  explanation: string;
  hint: string;
}

export interface LLMFeedbackResult {
  method: "llm";
  summary: string;
  errors: LLMFeedbackError[];
  evaluation: TranslationEvaluation;
}

export interface XaiVerification {
  status: "verified" | "inconclusive";
  before_severity: Severity;
  after_severity: Severity | null;
  relevant_dimension: keyof TranslationEvaluation["dimension_scores"];
  score_delta: number;
  no_new_major_error: boolean;
}

export interface XaiEvidenceItem {
  source_span: string;
  translation_span: string;
  category: ErrorCategory;
  severity: Severity;
  decision_explanation: string;
  verification: XaiVerification;
  student_hint: string;
}

export interface XAIResult {
  method: "xai";
  summary: string;
  evidence_items: XaiEvidenceItem[];
  evaluation: TranslationEvaluation;
}

export type StructuredFeedback = LLMFeedbackResult | XAIResult;

export interface StudentSession {
  id: string;
  first_name: string;
  last_name: string;
  status: SessionStatus;
  created_at: string;
  completed_at: string | null;
}

export interface TranslationTask {
  id: string;
  session_id: string;
  task_number: 1 | 2;
  method: TaskMethod;
  source_text: string;
  initial_translation: string;
  revised_translation: string | null;
  status: TranslationTaskStatus;
  created_at: string;
  submitted_at: string | null;
  revised_at: string | null;
}

export interface FeedbackRecord {
  id: string;
  task_id: string;
  feedback_type: FeedbackType;
  model_name: string;
  structured_output: StructuredFeedback;
  raw_output: unknown;
  created_at: string;
}

export interface ModelJob {
  id: string;
  task_id: string;
  job_type: FeedbackType;
  status: JobStatus;
  attempt_count: number;
  max_attempts: number;
  locked_by: string | null;
  lease_expires_at: string | null;
  last_error: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface ModelJobStatus {
  status: JobStatus;
}

export interface TaskBundle {
  task: TranslationTask | null;
  feedback: FeedbackRecord | null;
  job: ModelJobStatus | null;
}

export interface ResultBundle {
  session: StudentSession;
  task1: TranslationTask;
  task2: TranslationTask;
  feedback1: FeedbackRecord;
  feedback2: FeedbackRecord;
}
