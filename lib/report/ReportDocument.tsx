import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import { evidenceText, modelSentence, studentSummary, verificationText, visibleIssues } from "@/lib/feedback/presentation";
import type { ErrorCategory, FeedbackRecord, ResultBundle, Severity, StructuredFeedback } from "@/types/feedback";

const categories: Record<ErrorCategory, string> = {
  meaning_shift: "Anlam kayması", omission: "Eksik bilgi", addition: "Eklenen bilgi",
  terminology: "Terminoloji", grammar: "Dil bilgisi", fluency: "Akıcılık",
  register_style: "Üslup", cohesion: "Bağlaşıklık"
};
const severities: Record<Severity, string> = {
  minor: "Düşük önem", major: "Önemli", critical: "Kritik"
};

const styles = StyleSheet.create({
  page: { paddingTop: 38, paddingBottom: 46, paddingHorizontal: 42, fontFamily: "DejaVu", fontSize: 10, lineHeight: 1.55, color: "#172033" },
  eyebrow: { fontSize: 9, color: "#0f766e", marginBottom: 5 },
  title: { fontSize: 19, marginBottom: 7 },
  subtitle: { fontSize: 9, color: "#475569", marginBottom: 20 },
  sectionTitle: { fontSize: 14, marginBottom: 14, paddingBottom: 7, borderBottomWidth: 1, borderBottomColor: "#94a3b8" },
  taskTitle: { fontSize: 12, marginTop: 12, marginBottom: 7, color: "#0f766e" },
  label: { fontSize: 9, color: "#475569", marginBottom: 2 },
  paragraph: { fontSize: 10, lineHeight: 1.55 },
  paragraphLast: { marginBottom: 9 },
  issue: { marginTop: 9, paddingLeft: 10, borderLeftWidth: 2, borderLeftColor: "#d97706" },
  issueTitle: { fontSize: 10, marginBottom: 3 },
  metadata: { marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: "#d7dee8" },
  footer: { position: "absolute", left: 42, right: 42, bottom: 23, fontSize: 8, color: "#64748b", textAlign: "right" }
});

function Footer() {
  return <Text fixed style={styles.footer}>Çeviri Geri Bildirim Raporu</Text>;
}

export function ReportDocument({ data }: { data: ResultBundle }) {
  const createdAt = new Intl.DateTimeFormat("tr-TR", { dateStyle: "long", timeStyle: "short" })
    .format(new Date(data.session.created_at));
  return (
    <Document title="Çeviri Geri Bildirim Raporu">
      <Page size="A4" style={styles.page} wrap>
        <Text style={styles.eyebrow}>ÇEVİRİ ÇALIŞMASI</Text>
        <Text style={styles.title}>Çeviri Geri Bildirim Raporu</Text>
        <Text style={styles.subtitle}>{data.session.first_name} {data.session.last_name} · {createdAt}</Text>
        <Text style={styles.sectionTitle} minPresenceAhead={40}>Bölüm A - Çeviri gelişimi</Text>
        <TranslationProgress title="İlk metin" source={data.task1.source_text}
          initial={data.task1.initial_translation} revised={data.task1.revised_translation ?? ""} />
        <TranslationProgress title="İkinci metin" source={data.task2.source_text}
          initial={data.task2.initial_translation} revised={data.task2.revised_translation ?? ""} />
        <Text style={styles.sectionTitle} minPresenceAhead={40}>Bölüm B - Geri bildirim ayrıntıları</Text>
        <FeedbackDetails title="İlk metin" record={data.feedback1} minSpace={200} />
        <FeedbackDetails title="İkinci metin" record={data.feedback2} minSpace={500} />
        <Footer />
      </Page>
    </Document>
  );
}

function ReportField({ label, value }: { label: string; value: string }) {
  const lines = wrapText(value);
  return <>
    <Text style={styles.label} minPresenceAhead={18}>{label}</Text>
    {lines.map((line, index) => <Text key={index} style={[styles.paragraph, index === lines.length - 1 ? styles.paragraphLast : {}]}>{line}</Text>)}
  </>;
}

