import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { FeedbackView } from "@/components/FeedbackView";
import { InitialTaskForm } from "@/components/InitialTaskForm";
import { JobStatus } from "@/components/JobStatus";
import { LockedText } from "@/components/LockedText";
import { PageHeader } from "@/components/PageHeader";
import { RevisionForm } from "@/components/RevisionForm";
import { StudyProgress, type StudyStage } from "@/components/StudyProgress";
import { requireSessionWithTasks } from "@/lib/session/access";
import { getTaskBundle } from "@/lib/supabase/repository";
import { canOpenTask } from "@/lib/workflow/rules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function TaskPage({
  params
}: {
  params: Promise<{ sessionId: string; taskNumber: string }>;
}) {
  const { sessionId, taskNumber: taskNumberParam } = await params;
  const numericTask = Number(taskNumberParam);
  if (numericTask !== 1 && numericTask !== 2) {
    notFound();
  }
  const taskNumber = numericTask as 1 | 2;
  const { accessTokenHash, tasks } = await requireSessionWithTasks(sessionId);

  if (!canOpenTask(taskNumber, tasks)) {
    redirect(`/session/${sessionId}/task/1`);
  }

  const bundle = await getTaskBundle({ sessionId, accessTokenHash, taskNumber });
  const stage = (taskNumber === 1
    ? !bundle.task ? 1 : !bundle.feedback ? 2 : 3
    : !bundle.task ? 4 : !bundle.feedback ? 5 : 6) as StudyStage;
  const title = taskNumber === 1 ? "İlk metin" : "İkinci metin";
  const description = !bundle.task
    ? "Türkçe kaynak metni ve kendi İngilizce çevirinizi girin."
    : !bundle.feedback
      ? "İlk çeviriniz kaydedildi."
      : bundle.task.status === "revised"
        ? "Son çeviriniz kaydedildi. Bir sonraki adıma geçebilirsiniz."
        : "Geri bildirimi okuyun, ardından çevirinizi yeniden düzenleyin.";

  return (
    <div>
      <StudyProgress stage={stage} />
      <PageHeader
        title={title}
        description={description}
        backHref={taskNumber === 2 ? `/session/${sessionId}/task/1` : undefined}
      />

      {!bundle.task ? (
        <InitialTaskForm sessionId={sessionId} taskNumber={taskNumber} />
      ) : (
        <div className="grid gap-7">
          <div className="grid gap-4 md:grid-cols-2">
            <LockedText label="Türkçe kaynak metin" value={bundle.task.source_text} />
            <LockedText label="İngilizce ilk çeviri" value={bundle.task.initial_translation} />
          </div>

          {!bundle.feedback ? (
            <JobStatus sessionId={sessionId} taskNumber={taskNumber} initialJob={bundle.job} />
          ) : (
            <>
              <FeedbackView feedback={bundle.feedback} initialTranslation={bundle.task.initial_translation} />
              {bundle.task.status === "feedback_ready" ? (
                <RevisionForm sessionId={sessionId} taskNumber={taskNumber} />
              ) : (
                <section className="border-t border-teal-300 bg-teal-50 px-4 py-5">
                  <h2 className="text-lg font-semibold text-teal-950">Son çeviriniz kaydedildi</h2>
                  <p className="mt-3 text-xs font-bold uppercase text-teal-900">Düzenlenmiş İngilizce çeviriniz</p>
                  <p className="mt-2 whitespace-pre-wrap break-words leading-7 text-teal-950">{bundle.task.revised_translation}</p>
                  <div className="mt-4">
                    {taskNumber === 1 ? (
                      <Link
                        className="action-button action-button-primary"
                        href={`/session/${sessionId}/task/2`}
                      >
                        İkinci Metne Geç
                      </Link>
                    ) : (
                      <Link
                        className="action-button action-button-primary"
                        href={`/session/${sessionId}/result`}
                      >
                        Sonuçları Gör
                      </Link>
                    )}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
