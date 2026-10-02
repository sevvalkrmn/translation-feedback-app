import { notFound, redirect } from "next/navigation";

import { FeedbackView } from "@/components/FeedbackView";
import { LockedText } from "@/components/LockedText";
import { PageHeader } from "@/components/PageHeader";
import { ResultActions } from "@/components/ResultActions";
import { StudyProgress } from "@/components/StudyProgress";
import { requireSessionWithTasks } from "@/lib/session/access";
import { getResultBundle } from "@/lib/supabase/repository";
import { canOpenResult } from "@/lib/workflow/rules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ResultPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const { session, accessTokenHash, tasks } = await requireSessionWithTasks(sessionId);

  if (!canOpenResult(tasks)) {
    const task1 = tasks.find((task) => task.task_number === 1);
    redirect(task1?.status === "revised" ? `/session/${sessionId}/task/2` : `/session/${sessionId}/task/1`);
  }
  if (session.status !== "completed") {
    notFound();
  }

  const result = await getResultBundle({ sessionId, accessTokenHash });
  if (!result) {
    notFound();
  }

  return (
    <div>
      <StudyProgress stage={7} />
      <PageHeader
        title="Çalışmanızın sonuçları"
        description={`${session.first_name} ${session.last_name}, iki metindeki ilk ve son çevirilerinizi geri bildirimlerle birlikte inceleyebilirsiniz.`}
        backHref={`/session/${sessionId}/task/2`}
      />

      <ResultActions sessionId={sessionId} />

      <section className="grid gap-10">
        <TaskResultBlock
          title="İlk metin"
          method="Genel geri bildirim"
          source={result.task1.source_text}
          initial={result.task1.initial_translation}
          revised={result.task1.revised_translation ?? ""}
          feedback={result.feedback1}
        />
        <TaskResultBlock
          title="İkinci metin"
          method="Açıklamalı geri bildirim"
          source={result.task2.source_text}
          initial={result.task2.initial_translation}
          revised={result.task2.revised_translation ?? ""}
          feedback={result.feedback2}
        />
      </section>
    </div>
  );
}

function TaskResultBlock({
  title,
  method,
  source,
  initial,
  revised,
  feedback
}: {
  title: string;
  method: string;
  source: string;
  initial: string;
  revised: string;
  feedback: NonNullable<Awaited<ReturnType<typeof getResultBundle>>>["feedback1"];
}) {
  return (
    <article className="grid gap-5 border-t-2 border-slate-300 pt-7">
      <div>
        <p className="text-xs font-bold uppercase text-teal-800">{method}</p>
        <h2 className="mt-1 text-xl font-semibold text-slate-950">{title}</h2>
      </div>
      <LockedText label="Türkçe kaynak metin" value={source} />
      <LockedText label="İngilizce ilk çeviri" value={initial} />
      <FeedbackView feedback={feedback} initialTranslation={initial} />
      <LockedText label="Geri bildirim sonrası İngilizce çeviri" value={revised} />
    </article>
  );
}
