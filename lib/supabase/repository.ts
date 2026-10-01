import "server-only";

import { getSupabaseServiceClient } from "@/lib/supabase/server";
import type {
  FeedbackRecord,
  ModelJob,
  ResultBundle,
  StudentSession,
  TaskBundle,
  TranslationTask
} from "@/types/feedback";

export async function createStudentSessionRecord(input: {
  firstName: string;
  lastName: string;
  accessTokenHash: string;
}) {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("student_sessions")
    .insert({
      first_name: input.firstName,
      last_name: input.lastName,
      access_token_hash: input.accessTokenHash,
      status: "active"
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Oturum oluşturulamadı: ${error.message}`);
  }
  return data as StudentSession;
}

export async function getStudentSession(sessionId: string) {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("student_sessions")
    .select("*")
    .eq("id", sessionId)
    .single();

  if (error || !data) {
    return null;
  }
  return data as StudentSession;
}

export async function getTasksForSession(sessionId: string) {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("translation_tasks")
    .select("*")
    .eq("session_id", sessionId)
    .order("task_number", { ascending: true });

  if (error) {
    throw new Error(`Çalışmalar okunamadı: ${error.message}`);
  }
  return (data ?? []) as TranslationTask[];
}

export async function getTaskBundle(sessionId: string, taskNumber: 1 | 2): Promise<TaskBundle> {
  const supabase = getSupabaseServiceClient();
  const { data: task, error: taskError } = await supabase
    .from("translation_tasks")
    .select("*")
    .eq("session_id", sessionId)
    .eq("task_number", taskNumber)
    .maybeSingle();

  if (taskError) {
    throw new Error(`Çalışma okunamadı: ${taskError.message}`);
  }

  if (!task) {
    return { task: null, feedback: null, job: null };
  }

  const [{ data: feedback, error: feedbackError }, { data: job, error: jobError }] = await Promise.all([
    supabase
      .from("feedbacks")
      .select("*")
      .eq("task_id", task.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("model_jobs")
      .select("*")
      .eq("task_id", task.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
  ]);

  if (feedbackError) {
    throw new Error(`Geri bildirim okunamadı: ${feedbackError.message}`);
  }
  if (jobError) {
    throw new Error(`İş durumu okunamadı: ${jobError.message}`);
  }

  return {
    task: task as TranslationTask,
    feedback: feedback as FeedbackRecord | null,
    job: job as ModelJob | null
  };
}

export async function submitInitialTask(input: {
  sessionId: string;
  taskNumber: 1 | 2;
  sourceText: string;
  initialTranslation: string;
}) {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase.rpc("submit_translation_task", {
    p_session_id: input.sessionId,
    p_task_number: input.taskNumber,
    p_source_text: input.sourceText,
    p_initial_translation: input.initialTranslation
  });

  if (error) {
    throw new Error(`Çalışma gönderilemedi: ${error.message}`);
  }

  return data as TranslationTask;
}

export async function submitTaskRevision(input: {
  sessionId: string;
  taskNumber: 1 | 2;
  revisedTranslation: string;
}) {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("translation_tasks")
    .update({
      revised_translation: input.revisedTranslation,
      status: "revised",
      revised_at: new Date().toISOString()
    })
    .eq("session_id", input.sessionId)
    .eq("task_number", input.taskNumber)
    .eq("status", "feedback_ready")
    .is("revised_translation", null)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Son çeviri kaydedilemedi: ${error.message}`);
  }

  await markSessionCompletedIfReady(input.sessionId);
  return data as TranslationTask;
}

export async function retryFailedJob(sessionId: string, taskNumber: 1 | 2) {
  const supabase = getSupabaseServiceClient();
  const bundle = await getTaskBundle(sessionId, taskNumber);
  if (!bundle.task || !bundle.job || bundle.job.status !== "failed") {
    throw new Error("Yeniden denenebilir başarısız iş bulunamadı.");
  }

  const { error } = await supabase
    .from("model_jobs")
    .update({
      status: "queued",
      attempt_count: 0,
      locked_by: null,
      lease_expires_at: null,
      last_error: null,
      started_at: null,
      completed_at: null
    })
    .eq("id", bundle.job.id);

  if (error) {
    throw new Error(`İş yeniden sıraya alınamadı: ${error.message}`);
  }
}

export async function getResultBundle(sessionId: string): Promise<ResultBundle | null> {
  const session = await getStudentSession(sessionId);
  if (!session) {
    return null;
  }

  const [task1Bundle, task2Bundle] = await Promise.all([
    getTaskBundle(sessionId, 1),
    getTaskBundle(sessionId, 2)
  ]);

  if (!task1Bundle.task || !task2Bundle.task || !task1Bundle.feedback || !task2Bundle.feedback) {
    return null;
  }

  return {
    session,
    task1: task1Bundle.task,
    task2: task2Bundle.task,
    feedback1: task1Bundle.feedback,
    feedback2: task2Bundle.feedback
  };
}

async function markSessionCompletedIfReady(sessionId: string) {
  const supabase = getSupabaseServiceClient();
  const tasks = await getTasksForSession(sessionId);
  const ready = tasks.some((task) => task.task_number === 1 && task.status === "revised")
    && tasks.some((task) => task.task_number === 2 && task.status === "revised");

  if (!ready) {
    return;
  }

  const { error } = await supabase
    .from("student_sessions")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", sessionId);

  if (error) {
    throw new Error(`Oturum tamamlanamadı: ${error.message}`);
  }
}
