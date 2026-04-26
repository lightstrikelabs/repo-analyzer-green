import type { ReportDimensionKey } from "../../domain/report/report-card";
import type {
  Reviewer,
  ReviewerRequest,
  ReviewerResult,
} from "../../domain/reviewer/reviewer";
import { ReviewerAssessmentSchemaVersion } from "../../domain/reviewer/reviewer-assessment";
import type { EvidenceReference } from "../../domain/shared/evidence-reference";

export type StaticEvidenceReviewerOptions = {
  readonly now?: () => Date;
};

export class StaticEvidenceReviewer implements Reviewer {
  private readonly now: () => Date;

  constructor(options: StaticEvidenceReviewerOptions = {}) {
    this.now = options.now ?? (() => new Date());
  }

  async assess(request: ReviewerRequest): Promise<ReviewerResult> {
    const evidenceReferences = evidenceReferencesFor(request);

    return {
      kind: "assessment",
      assessment: {
        schemaVersion: ReviewerAssessmentSchemaVersion,
        reviewer: {
          kind: "automated",
          name: "Static evidence reviewer",
          reviewerVersion: "static-evidence-reviewer.v1",
          reviewedAt: this.now().toISOString(),
        },
        assessedArchetype: {
          value: "unknown",
          confidence: {
            level: "medium",
            score: 0.55,
            rationale:
              "The static reviewer does not infer a project archetype beyond collected evidence.",
          },
          evidenceReferences: [...evidenceReferences],
          rationale:
            "No LLM reviewer key was supplied, so the report uses deterministic evidence-only interpretation.",
        },
        dimensions: dimensionsFor(request, evidenceReferences),
        caveats: [
          {
            id: "caveat:static-reviewer",
            summary:
              "No OpenRouter key was supplied, so semantic reviewer interpretation is limited to deterministic evidence.",
            affectedDimensions: [
              "maintainability",
              "verifiability",
              "security",
              "architecture-boundaries",
              "documentation",
            ],
            missingEvidence: [
              "Structured LLM or human reviewer assessment",
              "Repository-specific semantic interpretation",
            ],
            confidence: {
              level: "medium",
              score: 0.6,
              rationale:
                "Static evidence can identify surface signals but cannot fully evaluate intent or design quality.",
            },
            evidenceReferences: [...evidenceReferences],
          },
        ],
        followUpQuestions: [
          {
            id: "question:static-reviewer:first-fix",
            question: "What should we inspect first?",
            targetDimension: "maintainability",
            rationale:
              "The deterministic report should be followed by targeted review of the riskiest maintainability signals.",
          },
          {
            id: "question:static-reviewer:test-risk",
            question: "Which user-facing workflow is least protected by tests?",
            targetDimension: "verifiability",
            rationale:
              "Static test counts need follow-up to determine whether critical behavior is actually covered.",
          },
        ],
      },
    };
  }
}

function dimensionsFor(
  request: ReviewerRequest,
  evidenceReferences: readonly EvidenceReference[],
) {
  return [
    dimension({
      key: "maintainability",
      summary:
        "Static evidence was collected for file inventory, code shape, and deferred-work signals.",
      strength:
        "Repository structure and code-shape evidence are available for maintainability review.",
      risk: "Static metrics cannot determine whether module boundaries match product responsibilities.",
      request,
      evidenceReferences,
    }),
    dimension({
      key: "verifiability",
      summary:
        "Static evidence was collected for test files, scripts, and workflow signals.",
      strength:
        "Test and workflow evidence can identify whether a verification path exists.",
      risk: "Test presence does not prove meaningful behavioral coverage.",
      request,
      evidenceReferences,
    }),
    dimension({
      key: "security",
      summary:
        "Static evidence was collected for dependency, lockfile, environment, and secret-risk signals.",
      strength:
        "Security hygiene evidence can flag obvious repository-level risks.",
      risk: "Static scanning cannot replace manual review of auth, data access, and secret handling.",
      request,
      evidenceReferences,
    }),
    dimension({
      key: "architecture-boundaries",
      summary:
        "Static evidence was collected for project shape, directories, manifests, and source distribution.",
      strength:
        "Project structure evidence can show whether boundaries are visible.",
      risk: "Architecture quality still requires semantic review of ownership and data flow.",
      request,
      evidenceReferences,
    }),
    dimension({
      key: "documentation",
      summary:
        "Static evidence was collected for README, documentation files, and setup-related metadata.",
      strength:
        "Documentation inventory evidence can identify onboarding materials.",
      risk: "Documentation presence does not prove that setup or operations guidance is accurate.",
      request,
      evidenceReferences,
    }),
  ];
}

function dimension(options: {
  readonly key: ReportDimensionKey;
  readonly summary: string;
  readonly strength: string;
  readonly risk: string;
  readonly request: ReviewerRequest;
  readonly evidenceReferences: readonly EvidenceReference[];
}) {
  return {
    dimension: options.key,
    summary: `${options.summary} ${summarySentence(options.request)}`,
    confidence: {
      level: "medium" as const,
      score: 0.72,
      rationale:
        "The assessment is based on deterministic repository evidence without semantic reviewer enrichment.",
    },
    evidenceReferences: [...options.evidenceReferences],
    strengths: [options.strength],
    risks: [options.risk],
    missingEvidence: ["Structured reviewer assessment"],
  };
}

function evidenceReferencesFor(
  request: ReviewerRequest,
): readonly EvidenceReference[] {
  if (request.evidenceReferences.length > 0) {
    return request.evidenceReferences;
  }

  return [
    {
      id: "reviewer:static-evidence",
      kind: "reviewer",
      label: "Static evidence reviewer",
      notes:
        "No deterministic evidence references were supplied to the static reviewer.",
    },
  ];
}

function summarySentence(request: ReviewerRequest): string {
  return request.evidenceSummary === undefined
    ? "No evidence summary was available."
    : request.evidenceSummary;
}
