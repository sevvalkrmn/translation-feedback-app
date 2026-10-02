"use server";

import { cookies } from "next/headers";
import { notFound, redirect, RedirectType } from "next/navigation";

import { requireSessionAccess } from "@/lib/session/access";
import { createAccessToken, hashAccessToken, SESSION_COOKIE_NAME, sessionCookieOptions } from "@/lib/session/tokens";
import {
  createStudentSessionRecord,
  retryFailedJob,
  submitInitialTask,
  submitTaskRevision
} from "@/lib/supabase/repository";
import { initialTaskSchema, revisionSchema, studentNameSchema, taskNumberSchema } from "@/lib/validation/schemas";
import { requireSessionWithTasks } from "@/lib/session/access";
import { canOpenResult } from "@/lib/workflow/rules";

function formValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "");
}

export async function startSessionAction(formData: FormData) {
  const parsed = studentNameSchema.parse({
    firstName: formValue(formData, "firstName"),
    lastName: formValue(formData, "lastName")
  });

  const token = createAccessToken();
  const pepper = process.env.SESSION_TOKEN_PEPPER;
  if (!pepper) {
    throw new Error("SESSION_TOKEN_PEPPER tanımlı değil.");
  }

  const session = await createStudentSessionRecord({
    firstName: parsed.firstName,
    lastName: parsed.lastName,
    accessTokenHash: hashAccessToken(token, pepper)
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    ...sessionCookieOptions(session.id),
    maxAge: 60 * 60 * 8
  });

  redirect(`/session/${session.id}/task/1`);
}

export async function submitInitialTaskAction(sessionId: string, taskNumberInput: number, formData: FormData) {
  const { accessTokenHash } = await requireSessionAccess(sessionId);
  const taskNumber = taskNumberSchema.parse(taskNumberInput);
  const parsed = initialTaskSchema.parse({
    sourceText: formValue(formData, "sourceText"),
    initialTranslation: formValue(formData, "initialTranslation")
  });

  await submitInitialTask({
    sessionId,
    accessTokenHash,
    taskNumber,
    sourceText: parsed.sourceText,
    initialTranslation: parsed.initialTranslation
  });

  redirect(`/session/${sessionId}/task/${taskNumber}`);
}

export async function submitRevisionAction(sessionId: string, taskNumberInput: number, formData: FormData) {
  const { accessTokenHash } = await requireSessionAccess(sessionId);
  const taskNumber = taskNumberSchema.parse(taskNumberInput);
  const parsed = revisionSchema.parse({
    revisedTranslation: formValue(formData, "revisedTranslation")
  });

  await submitTaskRevision({
    sessionId,
    accessTokenHash,
    taskNumber,
    revisedTranslation: parsed.revisedTranslation
  });

  if (taskNumber === 1) {
    redirect(`/session/${sessionId}/task/2`);
  }
  redirect(`/session/${sessionId}/result`);
}

export async function retryJobAction(sessionId: string, taskNumberInput: number) {
  const { accessTokenHash } = await requireSessionAccess(sessionId);
  const taskNumber = taskNumberSchema.parse(taskNumberInput);
  await retryFailedJob({ sessionId, accessTokenHash, taskNumber });
  redirect(`/session/${sessionId}/task/${taskNumber}`);
}

export async function finishSessionAction(sessionId: string) {
  const { session, tasks } = await requireSessionWithTasks(sessionId);
  if (session.status !== "completed" || !canOpenResult(tasks)) {
    notFound();
  }

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, "", {
    ...sessionCookieOptions(sessionId),
    maxAge: 0,
    expires: new Date(0)
  });
  redirect("/completed", RedirectType.replace);
}
