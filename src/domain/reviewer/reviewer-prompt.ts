import type { RepositoryIdentity } from "../report/report-card";
import type { EvidenceReference } from "../shared/evidence-reference";

import { ReviewerAssessmentSchemaVersion } from "./reviewer-assessment";

export type ReviewerPromptInput = {
  readonly repository: RepositoryIdentity;
  readonly evidenceReferences: readonly EvidenceReference[];
  readonly evidenceSummary?: string;
  readonly maxEvidenceSummaryCharacters?: number;
};

export type ReviewerPromptMessage = {
  readonly role: "system" | "user";
  readonly content: string;
};

export type ReviewerPrompt = {
  readonly system: string;
  readonly user: string;
  readonly responseContractJson: string;
  readonly messages: readonly ReviewerPromptMessage[];
};

const defaultMaxEvidenceSummaryCharacters = 12_000;

const requiredDimensions = [
  "architecture-boundaries",
  "maintainability",
  "verifiability",
  "security",
  "operability",
  "documentation",
] as const;

export function renderReviewerPrompt(
  input: ReviewerPromptInput,
): ReviewerPrompt {
  const responseContractJson = JSON.stringify(responseContract());
  const system = [
    "You are a repository quality reviewer for Repo Analyzer Green.",
    "Return only JSON. Do not wrap the response in Markdown or explanatory prose.",
    `The JSON must match schemaVersion ${ReviewerAssessmentSchemaVersion}.`,
    "Use only the supplied repository evidence and evidence summary.",
    "Do not make unsupported claims. If evidence is absent, record missingEvidence and lower confidence.",
    "Missing evidence is not a defect and must not be treated as an automatic quality penalty.",
    "Static metrics are evidence, not final judgments.",
    "Security hygiene signals are indicators that require review, not confirmed vulnerabilities.",
    "Every dimension assessment must cite evidenceReferences when evidence exists, or explain missingEvidence when it does not.",
    "When citing evidenceReferences, copy complete EvidenceReference objects from the input. Do not return string ids.",
    `Assess these dimensions exactly: ${requiredDimensions.join(", ")}.`,
    "Include caveats for low confidence, unavailable evidence, unsupported ecosystems, bounded scans, and provider limitations.",
    "Include follow-up questions tied to uncertainty or risk, not generic advice.",
    "Use confidence.score between 0 and 1 and confidence.level as low, medium, or high.",
    "Every confidence object must include a rationale string.",
    "Use concise strings. Preserve ids inside copied evidence reference objects exactly as supplied.",
    `Response contract JSON example: ${responseContractJson}`,
  ].join("\n");
  const user = [
    `Repository: ${repositoryLabel(input.repository)}`,
    "",
    "Evidence Summary:",
    boundedEvidenceSummary(input),
    "",
    "Evidence References:",
    ...input.evidenceReferences.map(formatEvidenceReference),
  ].join("\n");

  return {
    system,
    user,
    responseContractJson,
    messages: [
      {
        role: "system",
        content: system,
      },
      {
        role: "user",
        content: user,
      },
    ],
  };
}

function responseContract() {
  return {
    schemaVersion: ReviewerAssessmentSchemaVersion,
    reviewer: {
      kind: "llm",
      name: "string",
      reviewerVersion: "string",
      modelProvider: "string",
      modelName: "string",
      modelVersion: "string",
      reviewedAt: "ISO-8601 datetime with offset",
    },
    assessedArchetype: {
      value:
        "web-app | cli | library | service | infrastructure | docs-heavy | research-notebook | generated-sdk | embedded | unknown",
      confidence: {
        level: "low | medium | high",
        score: 0.5,
        rationale: "string",
      },
      evidenceReferences: [
        {
          id: "evidence:id",
          kind: "file | collector | reviewer | derived",
          label: "string",
          path: "optional/path.ext",
          lineStart: 1,
          lineEnd: 1,
          notes: "optional notes",
        },
      ],
      rationale: "string",
    },
    dimensions: requiredDimensions.map((dimension) => ({
      dimension,
      summary: "string",
      confidence: {
        level: "low | medium | high",
        score: 0.5,
        rationale: "string",
      },
      evidenceReferences: [
        {
          id: "evidence:id",
          kind: "file | collector | reviewer | derived",
          label: "string",
          path: "optional/path.ext",
          lineStart: 1,
          lineEnd: 1,
          notes: "optional notes",
        },
      ],
      strengths: ["evidence-backed strength"],
      risks: ["evidence-backed risk"],
      missingEvidence: ["evidence that would change confidence"],
    })),
    caveats: [
      {
        id: "caveat:dimension:reason",
        summary: "string",
        affectedDimensions: ["maintainability"],
        missingEvidence: ["string"],
        confidence: {
          level: "low | medium | high",
          score: 0.5,
          rationale: "string",
        },
        evidenceReferences: [
          {
            id: "evidence:id",
            kind: "file | collector | reviewer | derived",
            label: "string",
            path: "optional/path.ext",
            lineStart: 1,
            lineEnd: 1,
            notes: "optional notes",
          },
        ],
      },
    ],
    followUpQuestions: [
      {
        id: "question:short-slug",
        question: "string",
        targetDimension: "maintainability",
        rationale: "why this question addresses uncertainty or risk",
      },
    ],
  };
}

function boundedEvidenceSummary(input: ReviewerPromptInput): string {
  const summary = input.evidenceSummary?.trim();

  if (summary === undefined || summary === "") {
    return "No evidence summary was provided. Use evidence references and mark missing context where needed.";
  }

  const maxCharacters =
    input.maxEvidenceSummaryCharacters ?? defaultMaxEvidenceSummaryCharacters;

  if (summary.length <= maxCharacters) {
    return summary;
  }

  return `${summary.slice(0, maxCharacters)}\n[Evidence summary truncated at ${maxCharacters} characters.]`;
}

function repositoryLabel(repository: RepositoryIdentity): string {
  const ownerPrefix =
    repository.owner === undefined ? "" : `${repository.owner}/`;
  const revisionSuffix =
    repository.revision === undefined ? "" : ` @ ${repository.revision}`;

  return `${repository.provider}:${ownerPrefix}${repository.name}${revisionSuffix}`;
}

function formatEvidenceReference(reference: EvidenceReference): string {
  const path = reference.path === undefined ? "" : ` path=${reference.path}`;
  const notes =
    reference.notes === undefined ? "" : ` notes=${reference.notes}`;
  const lineRange =
    reference.lineStart === undefined
      ? ""
      : ` lines=${reference.lineStart}-${reference.lineEnd ?? reference.lineStart}`;

  return `- id=${reference.id} kind=${reference.kind} label=${reference.label}${path}${lineRange}${notes}`;
}
