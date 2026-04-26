import type { ReportDimensionKey } from "../../domain/report/report-card";
import type {
  MalformedReviewerResponse,
  Reviewer,
  ReviewerRequest,
  ReviewerResult,
} from "../../domain/reviewer/reviewer";
import type {
  ReviewerAssessment,
  ReviewerCaveat,
} from "../../domain/reviewer/reviewer-assessment";
import {
  OpenRouterDefaultModelId,
  OpenRouterFallbackModelId,
} from "../llm/openrouter-config";

export type OpenRouterReviewerFallbackOptions = {
  readonly primary: Reviewer;
  readonly fallback: Reviewer;
};

const staticReviewerCaveatId = "caveat:static-reviewer";
const fallbackCaveatId = "caveat:openrouter-reviewer-fallback";
const affectedDimensions = [
  "maintainability",
  "verifiability",
  "security",
  "architecture-boundaries",
  "documentation",
] satisfies readonly ReportDimensionKey[];

export class OpenRouterReviewerFallback implements Reviewer {
  private readonly primary: Reviewer;
  private readonly fallback: Reviewer;

  constructor(options: OpenRouterReviewerFallbackOptions) {
    this.primary = options.primary;
    this.fallback = options.fallback;
  }

  async assess(request: ReviewerRequest): Promise<ReviewerResult> {
    const primaryResult = await this.primary.assess(request);

    if (primaryResult.kind === "assessment") {
      return primaryResult;
    }

    const fallbackResult = await this.fallback.assess(request);

    if (fallbackResult.kind === "malformed-response") {
      return primaryResult;
    }

    return {
      kind: "assessment",
      assessment: withOpenRouterFallbackCaveat(
        fallbackResult.assessment,
        fallbackCaveat(request, primaryResult),
      ),
    };
  }
}

function withOpenRouterFallbackCaveat(
  assessment: ReviewerAssessment,
  caveat: ReviewerCaveat,
): ReviewerAssessment {
  return {
    ...assessment,
    caveats: [
      ...assessment.caveats.filter(
        (existingCaveat) => existingCaveat.id !== staticReviewerCaveatId,
      ),
      caveat,
    ],
  };
}

function fallbackCaveat(
  request: ReviewerRequest,
  malformedResponse: MalformedReviewerResponse,
): ReviewerCaveat {
  const providerFailure = malformedResponse.rawResponse.trim() === "";

  return {
    id: fallbackCaveatId,
    summary: providerFailure
      ? `OpenRouter reviewer enrichment failed for ${modelLabel(malformedResponse)}, so the report falls back to deterministic static analysis. Try ${suggestedModelLabel(malformedResponse)} or another structured-output-capable model.`
      : "OpenRouter reviewer output could not be parsed or validated, so the report falls back to deterministic static analysis while preserving validation details.",
    affectedDimensions: [...affectedDimensions],
    missingEvidence: providerFailure
      ? [
          "Structured OpenRouter reviewer assessment",
          "Successful reviewer response from the selected OpenRouter model",
          ...validationIssueMessages(malformedResponse),
        ]
      : [
          "Structured OpenRouter reviewer assessment",
          ...validationIssueMessages(malformedResponse),
        ],
    confidence: {
      level: "medium",
      score: 0.62,
      rationale:
        "Repository evidence was collected, but semantic reviewer enrichment was unavailable for this run.",
    },
    evidenceReferences:
      request.evidenceReferences.length === 0
        ? [
            {
              id: "reviewer:openrouter-fallback",
              kind: "reviewer",
              label: "OpenRouter reviewer fallback",
              notes:
                "No deterministic evidence references were supplied to the fallback caveat.",
            },
          ]
        : [...request.evidenceReferences],
  };
}

function validationIssueMessages(
  malformedResponse: MalformedReviewerResponse,
): readonly string[] {
  return [
    ...new Set(
      malformedResponse.validationIssues.map((issue) => issue.message),
    ),
  ];
}

function modelLabel(malformedResponse: MalformedReviewerResponse): string {
  return malformedResponse.reviewer.kind === "llm" &&
    malformedResponse.reviewer.modelName !== undefined
    ? malformedResponse.reviewer.modelName
    : "the selected model";
}

function suggestedModelLabel(
  malformedResponse: MalformedReviewerResponse,
): string {
  return modelLabel(malformedResponse) === OpenRouterDefaultModelId
    ? OpenRouterFallbackModelId
    : OpenRouterDefaultModelId;
}
