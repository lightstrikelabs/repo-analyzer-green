import { describe, expect, it } from "vitest";

import {
  ReviewerAssessmentSchema,
  ReviewerAssessmentSchemaVersion,
} from "./reviewer-assessment";

const highConfidence = {
  level: "high",
  score: 0.88,
  rationale: "The assessment is supported by package and test files.",
};

const lowConfidence = {
  level: "low",
  score: 0.2,
  rationale: "The repository snapshot omits deployment and incident history.",
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

const reviewerAssessment = {
  schemaVersion: ReviewerAssessmentSchemaVersion,
  reviewer: {
    kind: "llm",
    name: "Fixture reviewer",
    reviewerVersion: "2026-04-issue-25",
    modelProvider: "fixture-provider",
    modelName: "fixture-model",
    reviewedAt: "2026-04-25T20:00:00-07:00",
  },
  assessedArchetype: {
    value: "library",
    confidence: highConfidence,
    evidenceReferences: [packageManifestReference],
    rationale: "The package manifest exposes a reusable library entrypoint.",
  },
  dimensions: [
    {
      dimension: "verifiability",
      summary: "The repository has focused tests for exported behavior.",
      confidence: highConfidence,
      evidenceReferences: [testFileReference],
      strengths: ["A unit test exercises the public add function."],
      risks: ["The test suite is still narrow."],
      missingEvidence: [],
    },
    {
      dimension: "operability",
      summary: "Release readiness cannot be determined from the snapshot.",
      confidence: lowConfidence,
      evidenceReferences: [packageManifestReference],
      strengths: [],
      risks: [],
      missingEvidence: ["Release workflow history", "Production incident data"],
    },
  ],
  caveats: [
    {
      id: "caveat:missing-runtime-context",
      summary:
        "The repository snapshot does not include runtime operations data.",
      affectedDimensions: ["operability", "security"],
      missingEvidence: ["Deployment history", "Incident history"],
      confidence: lowConfidence,
      evidenceReferences: [packageManifestReference],
    },
  ],
  followUpQuestions: [
    {
      id: "question:release-readiness",
      question: "How is this package released and verified before publishing?",
      targetDimension: "operability",
      rationale:
        "Release readiness depends on evidence that is missing from source files.",
    },
  ],
};

describe("reviewer assessment schema", () => {
  it("parses reviewer assessments with dimensions, confidence, caveats, evidence, and follow-up questions", () => {
    const parsed = ReviewerAssessmentSchema.parse(reviewerAssessment);

    expect(parsed.schemaVersion).toBe("reviewer-assessment.v1");
    expect(parsed.assessedArchetype.value).toBe("library");
    expect(parsed.dimensions[0]?.confidence.level).toBe("high");
    expect(parsed.dimensions[1]?.missingEvidence).toEqual([
      "Release workflow history",
      "Production incident data",
    ]);
    expect(parsed.caveats[0]?.affectedDimensions).toContain("security");
    expect(parsed.followUpQuestions[0]?.targetDimension).toBe("operability");
  });

  it("rejects a dimension without confidence", () => {
    const firstDimension = reviewerAssessment.dimensions[0];

    if (firstDimension === undefined) {
      throw new Error("reviewer assessment fixture requires a dimension");
    }

    const { confidence: _confidence, ...dimensionWithoutConfidence } =
      firstDimension;

    const result = ReviewerAssessmentSchema.safeParse({
      ...reviewerAssessment,
      dimensions: [dimensionWithoutConfidence],
    });

    expect(result.success).toBe(false);
  });

  it("represents insufficient evidence without inventing evidence references", () => {
    const parsed = ReviewerAssessmentSchema.parse({
      ...reviewerAssessment,
      dimensions: [
        {
          dimension: "security",
          summary:
            "Security posture is uncertain because dependency audit and secret scan results are missing.",
          confidence: lowConfidence,
          missingEvidence: ["Dependency audit output", "Secret scan results"],
        },
      ],
    });

    expect(parsed.dimensions[0]?.evidenceReferences).toEqual([]);
    expect(parsed.dimensions[0]?.missingEvidence).toEqual([
      "Dependency audit output",
      "Secret scan results",
    ]);
  });

  it("rejects unsupported dimensions", () => {
    const result = ReviewerAssessmentSchema.safeParse({
      ...reviewerAssessment,
      dimensions: [
        {
          ...reviewerAssessment.dimensions[0],
          dimension: "vibes",
        },
      ],
    });

    expect(result.success).toBe(false);
  });
});
