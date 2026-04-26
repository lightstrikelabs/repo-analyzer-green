import { describe, expect, it } from "vitest";

import {
  ReviewerAssessmentSchemaVersion,
  type ReviewerAssessment,
} from "../../../src/domain/reviewer/reviewer-assessment";
import type {
  MalformedReviewerResponse,
  ReviewerRequest,
} from "../../../src/domain/reviewer/reviewer";
import { FakeReviewer } from "../../../src/infrastructure/reviewer/fake-reviewer";

const packageManifestReference = {
  id: "evidence:package-json",
  kind: "file",
  label: "Package manifest",
  path: "package.json",
  lineStart: 1,
  lineEnd: 24,
} as const;

const testFileReference = {
  id: "evidence:test-file",
  kind: "file",
  label: "Unit test file",
  path: "test/add.spec.ts",
} as const;

const highConfidence = {
  level: "high",
  score: 0.91,
  rationale: "Package and test files support this conclusion.",
} as const;

const lowConfidence = {
  level: "low",
  score: 0.19,
  rationale: "The fixture intentionally omits operational context.",
} as const;

const reviewerMetadata = {
  kind: "fake",
  name: "Fake reviewer",
  reviewerVersion: "issue-26",
  reviewedAt: "2026-04-25T20:00:00-07:00",
} as const;

const request: ReviewerRequest = {
  repository: {
    provider: "local-fixture",
    name: "minimal-node-library",
    revision: "fixture",
  },
  evidenceReferences: [packageManifestReference, testFileReference],
  evidenceSummary: "A minimal TypeScript library with one unit test.",
};

const deterministicAssessment = {
  schemaVersion: ReviewerAssessmentSchemaVersion,
  reviewer: reviewerMetadata,
  assessedArchetype: {
    value: "library",
    confidence: highConfidence,
    evidenceReferences: [packageManifestReference],
    rationale: "The package manifest exposes reusable library code.",
  },
  dimensions: [
    {
      dimension: "verifiability",
      summary: "The fixture includes a focused public API test.",
      confidence: highConfidence,
      evidenceReferences: [testFileReference],
      strengths: ["The exported add function is covered by a unit test."],
      risks: ["The test suite remains narrow."],
      missingEvidence: [],
    },
  ],
  caveats: [],
  followUpQuestions: [],
} satisfies ReviewerAssessment;

const lowConfidenceAssessment = {
  ...deterministicAssessment,
  assessedArchetype: {
    value: "unknown",
    confidence: lowConfidence,
    evidenceReferences: [],
    rationale: "The fake response simulates ambiguous archetype evidence.",
  },
  dimensions: [
    {
      dimension: "operability",
      summary: "Release readiness is uncertain from the fixture alone.",
      confidence: lowConfidence,
      evidenceReferences: [packageManifestReference],
      strengths: [],
      risks: ["Release and incident history are unavailable."],
      missingEvidence: ["Release workflow history", "Incident history"],
    },
  ],
  caveats: [
    {
      id: "caveat:missing-operability-context",
      summary: "Operational evidence is absent from the fixture snapshot.",
      affectedDimensions: ["operability"],
      missingEvidence: ["Deployment history"],
      confidence: lowConfidence,
      evidenceReferences: [],
    },
  ],
} satisfies ReviewerAssessment;

describe("FakeReviewer", () => {
  it("returns an injected deterministic reviewer assessment and records the request", async () => {
    const reviewer = new FakeReviewer({
      result: {
        kind: "assessment",
        assessment: deterministicAssessment,
      },
    });

    const result = await reviewer.assess(request);

    expect(result).toEqual({
      kind: "assessment",
      assessment: deterministicAssessment,
    });
    expect(reviewer.receivedRequests).toEqual([request]);
  });

  it("returns malformed reviewer output as a typed recoverable result", async () => {
    const malformedResponse: MalformedReviewerResponse = {
      kind: "malformed-response",
      reviewer: reviewerMetadata,
      rawResponse: "{ malformed reviewer response",
      validationIssues: [
        {
          path: ["dimensions", 0, "confidence"],
          message: "Required",
        },
      ],
    };
    const reviewer = new FakeReviewer({ result: malformedResponse });

    const result = await reviewer.assess(request);

    expect(result).toEqual(malformedResponse);
  });

  it("can simulate low-confidence reviewer claims without model or network calls", async () => {
    const reviewer = new FakeReviewer({
      result: {
        kind: "assessment",
        assessment: lowConfidenceAssessment,
      },
    });

    const result = await reviewer.assess(request);

    expect(result.kind).toBe("assessment");
    if (result.kind !== "assessment") {
      throw new Error("fake reviewer must return the injected assessment");
    }
    expect(result.assessment.assessedArchetype.confidence.level).toBe("low");
    expect(result.assessment.dimensions[0]?.confidence).toEqual(lowConfidence);
    expect(result.assessment.reviewer.kind).toBe("fake");
  });
});
