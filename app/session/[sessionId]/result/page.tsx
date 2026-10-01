import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { FeedbackView } from "@/components/FeedbackView";
import { LockedText } from "@/components/LockedText";
import { PageHeader } from "@/components/PageHeader";
import { requireSessionWithTasks } from "@/lib/session/access";
import { getResultBundle } from "@/lib/supabase/repository";
import { canOpenResult } from "@/lib/workflow/rules";

export const runtime = "nodejs";

export default async function ResultPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const { session, accessTokenHash, tasks } = await requireSessionWithTasks(sessionId);

  if (!canOpenResult(tasks)) {
    const task1 = tasks.find((task) => task.task_number === 1);
    redirect(task1?.status === "revised" ? `/session/${sessionId}/task/2` : `/session/${sessionId}/task/1`);
  }

  const result = await getResultBundle({ sessionId, accessTokenHash });
  if (!result) {
    notFound();
  }

  return (
    <div>
      <PageHeader
        title="Sonuç ve rapor"
        description={`${session.first_name} ${session.last_name} için tamamlanan iki çalışmanın özeti.`}
        backHref={`/session/${sessionId}/task/2`}
      />

      <div className="mb-6 flex flex-wrap gap-3">
        <Link
          className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white"
          href={`/session/${sessionId}/result/report`}
        >
          PDF indir
        </Link>
      </div>

      <section className="grid gap-8">
        <TaskResultBlock
          title="Çalışma 1"
          source={result.task1.source_text}
          initial={result.task1.initial_translation}
          revised={result.task1.revised_translation ?? ""}
          feedback={result.feedback1}
        />
        <TaskResultBlock
          title="Çalışma 2"
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
  source,
  initial,
  revised,
  feedback
}: {
  title: string;
  source: string;
  initial: string;
  revised: string;
  feedback: NonNullable<Awaited<ReturnType<typeof getResultBundle>>>["feedback1"];
}) {
  return (
    <article className="grid gap-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-2xl font-semibold text-slate-950">{title}</h2>
      <div className="grid gap-4 md:grid-cols-2">
        <LockedText label="Türkçe kaynak metin" value={source} />
        <LockedText label="İngilizce ilk çeviri" value={initial} />
      </div>
      <FeedbackView feedback={feedback} initialTranslation={initial} />
      <LockedText label="İngilizce son çeviri" value={revised} />
    </article>
  );
}
