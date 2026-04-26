import { describe, expect, it } from "vitest";

import type {
  DimensionAssessment,
  ReportCard,
  ReportFinding,
} from "../report/report-card";
import type { EvidenceReference } from "../shared/evidence-reference";
import { resolveConversationTarget } from "./conversation-target-resolver";

const packageManifestReference: EvidenceReference = {
  id: "evidence:package-json",
  kind: "file",
  label: "Package manifest",
  path: "package.json",
};

const securityFinding: ReportFinding = {
  id: "finding:security:risk:0",
  dimension: "security",
  severity: "high",
  title: "Secret-shaped token requires review",
  summary: "A bounded scan found an access-key-shaped token.",
  confidence: {
    level: "high",
    score: 0.9,
    rationale: "Direct file evidence supports the finding.",
  },
  evidenceReferences: [packageManifestReference],
};

const securityAssessment: DimensionAssessment = {
  dimension: "security",
  title: "Security",
  summary: "Security evidence has a high-risk finding.",
  rating: "weak",
  score: 45,
  confidence: {
    level: "high",
    score: 0.9,
    rationale: "Direct file evidence supports the dimension.",
  },
  evidenceReferences: [packageManifestReference],
  findings: [securityFinding],
  caveatIds: ["caveat:security:manual-review"],
};

const reportCard: ReportCard = {
  id: "report:repo-analyzer-green",
  schemaVersion: "report-card.v1",
  generatedAt: "2026-04-26T09:00:00-07:00",
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
    reviewedAt: "2026-04-26T09:00:00-07:00",
  },
  evidenceReferences: [packageManifestReference],
  dimensionAssessments: [securityAssessment],
  caveats: [
    {
      id: "caveat:security:manual-review",
      title: "Manual security review needed",
      summary: "Secret-shaped tokens require human review.",
      affectedDimensions: ["security"],
      missingEvidence: ["Secret scanning result"],
    },
  ],
  recommendedNextQuestions: [],
};

describe("resolveConversationTarget", () => {
  it("resolves the full report target", () => {
    expect(resolveConversationTarget(reportCard, { kind: "report" })).toEqual({
      kind: "resolved",
      target: {
        kind: "report",
      },
    });
  });

  it("resolves dimensions, findings, caveats, and evidence references from report identifiers", () => {
    expect(
      resolveConversationTarget(reportCard, {
        kind: "dimension",
        dimension: "security",
      }),
    ).toEqual({
      kind: "resolved",
      target: {
        kind: "dimension",
        dimension: "security",
      },
    });
    expect(
      resolveConversationTarget(reportCard, {
        kind: "finding",
        findingId: "finding:security:risk:0",
      }),
    ).toEqual({
      kind: "resolved",
      target: {
        kind: "finding",
        findingId: "finding:security:risk:0",
        dimension: "security",
      },
    });
    expect(
      resolveConversationTarget(reportCard, {
        kind: "caveat",
        caveatId: "caveat:security:manual-review",
      }),
    ).toEqual({
      kind: "resolved",
      target: {
        kind: "caveat",
        caveatId: "caveat:security:manual-review",
      },
    });
    expect(
      resolveConversationTarget(reportCard, {
        kind: "evidence",
        evidenceReferenceId: "evidence:package-json",
      }),
    ).toEqual({
      kind: "resolved",
      target: {
        kind: "evidence",
        evidenceReference: packageManifestReference,
      },
    });
  });

  it("rejects invalid target identifiers without manufacturing context", () => {
    expect(
      resolveConversationTarget(reportCard, {
        kind: "finding",
        findingId: "finding:missing",
      }),
    ).toEqual({
      kind: "invalid-target",
      reason: "finding-not-found",
      targetId: "finding:missing",
    });
    expect(
      resolveConversationTarget(reportCard, {
        kind: "evidence",
        evidenceReferenceId: "evidence:missing",
      }),
    ).toEqual({
      kind: "invalid-target",
      reason: "evidence-not-found",
      targetId: "evidence:missing",
    });
  });
});
