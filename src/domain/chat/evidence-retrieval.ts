import type { ConversationTarget } from "./conversation";
import type {
  DimensionAssessment,
  ReportCard,
  ReportFinding,
} from "../report/report-card";
import type { EvidenceReference } from "../shared/evidence-reference";

export type EvidenceContentResult =
  | {
      readonly kind: "content";
      readonly text: string;
    }
  | {
      readonly kind: "missing";
      readonly reason: string;
    };

export interface EvidenceContentSource {
  readEvidence(reference: EvidenceReference): Promise<EvidenceContentResult>;
}

export type RetrievedEvidenceSource = "fresh-content" | "saved-metadata";

export type EvidenceTargetRelevance =
  | "report"
  | "dimension"
  | "finding"
  | "caveat"
  | "evidence";

export type RetrievedEvidenceSnippet = {
  readonly evidenceReference: EvidenceReference;
  readonly text: string;
  readonly source: RetrievedEvidenceSource;
  readonly targetRelevance: EvidenceTargetRelevance;
  readonly rank: number;
  readonly lineStart?: number;
  readonly lineEnd?: number;
};

export type MissingEvidenceContext = {
  readonly evidenceReference: EvidenceReference;
  readonly reason: string;
};

export type RetrieveEvidenceForFollowUpInput = {
  readonly reportCard: ReportCard;
  readonly target: ConversationTarget;
  readonly question: string;
  readonly contentSource?: EvidenceContentSource;
  readonly maxSnippets?: number;
};

export type RetrieveEvidenceForFollowUpResult = {
  readonly snippets: readonly RetrievedEvidenceSnippet[];
  readonly missingContext: readonly MissingEvidenceContext[];
};

type CandidateEvidence = {
  readonly evidenceReference: EvidenceReference;
  readonly targetRelevance: EvidenceTargetRelevance;
  readonly priority: number;
};

const defaultMaxSnippets = 6;

export async function retrieveEvidenceForFollowUp(
  input: RetrieveEvidenceForFollowUpInput,
): Promise<RetrieveEvidenceForFollowUpResult> {
  const candidates = uniqueCandidates(candidatesForTarget(input));
  const missingContext: MissingEvidenceContext[] = [];
  const snippets = await Promise.all(
    candidates.map(async (candidate) => {
      const freshContent = await readFreshContent(
        candidate.evidenceReference,
        input.contentSource,
      );

      if (freshContent.kind === "missing") {
        missingContext.push({
          evidenceReference: candidate.evidenceReference,
          reason: freshContent.reason,
        });
      }

      return snippetForCandidate({
        candidate,
        question: input.question,
        freshContent:
          freshContent.kind === "content" ? freshContent.text : undefined,
      });
    }),
  );

  return {
    snippets: snippets
      .toSorted((left, right) => right.rank - left.rank)
      .slice(0, input.maxSnippets ?? defaultMaxSnippets),
    missingContext,
  };
}

function candidatesForTarget(
  input: RetrieveEvidenceForFollowUpInput,
): readonly CandidateEvidence[] {
  switch (input.target.kind) {
    case "report":
      return input.reportCard.evidenceReferences.map((reference) => ({
        evidenceReference: reference,
        targetRelevance: "report",
        priority: 20,
      }));
    case "dimension":
      return candidatesForDimension(input.reportCard, input.target.dimension);
    case "finding":
      return candidatesForFinding(input.reportCard, input.target.findingId);
    case "caveat":
      return candidatesForCaveat(input.reportCard, input.target.caveatId);
    case "evidence":
      return [
        {
          evidenceReference: input.target.evidenceReference,
          targetRelevance: "evidence",
          priority: 100,
        },
      ];
  }
}

function candidatesForDimension(
  reportCard: ReportCard,
  dimension: DimensionAssessment["dimension"],
): readonly CandidateEvidence[] {
  const assessment = reportCard.dimensionAssessments.find(
    (candidate) => candidate.dimension === dimension,
  );

  if (assessment === undefined) {
    return [];
  }

  return [
    ...assessment.evidenceReferences.map((reference) => ({
      evidenceReference: reference,
      targetRelevance: "dimension" as const,
      priority: 90,
    })),
    ...assessment.findings.flatMap((finding) =>
      finding.evidenceReferences.map((reference) => ({
        evidenceReference: reference,
        targetRelevance: "finding" as const,
        priority: 70,
      })),
    ),
  ];
}

