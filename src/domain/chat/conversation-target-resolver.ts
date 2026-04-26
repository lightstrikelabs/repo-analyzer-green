import { z } from "zod";

import type { ReportCard, ReportDimensionKey } from "../report/report-card";
import { ReportDimensionKeySchema } from "../report/report-card";
import { ConversationTargetSchema } from "./conversation";
import type { ConversationTarget } from "./conversation";

export const ConversationTargetSelectorSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("report"),
    })
    .strict(),
  z
    .object({
      kind: z.literal("dimension"),
      dimension: ReportDimensionKeySchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal("finding"),
      findingId: z.string().min(1),
    })
    .strict(),
  z
    .object({
      kind: z.literal("caveat"),
      caveatId: z.string().min(1),
    })
    .strict(),
  z
    .object({
      kind: z.literal("evidence"),
      evidenceReferenceId: z.string().min(1),
    })
    .strict(),
]);

export type ConversationTargetSelector = z.infer<
  typeof ConversationTargetSelectorSchema
>;

export type InvalidConversationTargetReason =
  | "dimension-not-found"
  | "finding-not-found"
  | "caveat-not-found"
  | "evidence-not-found";

export type ResolveConversationTargetResult =
  | {
      readonly kind: "resolved";
      readonly target: ConversationTarget;
    }
  | {
      readonly kind: "invalid-target";
      readonly reason: InvalidConversationTargetReason;
      readonly targetId: string;
    };

export function resolveConversationTarget(
  reportCard: ReportCard,
  selector: ConversationTargetSelector,
): ResolveConversationTargetResult {
  switch (selector.kind) {
    case "report":
      return resolved({ kind: "report" });
    case "dimension":
      return resolveDimensionTarget(reportCard, selector.dimension);
    case "finding":
      return resolveFindingTarget(reportCard, selector.findingId);
    case "caveat":
      return resolveCaveatTarget(reportCard, selector.caveatId);
    case "evidence":
      return resolveEvidenceTarget(reportCard, selector.evidenceReferenceId);
  }
}

function resolveDimensionTarget(
  reportCard: ReportCard,
  dimension: ReportDimensionKey,
): ResolveConversationTargetResult {
  const assessment = reportCard.dimensionAssessments.find(
    (candidate) => candidate.dimension === dimension,
  );

  if (assessment === undefined) {
    return invalid("dimension-not-found", dimension);
  }

  return resolved({
    kind: "dimension",
    dimension,
  });
}

function resolveFindingTarget(
  reportCard: ReportCard,
  findingId: string,
): ResolveConversationTargetResult {
  for (const assessment of reportCard.dimensionAssessments) {
    const finding = assessment.findings.find(
      (candidate) => candidate.id === findingId,
    );

    if (finding !== undefined) {
      return resolved({
        kind: "finding",
        findingId,
        dimension: assessment.dimension,
      });
    }
  }

  return invalid("finding-not-found", findingId);
}

function resolveCaveatTarget(
  reportCard: ReportCard,
  caveatId: string,
): ResolveConversationTargetResult {
  const caveat = reportCard.caveats.find(
    (candidate) => candidate.id === caveatId,
  );

  if (caveat === undefined) {
    return invalid("caveat-not-found", caveatId);
  }

  return resolved({
    kind: "caveat",
    caveatId,
  });
}

function resolveEvidenceTarget(
  reportCard: ReportCard,
  evidenceReferenceId: string,
): ResolveConversationTargetResult {
  const evidenceReference = reportCard.evidenceReferences.find(
    (candidate) => candidate.id === evidenceReferenceId,
  );

  if (evidenceReference === undefined) {
    return invalid("evidence-not-found", evidenceReferenceId);
  }

  return resolved({
    kind: "evidence",
    evidenceReference,
  });
}

function resolved(target: ConversationTarget): ResolveConversationTargetResult {
  return {
    kind: "resolved",
    target: ConversationTargetSchema.parse(target),
  };
}

function invalid(
  reason: InvalidConversationTargetReason,
  targetId: string,
): ResolveConversationTargetResult {
  return {
    kind: "invalid-target",
    reason,
    targetId,
  };
}
