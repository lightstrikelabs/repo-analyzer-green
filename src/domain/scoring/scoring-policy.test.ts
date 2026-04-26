import { describe, expect, it } from "vitest";

import {
  ReviewerAssessmentSchemaVersion,
  type ReviewerAssessment,
} from "../reviewer/reviewer-assessment";
import { scoreRepositoryQuality } from "./scoring-policy";

const packageManifestReference = {
  id: "evidence:package-json",
  kind: "file",
  label: "Package manifest",
  path: "package.json",
} as const;

const testFileReference = {
  id: "evidence:test-file",
  kind: "file",
  label: "Unit test file",
  path: "test/add.spec.ts",
} as const;

const highConfidence = {
  level: "high",
  score: 0.9,
  rationale: "Multiple files support the assessment.",
} as const;

const lowConfidence = {
  level: "low",
  score: 0.25,
  rationale: "The repository snapshot omits important evidence.",
} as const;

const baseReviewerAssessment: ReviewerAssessment = {
  schemaVersion: ReviewerAssessmentSchemaVersion,
  reviewer: {
    kind: "fake",
    name: "Fake reviewer",
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
      dimension: "maintainability",
      summary: "The modules are small, but naming around boundaries is uneven.",
      confidence: highConfidence,
      evidenceReferences: [packageManifestReference],
      strengths: ["Small modules are easy to scan."],
      risks: ["Boundary naming is inconsistent."],
      missingEvidence: [],
    },
    {
      dimension: "verifiability",
      summary: "Focused tests cover exported behavior.",
      confidence: highConfidence,
      evidenceReferences: [testFileReference],
      strengths: ["Unit tests exercise the public add function."],
      risks: [],
      missingEvidence: [],
    },
  ],
  caveats: [],
  followUpQuestions: [
    {
      id: "question:test-depth",
      question: "What behavior remains untested?",
      targetDimension: "verifiability",
      rationale: "The initial fixture has a narrow test suite.",
    },
  ],
};

describe("scoreRepositoryQuality", () => {
  it("combines fake evidence and fake reviewer assessment into report-card input", () => {
    const reportInput = scoreRepositoryQuality({
      repository: {
        provider: "local-fixture",
        name: "minimal-node-library",
        revision: "fixture",
      },
      evidenceReferences: [packageManifestReference, testFileReference],
      reviewerAssessment: baseReviewerAssessment,
    });

    expect(reportInput.assessedArchetype).toBe("library");
    expect(reportInput.reviewerMetadata.kind).toBe("fake");
    expect(reportInput.evidenceReferences).toEqual([
      packageManifestReference,
      testFileReference,
    ]);
    expect(reportInput.dimensionAssessments).toHaveLength(2);
    expect(reportInput.recommendedNextQuestions).toEqual([
      baseReviewerAssessment.followUpQuestions[0],
    ]);
  });

  it("documents maintainability risk without treating the finding as evidence-free", () => {
    const reportInput = scoreRepositoryQuality({
      repository: {
        provider: "local-fixture",
        name: "minimal-node-library",
      },
      evidenceReferences: [packageManifestReference],
      reviewerAssessment: baseReviewerAssessment,
    });

    const maintainability = reportInput.dimensionAssessments.find(
      (assessment) => assessment.dimension === "maintainability",
    );

    expect(maintainability?.rating).toBe("fair");
    expect(maintainability?.score).toBe(65);
    expect(maintainability?.findings).toContainEqual({
      id: "finding:maintainability:risk:0",
      dimension: "maintainability",
      severity: "medium",
      title: "Maintainability risk",
      summary: "Boundary naming is inconsistent.",
      confidence: highConfidence,
      evidenceReferences: [packageManifestReference],
    });
  });

  it("represents missing verifiability evidence as uncertainty rather than a score penalty", () => {
    const reviewerAssessment: ReviewerAssessment = {
      ...baseReviewerAssessment,
      dimensions: [
        {
          dimension: "verifiability",
          summary: "Tests exist, but integration behavior is not visible.",
          confidence: highConfidence,
          evidenceReferences: [testFileReference],
          strengths: ["Unit tests exercise exported behavior."],
          risks: [],
          missingEvidence: ["Integration test results", "Coverage trend"],
        },
      ],
    };

    const reportInput = scoreRepositoryQuality({
      repository: {
        provider: "local-fixture",
        name: "minimal-node-library",
      },
      evidenceReferences: [testFileReference],
      reviewerAssessment,
    });

    expect(reportInput.dimensionAssessments[0]?.rating).toBe("excellent");
    expect(reportInput.dimensionAssessments[0]?.score).toBe(90);
    expect(reportInput.dimensionAssessments[0]?.confidence.level).toBe(
      "medium",
    );
    expect(reportInput.caveats[0]).toMatchObject({
      id: "caveat:verifiability:missing-evidence",
      title: "Missing verifiability evidence",
      affectedDimensions: ["verifiability"],
      missingEvidence: ["Integration test results", "Coverage trend"],
    });
  });

  it("turns low-confidence reviewer claims into caveats and lower report confidence", () => {
    const reviewerAssessment: ReviewerAssessment = {
      ...baseReviewerAssessment,
      dimensions: [
        {
          dimension: "security",
          summary: "Security posture cannot be established from the snapshot.",
          confidence: lowConfidence,
          evidenceReferences: [],
          strengths: [],
          risks: ["Dependency audit output is unavailable."],
          missingEvidence: ["Dependency audit output", "Secret scan results"],
        },
      ],
    };

    const reportInput = scoreRepositoryQuality({
      repository: {
        provider: "local-fixture",
        name: "minimal-node-library",
      },
      evidenceReferences: [],
      reviewerAssessment,
    });

    expect(reportInput.dimensionAssessments[0]).toMatchObject({
      dimension: "security",
      rating: "not-assessed",
      confidence: lowConfidence,
      caveatIds: [
        "caveat:security:low-confidence",
        "caveat:security:missing-evidence",
      ],
    });
    expect(reportInput.dimensionAssessments[0]?.score).toBeUndefined();
    expect(reportInput.caveats.map((caveat) => caveat.id)).toEqual([
      "caveat:security:low-confidence",
      "caveat:security:missing-evidence",
    ]);
  });
});
