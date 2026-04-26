import { z } from "zod";

import type {
  DimensionAssessment,
  ReportCard,
  ReportCaveat,
  ReportDimensionKey,
  ReportFinding,
} from "../report/report-card";
import { ConversationTargetSchema } from "./conversation";

export const SuggestedQuestionSourceSchema = z.enum([
  "low-confidence-dimension",
  "high-risk-finding",
  "caveat",
]);

export type SuggestedQuestionSource = z.infer<
  typeof SuggestedQuestionSourceSchema
>;

export const SuggestedFollowUpQuestionSchema = z
  .object({
    id: z.string().min(1),
    question: z.string().min(1),
    rationale: z.string().min(1),
    source: SuggestedQuestionSourceSchema,
    target: ConversationTargetSchema,
  })
  .strict();

export type SuggestedFollowUpQuestion = z.infer<
  typeof SuggestedFollowUpQuestionSchema
>;

export function generateSuggestedFollowUpQuestions(
  reportCard: ReportCard,
): readonly SuggestedFollowUpQuestion[] {
  const assessedDimensions = new Set(
    reportCard.dimensionAssessments.map((assessment) => assessment.dimension),
  );
  const questions = [
    ...reportCard.dimensionAssessments
      .filter(isLowConfidenceDimension)
      .map(questionForLowConfidenceDimension),
    ...reportCard.dimensionAssessments.flatMap(questionForHighRiskFindings),
    ...reportCard.caveats
      .filter((caveat) =>
        hasAssessedAffectedDimension(caveat, assessedDimensions),
      )
      .map(questionForCaveat),
  ];

  return questions.map((question) =>
    SuggestedFollowUpQuestionSchema.parse(question),
  );
}

function isLowConfidenceDimension(assessment: DimensionAssessment): boolean {
  return (
    assessment.confidence.level === "low" ||
    assessment.rating === "not-assessed"
  );
}

function questionForLowConfidenceDimension(
  assessment: DimensionAssessment,
): SuggestedFollowUpQuestion {
  return {
    id: `suggested-question:dimension:${assessment.dimension}:low-confidence`,
    question: `What evidence would increase confidence in ${assessment.title}?`,
    rationale: assessment.confidence.rationale,
    source: "low-confidence-dimension",
    target: {
      kind: "dimension",
      dimension: assessment.dimension,
    },
  };
}

function questionForHighRiskFindings(
  assessment: DimensionAssessment,
): readonly SuggestedFollowUpQuestion[] {
  return assessment.findings
    .filter(isHighRiskFinding)
    .map((finding) =>
      questionForHighRiskFinding(finding, assessment.dimension),
    );
}

function isHighRiskFinding(finding: ReportFinding): boolean {
  return finding.severity === "high" || finding.severity === "critical";
}

function questionForHighRiskFinding(
  finding: ReportFinding,
  dimension: ReportDimensionKey,
): SuggestedFollowUpQuestion {
  return {
    id: `suggested-question:finding:${finding.id}`,
    question: `What should be done first about ${finding.title}?`,
    rationale: finding.summary,
    source: "high-risk-finding",
    target: {
      kind: "finding",
      findingId: finding.id,
      dimension,
    },
  };
}

function hasAssessedAffectedDimension(
  caveat: ReportCaveat,
  assessedDimensions: ReadonlySet<ReportDimensionKey>,
): boolean {
  return caveat.affectedDimensions.some((dimension) =>
    assessedDimensions.has(dimension),
  );
}

function questionForCaveat(caveat: ReportCaveat): SuggestedFollowUpQuestion {
  return {
    id: `suggested-question:caveat:${caveat.id}`,
    question: `What evidence is needed to resolve ${caveat.title}?`,
    rationale: caveat.summary,
    source: "caveat",
    target: {
      kind: "caveat",
      caveatId: caveat.id,
    },
  };
}