function wrapText(value: string): string[] {
  const lines: string[] = [];
  const remaining = Array.from(value);
  while (remaining.length > 65) {
    const boundary = remaining.lastIndexOf(" ", 65);
    const end = boundary > 30 ? boundary + 1 : 65;
    lines.push(remaining.splice(0, end).join(""));
  }
  lines.push(remaining.join(""));
  return lines;
}

function TranslationProgress({ title, source, initial, revised }: {
  title: string; source: string; initial: string; revised: string;
}) {
  return (
    <>
      <Text style={styles.taskTitle} minPresenceAhead={35}>{title}</Text>
      <ReportField label="Türkçe kaynak metin" value={source} />
      <ReportField label="İlk İngilizce çeviri" value={initial} />
      <ReportField label="Revize İngilizce çeviri" value={revised} />
    </>
  );
}

function FeedbackDetails({ title, record, minSpace }: { title: string; record: FeedbackRecord; minSpace: number }) {
  const feedback = record.structured_output;
  const scores = feedback.evaluation.dimension_scores;
  return (
    <>
      <Text style={styles.taskTitle} minPresenceAhead={minSpace}>{title} · {feedback.method === "llm" ? "Genel geri bildirim" : "Açıklamalı geri bildirim"}</Text>
      <ReportField label="Öğrenciye gösterilen özet" value={studentSummary(feedback)} />
      <View style={styles.metadata} wrap={false}>
        <ReportField label="Model / checkpoint" value={record.model_name} />
        <ReportField label="Prompt / şema sürümü" value={`${feedback.evaluation.prompt_version} / ${feedback.evaluation.schema_version}`} />
        <ReportField label="İç değerlendirme puanları (kalibre edilmiş ölçüm değildir)"
          value={`Genel: ${feedback.evaluation.overall_score}; Anlam: ${scores.meaning_accuracy}; Eksiksizlik: ${scores.completeness}; Dil bilgisi/akıcılık: ${scores.grammar_fluency}; Terminoloji/üslup: ${scores.terminology_register}`} />
      </View>
      <FeedbackIssues feedback={feedback} />
    </>
  );
}

function FeedbackIssues({ feedback }: { feedback: StructuredFeedback }) {
  if (feedback.method === "llm") {
    return <View>{visibleIssues(feedback).map((error, index) => (
      <View style={styles.issue} key={index} wrap={false}>
        <Text style={styles.issueTitle} minPresenceAhead={22}>{categories[error.category]} · {severities[error.severity]}</Text>
        <ReportField label="İşaretlenen ifade" value={error.translation_span} />
        <ReportField label="Kaynak dayanak" value={error.source_span} />
        {modelSentence(error.explanation) && <ReportField label="Saptanan sorun" value={modelSentence(error.explanation)} />}
        {modelSentence(error.hint) && <ReportField label="Revizyon ipucu" value={modelSentence(error.hint)} />}
      </View>
    ))}</View>;
  }
  return <View>{visibleIssues(feedback).map((item, index) => {
    const detail = evidenceText(feedback, item);
    return <View key={index} style={styles.issue} wrap={false}>
      <Text style={styles.issueTitle} minPresenceAhead={22}>{categories[item.category]} · {severities[item.severity]}</Text>
      <ReportField label="İşaretlenen ifade" value={item.translation_span} />
      <ReportField label="Kaynak dayanak" value={item.source_span} />
      {detail.sourceMeaning && <ReportField label="Kaynak anlam" value={detail.sourceMeaning} />}
      {detail.problem && <ReportField label="Saptanan sorun" value={detail.problem} />}
      <ReportField label="Kontrol sonucu" value={verificationText(item)} />
      {modelSentence(item.student_hint) && <ReportField label="Revizyon ipucu" value={modelSentence(item.student_hint)} />}
    </View>;
  })}</View>;
}
