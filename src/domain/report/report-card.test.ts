import { describe, expect, it } from "vitest";

import {
  ReportCardInputSchema,
  ReportCardSchema,
  ReportCardSchemaVersion,
  ReviewerMetadataSchema,
} from "./report-card";
import { EvidenceReferenceSchema } from "../shared/evidence-reference";

const highConfidence = {
  level: "high",
  score: 0.92,
  rationale: "Multiple repository files support this conclusion.",
};

const packageManifestReference = {
  id: "evidence:package-json",
  kind: "file",
  label: "Package manifest",
  path: "package.json",
  lineStart: 1,
  lineEnd: 24,
};

const testFileReference = {
  id: "evidence:test-file",
  kind: "file",
  label: "Unit test file",
  path: "test/add.spec.ts",
};

const reviewerMetadata = {
  kind: "llm",
  name: "Fixture reviewer",
  reviewerVersion: "2026-04-issue-17",
  modelProvider: "fixture-provider",
  modelName: "fixture-model",
  modelVersion: "fixture-model-1",
  reviewedAt: "2026-04-25T20:00:00-07:00",
};

const dimensionAssessment = {
  dimension: "verifiability",
  title: "Verifiability",
  summary: "The repository has an executable unit test around the public API.",
  rating: "good",
  score: 82,
  confidence: highConfidence,
  evidenceReferences: [testFileReference],
  findings: [
    {
      id: "finding:test-coverage-shape",
      dimension: "verifiability",
      severity: "low",
      title: "Tests exercise the exported behavior",
      summary:
        "The fixture includes a unit test for the exported add function.",
      confidence: highConfidence,
      evidenceReferences: [testFileReference],
    },
  ],
};

const reportCardInput = {
  repository: {
    provider: "local-fixture",
    name: "minimal-node-library",
    revision: "fixture",
  },
  assessedArchetype: "library",
  reviewerMetadata,
  evidenceReferences: [packageManifestReference, testFileReference],
  dimensionAssessments: [dimensionAssessment],
  caveats: [
    {
      id: "caveat:limited-fixture",
      title: "Limited fixture scope",
      summary: "The fixture does not include release or incident history.",
      affectedDimensions: ["operability"],
      missingEvidence: ["Release workflow history", "Production incident data"],
    },
  ],
  recommendedNextQuestions: [
    {
      id: "question:release-process",
      question: "How is this package released and verified before publishing?",
      targetDimension: "operability",
      rationale:
        "Release readiness cannot be inferred from source files alone.",
    },
  ],
};

describe("report card domain models", () => {
  it("parses a report-card input that preserves evidence, caveats, questions, and reviewer metadata", () => {
    const parsed = ReportCardInputSchema.parse(reportCardInput);

    expect(parsed.repository.provider).toBe("local-fixture");
    expect(parsed.assessedArchetype).toBe("library");
    expect(parsed.reviewerMetadata.modelName).toBe("fixture-model");
    expect(parsed.dimensionAssessments[0]?.confidence.level).toBe("high");
    expect(
      parsed.dimensionAssessments[0]?.findings[0]?.evidenceReferences,
    ).toEqual([testFileReference]);
    expect(parsed.caveats[0]?.missingEvidence).toEqual([
      "Release workflow history",
      "Production incident data",
    ]);
    expect(parsed.recommendedNextQuestions[0]?.targetDimension).toBe(
      "operability",
    );
  });

  it("parses a generated report card with schema and scoring policy metadata", () => {
    const parsed = ReportCardSchema.parse({
      ...reportCardInput,
      id: "report:minimal-node-library",
      schemaVersion: ReportCardSchemaVersion,
      generatedAt: "2026-04-25T20:05:00-07:00",
      scoringPolicy: {
        name: "fixture policy",
        version: "0.1.0",
      },
    });

    expect(parsed.schemaVersion).toBe("report-card.v1");
    expect(parsed.scoringPolicy).toEqual({
      name: "fixture policy",
      version: "0.1.0",
    });
  });

  it("rejects dimension confidence outside the normalized range", () => {
    const result = ReportCardInputSchema.safeParse({
      ...reportCardInput,
      dimensionAssessments: [
        {
          ...dimensionAssessment,
          confidence: {
            ...highConfidence,
            score: 1.2,
          },
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it("requires evidence-backed findings", () => {
    const result = ReportCardInputSchema.safeParse({
      ...reportCardInput,
      dimensionAssessments: [
        {
          ...dimensionAssessment,
          findings: [
            {
              ...dimensionAssessment.findings[0],
              evidenceReferences: [],
            },
          ],
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it("requires LLM reviewer metadata to identify the model", () => {
    const result = ReviewerMetadataSchema.safeParse({
      kind: "llm",
      name: "Reviewer without model identity",
      reviewedAt: "2026-04-25T20:00:00-07:00",
    });

    expect(result.success).toBe(false);
  });

  it("rejects evidence line ranges that run backward", () => {
    const result = EvidenceReferenceSchema.safeParse({
      ...packageManifestReference,
      lineStart: 10,
      lineEnd: 2,
    });

    expect(result.success).toBe(false);
  });
});
