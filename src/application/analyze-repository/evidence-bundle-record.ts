import { z } from "zod";

import { ConfidenceSchema } from "../../domain/shared/confidence";
import { EvidenceReferenceSchema } from "../../domain/shared/evidence-reference";
import {
  RepositoryIdentitySchema,
  type RepositoryIdentity,
  ProjectArchetypeSchema,
} from "../../domain/report/report-card";
import type { RepositoryEvidenceBundle } from "./analyze-repository";

export const EvidenceBundleRecordSchemaVersion = "evidence-bundle-record.v1";

const fileClassificationSignalSchema = z.enum([
  "configuration",
  "documentation",
  "lockfile",
  "manifest",
  "source",
  "test",
]);

const fileOmissionReasonSchema = z.enum([
  "binary",
  "generated",
  "ignored",
  "oversized",
  "vendor",
]);

const evidenceArtifactKindSchema = z.enum([
  "collector-output",
  "file-blob",
  "repository-snapshot",
]);

const evidenceArtifactProvenanceSchema = z
  .object({
    repository: RepositoryIdentitySchema,
    sourceKind: z.string().min(1),
    sourceId: z.string().min(1),
    path: z.string().min(1).optional(),
  })
  .strict();

export const EvidenceArtifactRecordSchema = z
  .object({
    id: z.string().min(1),
    kind: evidenceArtifactKindSchema,
    label: z.string().min(1),
    storageKey: z.string().min(1),
    byteSize: z.number().int().nonnegative().optional(),
    sha256: z.string().min(1).optional(),
    provenance: evidenceArtifactProvenanceSchema,
  })
  .strict();

export type EvidenceArtifactRecord = z.infer<
  typeof EvidenceArtifactRecordSchema
>;

const fileInventoryFileSchema = z
  .object({
    path: z.string().min(1),
    sizeBytes: z.number().int().nonnegative(),
    extension: z.string(),
    signals: z.array(fileClassificationSignalSchema),
  })
  .strict();

const fileInventoryOmissionSchema = z
  .object({
    path: z.string().min(1),
    sizeBytes: z.number().int().nonnegative(),
    reason: fileOmissionReasonSchema,
    detail: z.string().min(1),
  })
  .strict();

const fileInventorySchema = z
  .object({
    files: z.array(fileInventoryFileSchema),
    omissions: z.array(fileInventoryOmissionSchema),
  })
  .strict();

const projectArchetypeCandidateSchema = z
  .object({
    archetype: ProjectArchetypeSchema,
    confidence: ConfidenceSchema,
    evidenceReferences: z.array(EvidenceReferenceSchema),
    matchedSignals: z.array(z.string().min(1)),
  })
  .strict();

const projectArchetypeSignalResultSchema = z
  .object({
    primaryArchetype: ProjectArchetypeSchema,
    candidates: z.array(projectArchetypeCandidateSchema),
  })
  .strict();

const manifestPackageSignalSchema = z
  .object({
    kind: z.literal("package-json"),
    path: z.string().min(1),
    name: z.string().min(1).optional(),
    private: z.boolean().optional(),
    packageManager: z.string().min(1).optional(),
    main: z.string().min(1).optional(),
    module: z.string().min(1).optional(),
    types: z.string().min(1).optional(),
    exports: z.boolean().optional(),
    bin: z.boolean().optional(),
    evidenceReferences: z.array(EvidenceReferenceSchema),
  })
  .strict();

const manifestWorkflowOmissionSchema = z
  .object({
    path: z.string().min(1),
    reason: z.enum(["invalid-shape", "parse-error"]),
    detail: z.string().min(1),
    evidenceReferences: z.array(EvidenceReferenceSchema),
  })
  .strict();

const manifestWorkflowSignalResultSchema = z
  .object({
    packageManifests: z.array(manifestPackageSignalSchema),
    dependencySignals: z.array(z.object({}).passthrough()),
    scriptSignals: z.array(z.object({}).passthrough()),
    workflowSignals: z.array(z.object({}).passthrough()),
    unsupportedManifests: z.array(z.object({}).passthrough()),
    omissions: z.array(manifestWorkflowOmissionSchema),
  })
  .strict();

const languageCodeShapeSummarySchema = z
  .object({
    analyzedFileCount: z.number().int().nonnegative(),
    sourceFileCount: z.number().int().nonnegative(),
    testFileCount: z.number().int().nonnegative(),
    documentationFileCount: z.number().int().nonnegative(),
    largeFileCount: z.number().int().nonnegative(),
    skippedFileCount: z.number().int().nonnegative(),
    unsupportedFileCount: z.number().int().nonnegative(),
    totalTextLineCount: z.number().int().nonnegative(),
    totalCodeLineCount: z.number().int().nonnegative(),
    totalDeferredWorkMarkerCount: z.number().int().nonnegative(),
    totalBranchLikeTokenCount: z.number().int().nonnegative(),
  })
  .strict();

