import { notFound, redirect } from "next/navigation";

import { renderReport } from "@/lib/report/render";
import { requireSessionWithTasks } from "@/lib/session/access";
import { getResultBundle } from "@/lib/supabase/repository";
import { canOpenResult } from "@/lib/workflow/rules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(_request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const { accessTokenHash, tasks } = await requireSessionWithTasks(sessionId);

  if (!canOpenResult(tasks)) {
    redirect(`/session/${sessionId}/task/1`);
  }

  const result = await getResultBundle({ sessionId, accessTokenHash });
  if (!result) {
    notFound();
  }

  const pdfBuffer = await renderReport(result);
  return new Response(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="ceviri-raporu-${sessionId}.pdf"`,
      "Cache-Control": "private, no-store, max-age=0"
    }
  });
}
