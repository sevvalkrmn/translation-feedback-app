import type { XAIError } from "@/types/feedback";

export interface HighlightSegment {
  text: string;
  severity?: XAIError["severity"];
  error?: XAIError;
}

export function validateXaiSpan(text: string, error: Pick<XAIError, "target_start" | "target_end" | "target_span">) {
  if (error.target_start < 0 || error.target_end <= error.target_start || error.target_end > text.length) {
    return false;
  }
  return text.slice(error.target_start, error.target_end) === error.target_span;
}

export function buildHighlightSegments(text: string, errors: XAIError[]): HighlightSegment[] {
  const validErrors = errors
    .filter((error) => validateXaiSpan(text, error))
    .sort((left, right) => left.target_start - right.target_start);

  const segments: HighlightSegment[] = [];
  let cursor = 0;

  for (const error of validErrors) {
    if (error.target_start < cursor) {
      continue;
    }
    if (error.target_start > cursor) {
      segments.push({ text: text.slice(cursor, error.target_start) });
    }
    segments.push({
      text: text.slice(error.target_start, error.target_end),
      severity: error.severity,
      error
    });
    cursor = error.target_end;
  }

  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor) });
  }

  return segments.length > 0 ? segments : [{ text }];
}
