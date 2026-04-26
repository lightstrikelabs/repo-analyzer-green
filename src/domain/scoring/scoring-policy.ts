import type {
  DimensionAssessment,
  FindingSeverity,
  RecommendedQuestion,
  ReportCardInput,
  ReportCaveat,
  ReportDimensionKey,
  ReportRating,
  RepositoryIdentity,
} from "../report/report-card";
import type {
  ReviewerAssessment,
  ReviewerDimensionAssessment,
} from "../reviewer/reviewer-assessment";
import type { Confidence } from "../shared/confidence";
import type { EvidenceReference } from "../shared/evidence-reference";

export type ScoreRepositoryQualityInput = {
  readonly repository: RepositoryIdentity;
  readonly evidenceReferences: readonly EvidenceReference[];
  readonly reviewerAssessment: ReviewerAssessment;
};

export function scoreRepositoryQuality(
  input: ScoreRepositoryQualityInput,
): ReportCardInput {
  const dimensionAssessments = input.reviewerAssessment.dimensions.map(
    scoreDimensionAssessment,
  );

  return {
    repository: input.repository,
    assessedArchetype: input.reviewerAssessment.assessedArchetype.value,
    reviewerMetadata: input.reviewerAssessment.reviewer,
    evidenceReferences: [...input.evidenceReferences],
    dimensionAssessments,
    caveats: [
      ...input.reviewerAssessment.caveats.map(toReportCaveat),
      ...dimensionAssessments.flatMap((assessment) =>
        caveatsForDimension(
          assessment.dimension,
          input.reviewerAssessment.dimensions.find(
            (dimension) => dimension.dimension === assessment.dimension,
          ),
        ),
      ),
    ],
    recommendedNextQuestions: input.reviewerAssessment.followUpQuestions.map(
      toRecommendedQuestion,
    ),
  };
}

function scoreDimensionAssessment(
  reviewerDimension: ReviewerDimensionAssessment,
): DimensionAssessment {
  const caveatIds = caveatIdsForDimension(reviewerDimension);
  const confidence = confidenceForDimension(reviewerDimension);
  const evidenceReferences = [
    ...evidenceReferencesForDimension(reviewerDimension),
  ];
  const score = scoreForDimension(reviewerDimension);
  const baseAssessment = {
    dimension: reviewerDimension.dimension,
    title: titleForDimension(reviewerDimension.dimension),
    summary: reviewerDimension.summary,
    rating: ratingForScore(score, reviewerDimension.confidence),
    confidence,
    evidenceReferences,
    findings: findingsForDimension(reviewerDimension, evidenceReferences),
    caveatIds,
  };

  if (score === undefined) {
    return baseAssessment;
  }

  return {
    ...baseAssessment,
    score,
  };
}

function scoreForDimension(
  reviewerDimension: ReviewerDimensionAssessment,
): number | undefined {
  if (reviewerDimension.confidence.level === "low") {
    return undefined;
  }

  return clampScore(
    reviewerDimension.confidence.score * 100 -
      reviewerDimension.risks.length * 25,
  );
}

function ratingForScore(
  score: number | undefined,
  confidence: Confidence,
): ReportRating {
  if (score === undefined || confidence.level === "low") {
    return "not-assessed";
  }

  if (score >= 90) {
    return "excellent";
  }

  if (score >= 80) {
    return "good";
  }

  if (score >= 60) {
    return "fair";
  }

  if (score >= 40) {
    return "weak";
  }

  return "poor";
}

function confidenceForDimension(
  reviewerDimension: ReviewerDimensionAssessment,
): Confidence {
  if (
    reviewerDimension.confidence.level === "high" &&
    reviewerDimension.missingEvidence.length > 0
  ) {
    return {
      level: "medium",
      score: Math.max(0, reviewerDimension.confidence.score - 0.2),
      rationale: `${reviewerDimension.confidence.rationale} Missing evidence limits confidence.`,
    };
  }

  return reviewerDimension.confidence;
}