const languageCodeShapeLanguageMetricSchema = z
  .object({
    language: z.string().min(1),
    extensions: z.array(z.string().min(1)),
    fileCount: z.number().int().nonnegative(),
    sourceFileCount: z.number().int().nonnegative(),
    textLineCount: z.number().int().nonnegative(),
    codeLineCount: z.number().int().nonnegative(),
    evidenceReferences: z.array(EvidenceReferenceSchema),
  })
  .strict();

const languageCodeShapeFileMetricSchema = z
  .object({
    path: z.string().min(1),
    extension: z.string().min(1),
    language: z.string().min(1),
    sizeBytes: z.number().int().nonnegative(),
    isSource: z.boolean(),
    isTest: z.boolean(),
    isDocumentation: z.boolean(),
    isLarge: z.boolean(),
    textLineCount: z.number().int().nonnegative(),
    nonEmptyLineCount: z.number().int().nonnegative(),
    codeLineCount: z.number().int().nonnegative(),
    branchLikeTokenCount: z.number().int().nonnegative(),
    deferredWorkMarkerCount: z.number().int().nonnegative(),
    evidenceReferences: z.array(EvidenceReferenceSchema),
  })
  .strict();

const languageCodeShapeDeferredWorkMarkerSchema = z
  .object({
    path: z.string().min(1),
    marker: z.enum(["TODO", "FIXME", "HACK", "XXX"]),
    line: z.number().int().positive(),
    excerpt: z.string().min(1),
    evidenceReferences: z.array(EvidenceReferenceSchema),
  })
  .strict();

const languageCodeShapeBranchLikeTokenSchema = z
  .object({
    path: z.string().min(1),
    token: z.string().min(1),
    count: z.number().int().nonnegative(),
    evidenceReferences: z.array(EvidenceReferenceSchema),
  })
  .strict();

const languageCodeShapeLargeFileSchema = z
  .object({
    path: z.string().min(1),
    sizeBytes: z.number().int().nonnegative(),
    thresholdBytes: z.number().int().nonnegative(),
    evidenceReferences: z.array(EvidenceReferenceSchema),
  })
  .strict();

const languageCodeShapeOmissionSchema = z
  .object({
    path: z.string().min(1),
    sizeBytes: z.number().int().nonnegative(),
    reason: z.enum([
      "binary",
      "generated",
      "ignored",
      "oversized",
      "unsupported-extension",
      "vendor",
    ]),
    detail: z.string().min(1),
    evidenceReferences: z.array(EvidenceReferenceSchema),
  })
  .strict();

const languageCodeShapeCaveatSchema = z
  .object({
    kind: z.enum([
      "large-files",
      "metric-limitation",
      "skipped-files",
      "unsupported-files",
    ]),
    detail: z.string().min(1),
    evidenceReferences: z.array(EvidenceReferenceSchema),
  })
  .strict();

const languageCodeShapeMetricResultSchema = z
  .object({
    summary: languageCodeShapeSummarySchema,
    languageMix: z.array(languageCodeShapeLanguageMetricSchema),
    files: z.array(languageCodeShapeFileMetricSchema),
    deferredWorkMarkers: z.array(languageCodeShapeDeferredWorkMarkerSchema),
    branchLikeTokens: z.array(languageCodeShapeBranchLikeTokenSchema),
    largeFiles: z.array(languageCodeShapeLargeFileSchema),
    omissions: z.array(languageCodeShapeOmissionSchema),
    caveats: z.array(languageCodeShapeCaveatSchema),
  })
  .strict();

const securityHygieneLockfileSignalSchema = z
  .object({
    kind: z.literal("lockfile"),
    category: z.literal("hygiene"),
    path: z.string().min(1),
    ecosystem: z.string().min(1),
    packageManager: z.string().min(1),
    confidence: ConfidenceSchema,
    evidenceReferences: z.array(EvidenceReferenceSchema),
    reviewDisposition: z.object({ required: z.literal(true) }).passthrough(),
  })
  .strict();

const securityHygieneDependencyCountSignalSchema = z
  .object({
    kind: z.literal("package-dependency-count"),
    category: z.literal("hygiene"),
    path: z.string().min(1),
    totalDependencies: z.number().int().nonnegative(),
    byRelationship: z.record(z.string(), z.number().int().nonnegative()),
    confidence: ConfidenceSchema,
    evidenceReferences: z.array(EvidenceReferenceSchema),
    reviewDisposition: z.object({ required: z.literal(true) }).passthrough(),
  })
  .strict();