function candidatesForFinding(
  reportCard: ReportCard,
  findingId: string,
): readonly CandidateEvidence[] {
  const finding = findReportFinding(reportCard, findingId);

  if (finding === undefined) {
    return [];
  }

  return finding.evidenceReferences.map((reference) => ({
    evidenceReference: reference,
    targetRelevance: "finding",
    priority: 100,
  }));
}

function candidatesForCaveat(
  reportCard: ReportCard,
  caveatId: string,
): readonly CandidateEvidence[] {
  const caveat = reportCard.caveats.find(
    (candidate) => candidate.id === caveatId,
  );

  if (caveat === undefined) {
    return [];
  }

  return reportCard.dimensionAssessments
    .filter((assessment) =>
      caveat.affectedDimensions.includes(assessment.dimension),
    )
    .flatMap((assessment) =>
      assessment.evidenceReferences.map((reference) => ({
        evidenceReference: reference,
        targetRelevance: "caveat" as const,
        priority: 80,
      })),
    );
}

function findReportFinding(
  reportCard: ReportCard,
  findingId: string,
): ReportFinding | undefined {
  for (const assessment of reportCard.dimensionAssessments) {
    const finding = assessment.findings.find(
      (candidate) => candidate.id === findingId,
    );

    if (finding !== undefined) {
      return finding;
    }
  }

  return undefined;
}

async function readFreshContent(
  reference: EvidenceReference,
  contentSource: EvidenceContentSource | undefined,
): Promise<EvidenceContentResult> {
  if (contentSource === undefined || reference.kind !== "file") {
    return {
      kind: "missing",
      reason: "fresh repository content source was not provided",
    };
  }

  return contentSource.readEvidence(reference);
}

function snippetForCandidate(input: {
  readonly candidate: CandidateEvidence;
  readonly question: string;
  readonly freshContent: string | undefined;
}): RetrievedEvidenceSnippet {
  const text =
    input.freshContent === undefined
      ? metadataTextFor(input.candidate.evidenceReference)
      : snippetTextFor(input.candidate.evidenceReference, input.freshContent);
  const questionScore = questionMatchScore(input.question, text);

  return {
    evidenceReference: input.candidate.evidenceReference,
    text,
    source:
      input.freshContent === undefined ? "saved-metadata" : "fresh-content",
    targetRelevance: input.candidate.targetRelevance,
    rank: input.candidate.priority + questionScore,
    ...(input.candidate.evidenceReference.lineStart === undefined
      ? {}
      : { lineStart: input.candidate.evidenceReference.lineStart }),
    ...(input.candidate.evidenceReference.lineEnd === undefined
      ? {}
      : { lineEnd: input.candidate.evidenceReference.lineEnd }),
  };
}

function snippetTextFor(reference: EvidenceReference, text: string): string {
  const lines = text.split(/\r?\n/);

  if (reference.lineStart !== undefined) {
    const startIndex = reference.lineStart - 1;
    const endIndex = reference.lineEnd ?? reference.lineStart;
    return lines.slice(startIndex, endIndex).join("\n");
  }

  return lines.slice(0, 12).join("\n");
}

function metadataTextFor(reference: EvidenceReference): string {
  return [reference.label, reference.path, reference.notes]
    .filter(isDefined)
    .join("\n");
}

function questionMatchScore(question: string, text: string): number {
  const haystack = text.toLocaleLowerCase();

  return tokensFor(question).reduce(
    (score, token) => score + (haystack.includes(token) ? 5 : 0),
    0,
  );
}

function tokensFor(text: string): readonly string[] {
  return text
    .toLocaleLowerCase()
    .split(/[^a-z0-9]+/u)
    .filter((token) => token.length >= 4);
}

function uniqueCandidates(
  candidates: readonly CandidateEvidence[],
): readonly CandidateEvidence[] {
  const byId = new Map<string, CandidateEvidence>();

  for (const candidate of candidates) {
    const existing = byId.get(candidate.evidenceReference.id);

    if (existing === undefined || candidate.priority > existing.priority) {
      byId.set(candidate.evidenceReference.id, candidate);
    }
  }

  return [...byId.values()];
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}
