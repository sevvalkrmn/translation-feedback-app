import path from "node:path";

import { Document, Font, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import type { FeedbackRecord, ResultBundle, StructuredFeedback } from "@/types/feedback";

Font.register({ family: "DejaVu", src: path.join(process.cwd(), "public/fonts/DejaVuSans.ttf") });

const styles = StyleSheet.create({
  page: { padding: 32, fontFamily: "DejaVu", fontSize: 10, lineHeight: 1.45, color: "#172033" },
  title: { fontSize: 18, marginBottom: 8 },
  subtitle: { fontSize: 11, marginBottom: 18, color: "#475569" },
  section: { marginBottom: 16, paddingBottom: 12, borderBottom: "1 solid #d7dee8" },
  heading: { fontSize: 14, marginBottom: 8 },
  label: { fontSize: 9, color: "#0f766e", marginTop: 8, marginBottom: 2 },
  paragraph: { marginBottom: 4 },
  listItem: { marginBottom: 3 }
});

export function ReportDocument({ data }: { data: ResultBundle }) {
  const createdAt = new Intl.DateTimeFormat("tr-TR", { dateStyle: "long", timeStyle: "short" })
    .format(new Date(data.session.created_at));
  return (
    <Document title="Çeviri Geri Bildirim Raporu">
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Çeviri Geri Bildirim Raporu</Text>
        <Text style={styles.subtitle}>{data.session.first_name} {data.session.last_name} - {createdAt}</Text>
        <Text style={styles.heading}>Bölüm A - Çeviri gelişimi</Text>
        <TranslationProgress title="Çalışma 1" source={data.task1.source_text}
          initial={data.task1.initial_translation} revised={data.task1.revised_translation ?? ""} />
        <TranslationProgress title="Çalışma 2" source={data.task2.source_text}
          initial={data.task2.initial_translation} revised={data.task2.revised_translation ?? ""} />
        <Text style={styles.heading}>Bölüm B - Geri bildirim ayrıntıları</Text>
        <FeedbackDetails title="Çalışma 1" record={data.feedback1} />
        <FeedbackDetails title="Çalışma 2" record={data.feedback2} />
      </Page>
    </Document>
  );
}

function TranslationProgress({ title, source, initial, revised }: {
  title: string; source: string; initial: string; revised: string;
}) {
  return (
    <View style={styles.section} wrap={false}>
      <Text style={styles.heading}>{title}</Text>
      <Text style={styles.label}>Türkçe kaynak metin</Text><Text style={styles.paragraph}>{source}</Text>
      <Text style={styles.label}>İngilizce ilk çeviri</Text><Text style={styles.paragraph}>{initial}</Text>
      <Text style={styles.label}>İngilizce son çeviri</Text><Text style={styles.paragraph}>{revised}</Text>
    </View>
  );
}

function FeedbackDetails({ title, record }: { title: string; record: FeedbackRecord }) {
  const feedback = record.structured_output;
  const scores = feedback.evaluation.dimension_scores;
  return (
    <View style={styles.section}>
      <Text style={styles.heading}>{title} - {feedback.method === "llm" ? "Normal LLM" : "Karşı-olgusal XAI"}</Text>
      <Text style={styles.label}>Öğrenciye gösterilen geri bildirim</Text>
      <Text style={styles.paragraph}>{feedback.summary}</Text>
      <FeedbackIssues feedback={feedback} />
      <Text style={styles.label}>Model / checkpoint</Text><Text>{record.model_name}</Text>
      <Text style={styles.label}>Prompt / şema sürümü</Text>
      <Text>{feedback.evaluation.prompt_version} / {feedback.evaluation.schema_version}</Text>
      <Text style={styles.label}>İç değerlendirme puanları (kalibre edilmiş ölçüm değildir)</Text>
      <Text>Genel: {feedback.evaluation.overall_score}; Anlam: {scores.meaning_accuracy}; Eksiksizlik: {scores.completeness}; Dil bilgisi/akıcılık: {scores.grammar_fluency}; Terminoloji/üslup: {scores.terminology_register}</Text>
    </View>
  );
}

function FeedbackIssues({ feedback }: { feedback: StructuredFeedback }) {
  if (feedback.method === "llm") {
    return <View>{feedback.errors.map((error, index) => (
      <Text style={styles.listItem} key={index}>
        {error.category} ({error.severity}) - {error.translation_span}: {error.explanation} İpucu: {error.hint}
      </Text>
    ))}</View>;
  }
  return <View>{feedback.evidence_items.map((item, index) => (
    <Text style={styles.listItem} key={index}>
      {item.category} ({item.severity}, {item.verification.status}) - Kaynak: {item.source_span}; Çeviri: {item.translation_span}. {item.decision_explanation} İpucu: {item.student_hint}
    </Text>
  ))}</View>;
}