const securityHygieneEnvExampleSignalSchema = z
  .object({
    kind: z.literal("env-example"),
    category: z.literal("hygiene"),
    path: z.string().min(1),
    confidence: ConfidenceSchema,
    evidenceReferences: z.array(EvidenceReferenceSchema),
    reviewDisposition: z.object({ required: z.literal(true) }).passthrough(),
  })
  .strict();

const securityHygieneSecretRiskSignalSchema = z
  .object({
    kind: z.enum(["secret-risk-path", "secret-risk-content"]),
    category: z.literal("risk"),
    path: z.string().min(1),
    reason: z.string().min(1),
    matchedPattern: z.string().min(1).optional(),
    lineStart: z.number().int().positive().optional(),
    lineEnd: z.number().int().positive().optional(),
    confidence: ConfidenceSchema,
    evidenceReferences: z.array(EvidenceReferenceSchema),
    reviewDisposition: z.object({ required: z.literal(true) }).passthrough(),
  })
  .strict();

const securityHygieneLimitationSchema = z
  .object({
    kind: z.enum([
      "bounded-content-scan",
      "content-unavailable",
      "human-review-required",
      "manifest-data-unavailable",
    ]),
    detail: z.string().min(1),
    path: z.string().min(1).optional(),
    evidenceReferences: z.array(EvidenceReferenceSchema),
  })
  .strict();

const securityHygieneSignalResultSchema = z
  .object({
    lockfileSignals: z.array(securityHygieneLockfileSignalSchema),
    dependencyCountSignals: z.array(securityHygieneDependencyCountSignalSchema),
    envExampleSignals: z.array(securityHygieneEnvExampleSignalSchema),
    secretRiskSignals: z.array(securityHygieneSecretRiskSignalSchema),
    limitations: z.array(securityHygieneLimitationSchema),
  })
  .strict();

export const EvidenceBundleMetadataSchema = z
  .object({
    evidenceSummary: z.string().min(1),
    fileInventory: fileInventorySchema,
    manifestWorkflowSignals: manifestWorkflowSignalResultSchema,
    projectArchetypeSignals: projectArchetypeSignalResultSchema,
    languageCodeShapeMetrics: languageCodeShapeMetricResultSchema,
    securityHygieneSignals: securityHygieneSignalResultSchema,
    evidenceReferences: z.array(EvidenceReferenceSchema),
  })
  .strict();

export type EvidenceBundleMetadata = z.infer<
  typeof EvidenceBundleMetadataSchema
>;

export const EvidenceBundleRecordSchema = z
  .object({
    schemaVersion: z.literal(EvidenceBundleRecordSchemaVersion),
    repository: RepositoryIdentitySchema,
    collectedAt: z.iso.datetime({ offset: true }),
    metadata: EvidenceBundleMetadataSchema,
    rawArtifacts: z.array(EvidenceArtifactRecordSchema).default([]),
  })
  .strict();

export type EvidenceBundleRecord = z.infer<typeof EvidenceBundleRecordSchema>;

export type EvidenceBundleRecordInput = {
  readonly repository: RepositoryIdentity;
  readonly collectedAt: string;
  readonly evidenceBundle: RepositoryEvidenceBundle;
  readonly rawArtifacts?: readonly EvidenceArtifactRecord[];
};

export function toEvidenceBundleRecord(
  input: EvidenceBundleRecordInput,
): EvidenceBundleRecord {
  return EvidenceBundleRecordSchema.parse({
    schemaVersion: EvidenceBundleRecordSchemaVersion,
    repository: input.repository,
    collectedAt: input.collectedAt,
    metadata: {
      evidenceSummary: input.evidenceBundle.evidenceSummary,
      fileInventory: input.evidenceBundle.fileInventory,
      manifestWorkflowSignals: input.evidenceBundle.manifestWorkflowSignals,
      projectArchetypeSignals: input.evidenceBundle.projectArchetypeSignals,
      languageCodeShapeMetrics: input.evidenceBundle.languageCodeShapeMetrics,
      securityHygieneSignals: input.evidenceBundle.securityHygieneSignals,
      evidenceReferences: input.evidenceBundle.evidenceReferences,
    },
    rawArtifacts: input.rawArtifacts ?? [],
  });
}

export function parseEvidenceBundleRecord(
  input: unknown,
): EvidenceBundleRecord {
  return EvidenceBundleRecordSchema.parse(input);
}
