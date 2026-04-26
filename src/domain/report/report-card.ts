import { z } from "zod";

import { ConfidenceSchema } from "../shared/confidence";
import { EvidenceReferenceSchema } from "../shared/evidence-reference";

export const ReportCardSchemaVersion = "report-card.v1";

export const RepositoryProviderSchema = z.enum([
  "github",
  "gitlab",
  "bitbucket",
  "local-fixture",
  "local-path",
  "unknown",
]);

export type RepositoryProvider = z.infer<typeof RepositoryProviderSchema>;

export const RepositoryIdentitySchema = z
  .object({
    provider: RepositoryProviderSchema,
    name: z.string().min(1),
    owner: z.string().min(1).optional(),
    url: z.url().optional(),
    revision: z.string().min(1).optional(),
    defaultBranch: z.string().min(1).optional(),
  })
  .strict();

export type RepositoryIdentity = z.infer<typeof RepositoryIdentitySchema>;

export const ProjectArchetypeSchema = z.enum([
  "web-app",
  "cli",
  "library",
  "service",
  "infrastructure",
  "docs-heavy",
  "research-notebook",
  "generated-sdk",
  "embedded",
  "unknown",
]);

export type ProjectArchetype = z.infer<typeof ProjectArchetypeSchema>;

export const ReportDimensionKeySchema = z.enum([
  "architecture-boundaries",
  "maintainability",
  "verifiability",
  "security",
  "operability",
  "documentation",
]);

export type ReportDimensionKey = z.infer<typeof ReportDimensionKeySchema>;

export const ReportRatingSchema = z.enum([
  "excellent",
  "good",
  "fair",
  "weak",
  "poor",
  "not-assessed",
]);

export type ReportRating = z.infer<typeof ReportRatingSchema>;

export const FindingSeveritySchema = z.enum([
  "info",
  "low",
  "medium",
  "high",
  "critical",
]);

export type FindingSeverity = z.infer<typeof FindingSeveritySchema>;

export const ReviewerKindSchema = z.enum(["fake", "human", "llm", "automated"]);

export type ReviewerKind = z.infer<typeof ReviewerKindSchema>;

export const ReviewerMetadataSchema = z
  .object({
    kind: ReviewerKindSchema,
    name: z.string().min(1),
    reviewerVersion: z.string().min(1).optional(),
    modelProvider: z.string().min(1).optional(),
    modelName: z.string().min(1).optional(),
    modelVersion: z.string().min(1).optional(),
    reviewedAt: z.iso.datetime({ offset: true }),
  })
  .strict()
  .refine(
    (metadata) =>
      metadata.kind !== "llm" ||
      (metadata.modelProvider !== undefined &&
        metadata.modelName !== undefined),
    {
      message: "LLM reviewer metadata must include modelProvider and modelName",
      path: ["modelName"],
    },
  );

export type ReviewerMetadata = z.infer<typeof ReviewerMetadataSchema>;

export const ReportFindingSchema = z
  .object({
    id: z.string().min(1),
    dimension: ReportDimensionKeySchema,
    severity: FindingSeveritySchema,
    title: z.string().min(1),
    summary: z.string().min(1),
    confidence: ConfidenceSchema,
    evidenceReferences: z.array(EvidenceReferenceSchema).min(1),
  })
  .strict();

export type ReportFinding = z.infer<typeof ReportFindingSchema>;

export const ReportCaveatSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    summary: z.string().min(1),
    affectedDimensions: z.array(ReportDimensionKeySchema).min(1),
    missingEvidence: z.array(z.string().min(1)).default([]),
  })
  .strict();

export type ReportCaveat = z.infer<typeof ReportCaveatSchema>;

export const DimensionAssessmentSchema = z
  .object({
    dimension: ReportDimensionKeySchema,
    title: z.string().min(1),
    summary: z.string().min(1),
    rating: ReportRatingSchema,
    score: z.number().min(0).max(100).optional(),
    confidence: ConfidenceSchema,
    evidenceReferences: z.array(EvidenceReferenceSchema).min(1),
    findings: z.array(ReportFindingSchema).default([]),
    caveatIds: z.array(z.string().min(1)).default([]),
  })
  .strict();

export type DimensionAssessment = z.infer<typeof DimensionAssessmentSchema>;

export const RecommendedQuestionSchema = z
  .object({
    id: z.string().min(1),
    question: z.string().min(1),
    targetDimension: ReportDimensionKeySchema.optional(),
    rationale: z.string().min(1),
  })
  .strict();

export type RecommendedQuestion = z.infer<typeof RecommendedQuestionSchema>;

export const ReportCardInputSchema = z
  .object({
    repository: RepositoryIdentitySchema,
    assessedArchetype: ProjectArchetypeSchema,
    reviewerMetadata: ReviewerMetadataSchema,
    evidenceReferences: z.array(EvidenceReferenceSchema).default([]),
    dimensionAssessments: z.array(DimensionAssessmentSchema).min(1),
    caveats: z.array(ReportCaveatSchema).default([]),
    recommendedNextQuestions: z.array(RecommendedQuestionSchema).default([]),
  })
  .strict();

export type ReportCardInput = z.infer<typeof ReportCardInputSchema>;

export const ReportCardSchema = ReportCardInputSchema.extend({
  id: z.string().min(1),
  schemaVersion: z.literal(ReportCardSchemaVersion),
  generatedAt: z.iso.datetime({ offset: true }),
  scoringPolicy: z
    .object({
      name: z.string().min(1),
      version: z.string().min(1),
    })
    .strict(),
}).strict();

export type ReportCard = z.infer<typeof ReportCardSchema>;
