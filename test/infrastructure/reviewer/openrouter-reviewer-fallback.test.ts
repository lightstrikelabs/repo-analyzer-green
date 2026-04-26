import { describe, expect, it } from "vitest";

import type { ReviewerMetadata } from "../../../src/domain/report/report-card";
import type {
  MalformedReviewerResponse,
  Reviewer,
  ReviewerRequest,
  ReviewerResult,
} from "../../../src/domain/reviewer/reviewer";
import {
  ReviewerAssessmentSchemaVersion,
  type ReviewerAssessment,
} from "../../../src/domain/reviewer/reviewer-assessment";
import {
  OpenRouterDefaultModelId,
  OpenRouterFallbackModelId,
  OpenRouterFreeModelId,
} from "../../../src/infrastructure/llm/openrouter-config";
import { OpenRouterReviewerFallback } from "../../../src/infrastructure/reviewer/openrouter-reviewer-fallback";

const evidenceReference = {
  id: "evidence:package-json",
  kind: "file",
  label: "Package manifest",
  path: "package.json",
} as const;

const request: ReviewerRequest = {
  repository: {
    provider: "github",
    owner: "lightstrikelabs",
    name: "repo-analyzer-green",
    url: "https://github.com/lightstrikelabs/repo-analyzer-green",
  },
  evidenceReferences: [evidenceReference],
  evidenceSummary: "Repository evidence was collected successfully.",
};

const fallbackAssessment = {
  schemaVersion: ReviewerAssessmentSchemaVersion,
  reviewer: {
    kind: "automated",
    name: "Static evidence reviewer",
    reviewerVersion: "static-evidence-reviewer.v1",
    reviewedAt: "2026-04-26T12:00:00-07:00",
  },
  assessedArchetype: {
    value: "unknown",
    confidence: {
      level: "medium",
      score: 0.55,
      rationale: "Static evidence only.",
    },
    evidenceReferences: [evidenceReference],
    rationale: "Static fallback assessment.",
  },
  dimensions: [
    {
      dimension: "maintainability",
      summary: "Static evidence can still support a report.",
      confidence: {
        level: "medium",
        score: 0.7,
        rationale: "Repository evidence was collected.",
      },
      evidenceReferences: [evidenceReference],
      strengths: ["Static signals are available."],
      risks: ["Semantic review was unavailable."],
      missingEvidence: ["Structured reviewer assessment"],
    },
  ],
  caveats: [
    {
      id: "caveat:static-reviewer",
      summary: "No OpenRouter key was supplied.",
      affectedDimensions: ["maintainability"],
      missingEvidence: ["Structured LLM or human reviewer assessment"],
      confidence: {
        level: "medium",
        score: 0.6,
        rationale: "Static evidence has limited semantic coverage.",
      },
      evidenceReferences: [evidenceReference],
    },
  ],
  followUpQuestions: [],
} satisfies ReviewerAssessment;

const openRouterMetadata: ReviewerMetadata = {
  kind: "llm",
  name: "OpenRouter reviewer",
  reviewerVersion: "openrouter-reviewer.v1",
  modelProvider: "openrouter",
  modelName: OpenRouterFreeModelId,
  reviewedAt: "2026-04-26T12:01:00-07:00",
};

describe("OpenRouterReviewerFallback", () => {
  it("returns the primary reviewer assessment when OpenRouter succeeds", async () => {
    const primary = new StubReviewer({
      kind: "assessment",
      assessment: fallbackAssessment,
    });
    const fallback = new StubReviewer({
      kind: "assessment",
      assessment: fallbackAssessment,
    });
    const reviewer = new OpenRouterReviewerFallback({ primary, fallback });

    const result = await reviewer.assess(request);

    expect(result).toEqual({
      kind: "assessment",
      assessment: fallbackAssessment,
    });
    expect(primary.calls).toBe(1);
    expect(fallback.calls).toBe(0);
  });

  it("falls back to static analysis with an alternate-model suggestion when OpenRouter cannot complete", async () => {
    const primary = new StubReviewer(
      malformedOpenRouterResult({
        rawResponse: "",
        message:
          "OpenRouter reviewer output is unavailable because the provider request could not be completed.",
      }),
    );
    const fallback = new StubReviewer({
      kind: "assessment",
      assessment: fallbackAssessment,
    });
    const reviewer = new OpenRouterReviewerFallback({ primary, fallback });

    const result = await reviewer.assess(request);

    expect(result.kind).toBe("assessment");
    if (result.kind !== "assessment") {
      throw new Error("Expected fallback reviewer assessment");
    }
    expect(fallback.calls).toBe(1);
    expect(result.assessment.caveats).not.toContainEqual(
      expect.objectContaining({ id: "caveat:static-reviewer" }),
    );
    expect(result.assessment.caveats).toContainEqual(
      expect.objectContaining({
        id: "caveat:openrouter-reviewer-fallback",
        summary: expect.stringContaining(OpenRouterDefaultModelId),
        missingEvidence: expect.arrayContaining([
          "Successful reviewer response from the selected OpenRouter model",
        ]),
      }),
    );
  });

  it("suggests the fallback model when the default model cannot complete", async () => {
    const primary = new StubReviewer(
      malformedOpenRouterResult({
        rawResponse: "",
        message:
          "OpenRouter reviewer output is unavailable because the provider request could not be completed.",
        modelName: OpenRouterDefaultModelId,
      }),
    );
    const fallback = new StubReviewer({
      kind: "assessment",
      assessment: fallbackAssessment,
    });
    const reviewer = new OpenRouterReviewerFallback({ primary, fallback });

    const result = await reviewer.assess(request);

    expect(result.kind).toBe("assessment");
    if (result.kind !== "assessment") {
      throw new Error("Expected fallback reviewer assessment");
    }
    expect(result.assessment.caveats).toContainEqual(
      expect.objectContaining({
        id: "caveat:openrouter-reviewer-fallback",
        summary: expect.stringContaining(OpenRouterFallbackModelId),
      }),
    );
  });

  it("falls back with parse diagnostics when OpenRouter output cannot be validated", async () => {
    const primary = new StubReviewer(
      malformedOpenRouterResult({
        rawResponse: "not-json",
        message: "Reviewer response was not valid JSON.",
      }),
    );
    const fallback = new StubReviewer({
      kind: "assessment",
      assessment: fallbackAssessment,
    });
    const reviewer = new OpenRouterReviewerFallback({ primary, fallback });

    const result = await reviewer.assess(request);

    expect(result.kind).toBe("assessment");
    if (result.kind !== "assessment") {
      throw new Error("Expected fallback reviewer assessment");
    }
    expect(result.assessment.caveats).toContainEqual(
      expect.objectContaining({
        id: "caveat:openrouter-reviewer-fallback",
        summary: expect.stringContaining("could not be parsed or validated"),
        missingEvidence: expect.arrayContaining([
          "Reviewer response was not valid JSON.",
        ]),
      }),
    );
  });
});

class StubReviewer implements Reviewer {
  calls = 0;

  constructor(private readonly result: ReviewerResult) {}

  async assess(): Promise<ReviewerResult> {
    this.calls += 1;
    return this.result;
  }
}

function malformedOpenRouterResult(options: {
  readonly rawResponse: string;
  readonly message: string;
  readonly modelName?: string;
}): MalformedReviewerResponse {
  return {
    kind: "malformed-response",
    reviewer:
      options.modelName === undefined
        ? openRouterMetadata
        : {
            ...openRouterMetadata,
            modelName: options.modelName,
          },
    rawResponse: options.rawResponse,
    validationIssues: [
      {
        path: [],
        message: options.message,
      },
    ],
  };
}
