import { z } from "zod";

export const ConfidenceLevelSchema = z.enum(["low", "medium", "high"]);

export type ConfidenceLevel = z.infer<typeof ConfidenceLevelSchema>;

export const ConfidenceSchema = z
  .object({
    level: ConfidenceLevelSchema,
    score: z.number().min(0).max(1),
    rationale: z.string().min(1),
  })
  .strict();

export type Confidence = z.infer<typeof ConfidenceSchema>;
