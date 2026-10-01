import "server-only";

import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import { getStudentSession, getTasksForSession } from "@/lib/supabase/repository";
import { constantTimeEquals, hashAccessToken, SESSION_COOKIE_NAME } from "@/lib/session/tokens";

export async function requireSessionAccess(sessionId: string) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const pepper = process.env.SESSION_TOKEN_PEPPER;

  if (!token || !pepper) {
    notFound();
  }

  const session = await getStudentSession(sessionId);
  if (!session) {
    notFound();
  }

  const tokenHash = hashAccessToken(token, pepper);
  if (!constantTimeEquals(tokenHash, session.access_token_hash)) {
    notFound();
  }

  return session;
}

export async function requireSessionWithTasks(sessionId: string) {
  const session = await requireSessionAccess(sessionId);
  const tasks = await getTasksForSession(sessionId);
  return { session, tasks };
}
