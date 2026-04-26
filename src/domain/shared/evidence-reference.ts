import { z } from "zod";

export const EvidenceReferenceKindSchema = z.enum([
  "file",
  "collector",
  "reviewer",
  "derived",
]);

export type EvidenceReferenceKind = z.infer<typeof EvidenceReferenceKindSchema>;

export const EvidenceReferenceSchema = z
  .object({
    id: z.string().min(1),
    kind: EvidenceReferenceKindSchema,
    label: z.string().min(1),
    path: z.string().min(1).optional(),
    lineStart: z.number().int().positive().optional(),
    lineEnd: z.number().int().positive().optional(),
    notes: z.string().min(1).optional(),
  })
  .strict()
  .refine(
    (reference) =>
      reference.lineStart === undefined ||
      reference.lineEnd === undefined ||
      reference.lineEnd >= reference.lineStart,
    {
      message: "lineEnd must be greater than or equal to lineStart",
      path: ["lineEnd"],
    },
  );

export type EvidenceReference = z.infer<typeof EvidenceReferenceSchema>;
