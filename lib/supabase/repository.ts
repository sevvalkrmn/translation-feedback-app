import "server-only";

import { getSupabaseServiceClient } from "@/lib/supabase/server";
import type {
  FeedbackRecord,
  ModelJobStatus,
  ResultBundle,
  StudentSession,
  TaskBundle,
  TranslationTask
} from "@/types/feedback";

type SessionScopedInput = {
  sessionId: string;
  accessTokenHash: string;
};

type TaskBundleRpcRow = {
  task: unknown | null;
  feedback: unknown | null;
  job: unknown | null;
};

type ResultBundleRpcRow = {
  session: unknown;
  task1: unknown;
  task2: unknown;
  feedback1: unknown;
  feedback2: unknown;
};

function rpcErrorMessage(prefix: string, message: string) {
  return `${prefix}: ${message}`;
}

function castNullable<T>(value: unknown | null | undefined): T | null {
  return value == null ? null : (value as T);
}

export async function createStudentSessionRecord(input: {
  firstName: string;
  lastName: string;
  accessTokenHash: string;
}) {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .rpc("create_student_session", {
      p_first_name: input.firstName,
      p_last_name: input.lastName,
      p_access_token_hash: input.accessTokenHash
    })
    .single();

  if (error) {
    throw new Error(rpcErrorMessage("Oturum oluşturulamadı", error.message));
  }
  return data as StudentSession;
}

export async function verifyStudentSessionAccess(input: SessionScopedInput) {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .rpc("verify_student_session_access", {
      p_session_id: input.sessionId,
      p_access_token_hash: input.accessTokenHash
    })
    .maybeSingle();

  if (error) {
    throw new Error(rpcErrorMessage("Oturum doğrulanamadı", error.message));
  }
  return data as StudentSession | null;
}

export async function getTasksForSession(input: SessionScopedInput) {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase.rpc("list_session_tasks", {
    p_session_id: input.sessionId,
    p_access_token_hash: input.accessTokenHash
  });

  if (error) {
    throw new Error(rpcErrorMessage("Çalışmalar okunamadı", error.message));
  }
  return (data ?? []) as TranslationTask[];
}

export async function getTaskBundle(input: SessionScopedInput & { taskNumber: 1 | 2 }): Promise<TaskBundle> {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .rpc("get_session_task_bundle", {
      p_session_id: input.sessionId,
      p_access_token_hash: input.accessTokenHash,
      p_task_number: input.taskNumber
    })
    .maybeSingle();

  if (error) {
    throw new Error(rpcErrorMessage("Çalışma okunamadı", error.message));
  }

  const row = data as TaskBundleRpcRow | null;
  if (!row) {
    return { task: null, feedback: null, job: null };
  }

  return {
    task: castNullable<TranslationTask>(row.task),
    feedback: castNullable<FeedbackRecord>(row.feedback),
    job: castNullable<ModelJobStatus>(row.job)
  };
}

export async function submitInitialTask(input: SessionScopedInput & {
  taskNumber: 1 | 2;
  sourceText: string;
  initialTranslation: string;
}) {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .rpc("submit_session_translation_task", {
      p_session_id: input.sessionId,
      p_access_token_hash: input.accessTokenHash,
      p_task_number: input.taskNumber,
      p_source_text: input.sourceText,
      p_initial_translation: input.initialTranslation
    })
    .single();

  if (error) {
    throw new Error(rpcErrorMessage("Çalışma gönderilemedi", error.message));
  }

  return data as TranslationTask;
}

export async function submitTaskRevision(input: SessionScopedInput & {
  taskNumber: 1 | 2;
  revisedTranslation: string;
}) {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .rpc("submit_session_task_revision", {
      p_session_id: input.sessionId,
      p_access_token_hash: input.accessTokenHash,
      p_task_number: input.taskNumber,
      p_revised_translation: input.revisedTranslation
    })
    .single();

  if (error) {
    throw new Error(rpcErrorMessage("Son çeviri kaydedilemedi", error.message));
  }

  return data as TranslationTask;
}

export async function retryFailedJob(input: SessionScopedInput & { taskNumber: 1 | 2 }) {
  const supabase = getSupabaseServiceClient();
  const { error } = await supabase.rpc("retry_failed_session_job", {
    p_session_id: input.sessionId,
    p_access_token_hash: input.accessTokenHash,
    p_task_number: input.taskNumber
  });

  if (error) {
    throw new Error(rpcErrorMessage("İş yeniden sıraya alınamadı", error.message));
  }
}

export async function getResultBundle(input: SessionScopedInput): Promise<ResultBundle | null> {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .rpc("get_session_result_bundle", {
      p_session_id: input.sessionId,
      p_access_token_hash: input.accessTokenHash
    })
    .maybeSingle();

  if (error) {
    throw new Error(rpcErrorMessage("Sonuç verileri okunamadı", error.message));
  }

  const row = data as ResultBundleRpcRow | null;
  if (!row) {
    return null;
  }

  return {
    session: row.session as StudentSession,
    task1: row.task1 as TranslationTask,
    task2: row.task2 as TranslationTask,
    feedback1: row.feedback1 as FeedbackRecord,
    feedback2: row.feedback2 as FeedbackRecord
  };
}
