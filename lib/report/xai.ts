import type { Severity, XaiEvidenceItem } from "@/types/feedback";

export interface HighlightSegment {
  text: string;
  severity?: Severity;
}

export function validateXaiSpan(text: string, span: string) {
  if (!span) return false;
  const first = text.indexOf(span);
  return first >= 0 && text.indexOf(span, first + 1) < 0;
}

export function buildHighlightSegments(text: string, evidence: XaiEvidenceItem[]): HighlightSegment[] {
  const matches = evidence
    .filter((item) => validateXaiSpan(text, item.translation_span))
    .map((item) => ({
      start: text.indexOf(item.translation_span),
      end: text.indexOf(item.translation_span) + item.translation_span.length,
      severity: item.severity
    }))
    .sort((left, right) => left.start - right.start);
  const segments: HighlightSegment[] = [];
  let cursor = 0;
  for (const match of matches) {
    if (match.start < cursor) continue;
    if (match.start > cursor) segments.push({ text: text.slice(cursor, match.start) });
    segments.push({ text: text.slice(match.start, match.end), severity: match.severity });
    cursor = match.end;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor) });
  return segments.length ? segments : [{ text }];
}