function findingsForDimension(
  reviewerDimension: ReviewerDimensionAssessment,
  evidenceReferences: readonly EvidenceReference[],
) {
  return [
    ...reviewerDimension.strengths.map((strength, index) => ({
      id: `finding:${reviewerDimension.dimension}:strength:${index}`,
      dimension: reviewerDimension.dimension,
      severity: "info" as const,
      title: `${titleForDimension(reviewerDimension.dimension)} strength`,
      summary: strength,
      confidence: reviewerDimension.confidence,
      evidenceReferences: [...evidenceReferences],
    })),
    ...reviewerDimension.risks.map((risk, index) => ({
      id: `finding:${reviewerDimension.dimension}:risk:${index}`,
      dimension: reviewerDimension.dimension,
      severity: severityForRisk(reviewerDimension.confidence),
      title: `${titleForDimension(reviewerDimension.dimension)} risk`,
      summary: risk,
      confidence: reviewerDimension.confidence,
      evidenceReferences: [...evidenceReferences],
    })),
  ];
}

function caveatIdsForDimension(
  reviewerDimension: ReviewerDimensionAssessment,
): string[] {
  return [
    reviewerDimension.confidence.level === "low"
      ? `caveat:${reviewerDimension.dimension}:low-confidence`
      : undefined,
    reviewerDimension.missingEvidence.length > 0
      ? `caveat:${reviewerDimension.dimension}:missing-evidence`
      : undefined,
  ].filter(isDefined);
}

function caveatsForDimension(
  dimension: ReportDimensionKey,
  reviewerDimension: ReviewerDimensionAssessment | undefined,
): ReportCaveat[] {
  if (reviewerDimension === undefined) {
    return [];
  }

  return [
    reviewerDimension.confidence.level === "low"
      ? {
          id: `caveat:${dimension}:low-confidence`,
          title: `Low-confidence ${dimension} assessment`,
          summary:
            "Reviewer confidence is low, so this dimension should be treated as a prompt for investigation rather than a quality judgment.",
          affectedDimensions: [dimension],
          missingEvidence: [],
        }
      : undefined,
    reviewerDimension.missingEvidence.length > 0
      ? {
          id: `caveat:${dimension}:missing-evidence`,
          title: `Missing ${dimension} evidence`,
          summary:
            "Missing evidence is represented as uncertainty, not as an automatic penalty.",
          affectedDimensions: [dimension],
          missingEvidence: [...reviewerDimension.missingEvidence],
        }
      : undefined,
  ].filter(isDefined);
}

function toReportCaveat(
  reviewerCaveat: ReviewerAssessment["caveats"][number],
): ReportCaveat {
  return {
    id: reviewerCaveat.id,
    title: reviewerCaveat.summary,
    summary: reviewerCaveat.summary,
    affectedDimensions: [...reviewerCaveat.affectedDimensions],
    missingEvidence: [...reviewerCaveat.missingEvidence],
  };
}

function toRecommendedQuestion(
  question: ReviewerAssessment["followUpQuestions"][number],
): RecommendedQuestion {
  return {
    id: question.id,
    question: question.question,
    targetDimension: question.targetDimension,
    rationale: question.rationale,
  };
}

function evidenceReferencesForDimension(
  reviewerDimension: ReviewerDimensionAssessment,
): readonly EvidenceReference[] {
  if (reviewerDimension.evidenceReferences.length > 0) {
    return reviewerDimension.evidenceReferences;
  }

  return [
    {
      id: `reviewer:${reviewerDimension.dimension}`,
      kind: "reviewer",
      label: `${titleForDimension(reviewerDimension.dimension)} reviewer assessment`,
      notes: "Reviewer did not cite deterministic evidence for this dimension.",
    },
  ];
}

function severityForRisk(confidence: Confidence): FindingSeverity {
  if (confidence.level === "high") {
    return "medium";
  }

  if (confidence.level === "medium") {
    return "low";
  }

  return "info";
}

function titleForDimension(dimension: ReportDimensionKey): string {
  return dimension
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}
