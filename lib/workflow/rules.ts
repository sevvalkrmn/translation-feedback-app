import type { TranslationTask } from "@/types/feedback";

export function methodForTask(taskNumber: 1 | 2) {
  return taskNumber === 1 ? "llm" : "xai";
}

export function jobTypeForTask(taskNumber: 1 | 2) {
  return taskNumber === 1 ? "llm_feedback" : "xai_feedback";
}

export function canOpenTask(taskNumber: 1 | 2, tasks: TranslationTask[]): boolean {
  if (taskNumber === 1) {
    return true;
  }
  const task1 = tasks.find((task) => task.task_number === 1);
  return task1?.status === "revised";
}

export function canOpenResult(tasks: TranslationTask[]): boolean {
  const task1 = tasks.find((task) => task.task_number === 1);
  const task2 = tasks.find((task) => task.task_number === 2);
  return task1?.status === "revised" && task2?.status === "revised";
}

export function canEditInitialTask(task: TranslationTask | null): boolean {
  return task === null || task.status === "draft";
}

export function canSubmitRevision(task: TranslationTask | null): boolean {
  return task?.status === "feedback_ready";
}
