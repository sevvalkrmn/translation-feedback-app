import path from "node:path";

import { Document, Font, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import type { LLMFeedbackResult, ResultBundle, XAIResult } from "@/types/feedback";

Font.register({
  family: "DejaVu",
  src: path.join(process.cwd(), "public/fonts/DejaVuSans.ttf")
});

const styles = StyleSheet.create({
  page: {
    padding: 32,
    fontFamily: "DejaVu",
    fontSize: 10,
    lineHeight: 1.45,
    color: "#172033"
  },
  title: {
    fontSize: 18,
    marginBottom: 8
  },
  subtitle: {
    fontSize: 11,
    marginBottom: 18,
    color: "#475569"
  },
  section: {
    marginBottom: 16,
    paddingBottom: 12,
    borderBottom: "1 solid #d7dee8"
  },
  heading: {
    fontSize: 14,
    marginBottom: 8
  },
  label: {
    fontSize: 9,
    color: "#0f766e",
    marginTop: 8,
    marginBottom: 2
  },
  paragraph: {
    marginBottom: 4
  },
  listItem: {
    marginBottom: 3
  }
});

export function ReportDocument({ data }: { data: ResultBundle }) {
  const createdAt = new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "long",
    timeStyle: "short"
  }).format(new Date(data.session.created_at));

  return (
    <Document title="Çeviri Geri Bildirim Raporu">
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Çeviri Geri Bildirim Raporu</Text>
        <Text style={styles.subtitle}>
          {data.session.first_name} {data.session.last_name} - {createdAt}
        </Text>

        <TaskSection
          methodLabel="Yöntem A"
          source={data.task1.source_text}
          initial={data.task1.initial_translation}
          revised={data.task1.revised_translation ?? ""}
          feedback={data.feedback1.structured_output as LLMFeedbackResult}
        />
        <TaskSection
          methodLabel="Yöntem B"
          source={data.task2.source_text}
          initial={data.task2.initial_translation}
          revised={data.task2.revised_translation ?? ""}
          feedback={data.feedback2.structured_output as XAIResult}
        />
      </Page>
    </Document>
  );
}

function TaskSection({
  methodLabel,
  source,
  initial,
  revised,
  feedback
}: {
  methodLabel: string;
  source: string;
  initial: string;
  revised: string;
  feedback: LLMFeedbackResult | XAIResult;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.heading}>{methodLabel}</Text>
      <Text style={styles.label}>Türkçe kaynak metin</Text>
      <Text style={styles.paragraph}>{source}</Text>
      <Text style={styles.label}>İngilizce ilk çeviri</Text>
      <Text style={styles.paragraph}>{initial}</Text>
      <Text style={styles.label}>Geri bildirim</Text>
      <FeedbackSummary feedback={feedback} />
      <Text style={styles.label}>İngilizce son çeviri</Text>
      <Text style={styles.paragraph}>{revised}</Text>
    </View>
  );
}

function FeedbackSummary({ feedback }: { feedback: LLMFeedbackResult | XAIResult }) {
  if ("revision_guidance" in feedback) {
    return (
      <View>
        <Text style={styles.paragraph}>{feedback.summary}</Text>
        {feedback.errors.map((error) => (
          <Text style={styles.listItem} key={`${error.target_span}-${error.category}`}>
            - {error.target_span}: {error.explanation} İpucu: {error.hint}
          </Text>
        ))}
        {feedback.revision_guidance.map((item) => (
          <Text style={styles.listItem} key={item}>
            - {item}
          </Text>
        ))}
      </View>
    );
  }

  return (
    <View>
      <Text style={styles.paragraph}>{feedback.summary}</Text>
      {feedback.errors.map((error) => (
        <Text style={styles.listItem} key={`${error.target_start}-${error.target_end}`}>
          - {error.target_span}: {error.explanation} İpucu: {error.hint}
        </Text>
      ))}
    </View>
  );
}
