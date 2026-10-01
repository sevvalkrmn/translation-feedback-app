import "server-only";

import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import { getTasksForSession, verifyStudentSessionAccess } from "@/lib/supabase/repository";
import { hashAccessToken, SESSION_COOKIE_NAME } from "@/lib/session/tokens";

export async function requireSessionAccess(sessionId: string) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const pepper = process.env.SESSION_TOKEN_PEPPER;

  if (!token || !pepper) {
    notFound();
  }

  const accessTokenHash = hashAccessToken(token, pepper);
  const session = await verifyStudentSessionAccess({ sessionId, accessTokenHash });
  if (!session) {
    notFound();
  }

  return { session, accessTokenHash };
}

export async function requireSessionWithTasks(sessionId: string) {
  const { session, accessTokenHash } = await requireSessionAccess(sessionId);
  const tasks = await getTasksForSession({ sessionId, accessTokenHash });
  return { session, accessTokenHash, tasks };
}
