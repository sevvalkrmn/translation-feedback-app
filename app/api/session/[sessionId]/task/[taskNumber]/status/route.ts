import { NextResponse } from "next/server";

import { requireSessionAccess } from "@/lib/session/access";
import { getTaskBundle } from "@/lib/supabase/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const noStoreHeaders = { "Cache-Control": "private, no-store, max-age=0" };

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string; taskNumber: string }> }
) {
  const { sessionId, taskNumber: taskNumberParam } = await params;
  const numericTask = Number(taskNumberParam);
  if (numericTask !== 1 && numericTask !== 2) {
    return NextResponse.json({ error: "Geçersiz çalışma numarası." }, { status: 400, headers: noStoreHeaders });
  }

  const { accessTokenHash } = await requireSessionAccess(sessionId);
  const bundle = await getTaskBundle({ sessionId, accessTokenHash, taskNumber: numericTask as 1 | 2 });

  return NextResponse.json({
    taskStatus: bundle.task?.status ?? null,
    jobStatus: bundle.job?.status ?? null,
    hasFeedback: Boolean(bundle.feedback)
  }, { headers: noStoreHeaders });
}
