export type Severity = "minor" | "major" | "critical";

export type TaskMethod = "llm" | "xai";

export type FeedbackType = "llm_feedback" | "xai_feedback";

export type JobStatus = "queued" | "processing" | "succeeded" | "failed";

export type SessionStatus = "active" | "completed";

export type TranslationTaskStatus = "draft" | "submitted" | "feedback_ready" | "revised";

export interface XAIError {
  target_span: string;
  target_start: number;
  target_end: number;
  source_span: string;
  severity: Severity;
  confidence: number;
  category: string;
  explanation: string;
  hint: string;
  detector_model: string;
  explainer_model: string;
}

export interface XAIResult {
  overall_score: number;
  summary: string;
  errors: XAIError[];
}

export interface LLMFeedbackError {
  target_span: string;
  category: string;
  severity: Severity;
  explanation: string;
  hint: string;
}

export interface LLMFeedbackResult {
  summary: string;
  strengths: string[];
  errors: LLMFeedbackError[];
  revision_guidance: string[];
}

export type StructuredFeedback = LLMFeedbackResult | XAIResult;

export interface StudentSession {
  id: string;
  first_name: string;
  last_name: string;
  access_token_hash: string;
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

export interface TaskBundle {
  task: TranslationTask | null;
  feedback: FeedbackRecord | null;
  job: ModelJob | null;
}

export interface ResultBundle {
  session: StudentSession;
  task1: TranslationTask;
  task2: TranslationTask;
  feedback1: FeedbackRecord;
  feedback2: FeedbackRecord;
}
