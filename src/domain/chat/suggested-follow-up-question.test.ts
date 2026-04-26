import { describe, expect, it } from "vitest";

import type {
  DimensionAssessment,
  ReportFinding,
  ReportCard,
} from "../report/report-card";
import type { EvidenceReference } from "../shared/evidence-reference";
import { generateSuggestedFollowUpQuestions } from "./suggested-follow-up-question";

const evidenceReference: EvidenceReference = {
  id: "evidence:ci-workflow",
  kind: "file",
  label: "CI workflow",
  path: ".github/workflows/ci.yml",
};

const operabilityAssessment: DimensionAssessment = {
  dimension: "operability",
  title: "Operability",
  summary: "Release and runtime evidence is limited.",
  rating: "not-assessed",
  confidence: {
    level: "low",
    score: 0.2,
    rationale: "No deployment or incident evidence was available.",
  },
  evidenceReferences: [evidenceReference],
  findings: [],
  caveatIds: ["caveat:operability:missing-evidence"],
};

const securityFinding: ReportFinding = {
  id: "finding:security:risk:0",
  dimension: "security",
  severity: "high",
  title: "Secret-shaped token requires review",
  summary:
    "A bounded scan found an access-key-shaped token without exposing the value.",
  confidence: {
    level: "high",
    score: 0.9,
    rationale: "The finding has direct file evidence.",
  },
  evidenceReferences: [evidenceReference],
};

const securityAssessment: DimensionAssessment = {
  dimension: "security",
  title: "Security",
  summary: "A secret-shaped token was found in a bounded scan.",
  rating: "weak",
  score: 45,
  confidence: {
    level: "high",
    score: 0.9,
    rationale: "The finding has direct file evidence.",
  },
  evidenceReferences: [evidenceReference],
  findings: [securityFinding],
  caveatIds: [],
};

const baseReportCard: ReportCard = {
  id: "report:repo-analyzer-green",
  schemaVersion: "report-card.v1",
  generatedAt: "2026-04-26T08:30:00-07:00",
  scoringPolicy: {
    name: "repo-analyzer-green scoring policy",
    version: "0.1.0",
  },
  repository: {
    provider: "github",
    owner: "lightstrikelabs",
    name: "repo-analyzer-green",
    url: "https://github.com/lightstrikelabs/repo-analyzer-green",
    revision: "main",
  },
  assessedArchetype: "web-app",
  reviewerMetadata: {
    kind: "fake",
    name: "Fixture reviewer",
    reviewedAt: "2026-04-26T08:30:00-07:00",
  },
  evidenceReferences: [evidenceReference],
  dimensionAssessments: [operabilityAssessment, securityAssessment],
  caveats: [
    {
      id: "caveat:operability:missing-evidence",
      title: "Missing operability evidence",
      summary: "No deployment or incident evidence was collected.",
      affectedDimensions: ["operability"],
      missingEvidence: ["Deployment history", "Incident history"],
    },
  ],
  recommendedNextQuestions: [],
};

describe("generateSuggestedFollowUpQuestions", () => {
  it("generates targeted questions from low-confidence dimensions, caveats, and high-risk findings", () => {
    const questions = generateSuggestedFollowUpQuestions(baseReportCard);

    expect(questions).toEqual([
      expect.objectContaining({
        id: "suggested-question:dimension:operability:low-confidence",
        target: {
          kind: "dimension",
          dimension: "operability",
        },
      }),
      expect.objectContaining({
        id: "suggested-question:finding:finding:security:risk:0",
        target: {
          kind: "finding",
          findingId: "finding:security:risk:0",
          dimension: "security",
        },
      }),
      expect.objectContaining({
        id: "suggested-question:caveat:caveat:operability:missing-evidence",
        target: {
          kind: "caveat",
          caveatId: "caveat:operability:missing-evidence",
        },
      }),
    ]);
    expect(questions.map((question) => question.question).join(" ")).toContain(
      "Operability",
    );
    expect(questions.map((question) => question.question).join(" ")).toContain(
      "Secret-shaped token requires review",
    );
  });

  it("does not generate caveat questions for report areas that are not assessed", () => {
    const questions = generateSuggestedFollowUpQuestions({
      ...baseReportCard,
      caveats: [
        {
          id: "caveat:documentation:missing-evidence",
          title: "Missing documentation evidence",
          summary: "No docs evidence was collected.",
          affectedDimensions: ["documentation"],
          missingEvidence: ["README"],
        },
      ],
    });

    expect(
      questions.some(
        (question) =>
          question.id ===
          "suggested-question:caveat:caveat:documentation:missing-evidence",
      ),
    ).toBe(false);
  });

  it("returns no questions when there is no low-confidence, high-risk, or caveated area", () => {
    const questions = generateSuggestedFollowUpQuestions({
      ...baseReportCard,
      dimensionAssessments: [
        {
          ...securityAssessment,
          findings: [
            {
              ...securityFinding,
              severity: "low",
            },
          ],
        },
      ],
      caveats: [],
    });

    expect(questions).toEqual([]);
  });
});
