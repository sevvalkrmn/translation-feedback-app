import { z } from "zod";

export const studentNameSchema = z.object({
  firstName: z.string().trim().min(1, "Ad zorunludur.").max(80),
  lastName: z.string().trim().min(1, "Soyad zorunludur.").max(80)
});

export const taskNumberSchema = z.union([z.literal(1), z.literal(2)]);

export const initialTaskSchema = z.object({
  sourceText: z.string().trim().min(20, "Kaynak metin en az 20 karakter olmalıdır.").max(6000),
  initialTranslation: z
    .string()
    .trim()
    .min(20, "İlk çeviri en az 20 karakter olmalıdır.")
    .max(6000)
});

export const revisionSchema = z.object({
  revisedTranslation: z
    .string()
    .trim()
    .min(20, "Son çeviri en az 20 karakter olmalıdır.")
    .max(6000)
});

export const severitySchema = z.enum(["minor", "major", "critical"]);

export const xaiErrorSchema = z
  .object({
    target_span: z.string().min(1),
    target_start: z.number().int().min(0),
    target_end: z.number().int().min(0),
    source_span: z.string().min(1),
    severity: severitySchema,
    confidence: z.number().min(0).max(1),
    category: z.string().min(1),
    explanation: z.string().min(1),
    hint: z.string().min(1),
    detector_model: z.string().min(1),
    explainer_model: z.string().min(1)
  })
  .refine((value) => value.target_end > value.target_start, {
    message: "target_end, target_start değerinden büyük olmalıdır.",
    path: ["target_end"]
  });

export const xaiResultSchema = z.object({
  overall_score: z.number().min(0).max(1),
  summary: z.string().min(1),
  errors: z.array(xaiErrorSchema)
});

export const llmFeedbackErrorSchema = z.object({
  target_span: z.string().min(1),
  category: z.string().min(1),
  severity: severitySchema,
  explanation: z.string().min(1),
  hint: z.string().min(1)
});

export const llmFeedbackSchema = z.object({
  summary: z.string().min(1),
  strengths: z.array(z.string().min(1)),
  errors: z.array(llmFeedbackErrorSchema),
  revision_guidance: z.array(z.string().min(1))
});
