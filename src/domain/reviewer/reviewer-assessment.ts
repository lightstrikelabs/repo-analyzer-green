import { z } from "zod";

import {
  ProjectArchetypeSchema,
  ReportDimensionKeySchema,
  ReviewerMetadataSchema,
} from "../report/report-card";
import { ConfidenceSchema } from "../shared/confidence";
import { EvidenceReferenceSchema } from "../shared/evidence-reference";

export const ReviewerAssessmentSchemaVersion = "reviewer-assessment.v1";

export const ReviewerArchetypeAssessmentSchema = z
  .object({
    value: ProjectArchetypeSchema,
    confidence: ConfidenceSchema,
    evidenceReferences: z.array(EvidenceReferenceSchema).default([]),
    rationale: z.string().min(1),
  })
  .strict();

export type ReviewerArchetypeAssessment = z.infer<
  typeof ReviewerArchetypeAssessmentSchema
>;

export const ReviewerDimensionAssessmentSchema = z
  .object({
    dimension: ReportDimensionKeySchema,
    summary: z.string().min(1),
    confidence: ConfidenceSchema,
    evidenceReferences: z.array(EvidenceReferenceSchema).default([]),
    strengths: z.array(z.string().min(1)).default([]),
    risks: z.array(z.string().min(1)).default([]),
    missingEvidence: z.array(z.string().min(1)).default([]),
  })
  .strict();

export type ReviewerDimensionAssessment = z.infer<
  typeof ReviewerDimensionAssessmentSchema
>;

export const ReviewerCaveatSchema = z
  .object({
    id: z.string().min(1),
    summary: z.string().min(1),
    affectedDimensions: z.array(ReportDimensionKeySchema).min(1),
    missingEvidence: z.array(z.string().min(1)).default([]),
    confidence: ConfidenceSchema,
    evidenceReferences: z.array(EvidenceReferenceSchema).default([]),
  })
  .strict();

export type ReviewerCaveat = z.infer<typeof ReviewerCaveatSchema>;

export const ReviewerFollowUpQuestionSchema = z
  .object({
    id: z.string().min(1),
    question: z.string().min(1),
    targetDimension: ReportDimensionKeySchema.optional(),
    rationale: z.string().min(1),
  })
  .strict();

export type ReviewerFollowUpQuestion = z.infer<
  typeof ReviewerFollowUpQuestionSchema
>;

export const ReviewerAssessmentSchema = z
  .object({
    schemaVersion: z.literal(ReviewerAssessmentSchemaVersion),
    reviewer: ReviewerMetadataSchema,
    assessedArchetype: ReviewerArchetypeAssessmentSchema,
    dimensions: z.array(ReviewerDimensionAssessmentSchema).min(1),
    caveats: z.array(ReviewerCaveatSchema).default([]),
    followUpQuestions: z.array(ReviewerFollowUpQuestionSchema).default([]),
  })
  .strict();

export type ReviewerAssessment = z.infer<typeof ReviewerAssessmentSchema>;
