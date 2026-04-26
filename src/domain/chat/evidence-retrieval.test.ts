import { describe, expect, it } from "vitest";

import {
  retrieveEvidenceForFollowUp,
  type EvidenceContentSource,
} from "./evidence-retrieval";
import type {
  DimensionAssessment,
  ReportCard,
  ReportFinding,
} from "../report/report-card";
import type { EvidenceReference } from "../shared/evidence-reference";

const packageReference: EvidenceReference = {
  id: "evidence:package-json",
  kind: "file",
  label: "Package manifest",
  path: "package.json",
  lineStart: 2,
  lineEnd: 5,
};

const workflowReference: EvidenceReference = {
  id: "evidence:ci-workflow",
  kind: "file",
  label: "CI workflow",
  path: ".github/workflows/ci.yml",
};

const collectorReference: EvidenceReference = {
  id: "evidence:collector",
  kind: "collector",
  label: "Evidence collector summary",
  notes:
    "File inventory and omissions were collected without reading generated output.",
};

const securityFinding: ReportFinding = {
  id: "finding:security:risk:0",
  dimension: "security",
  severity: "high",
  title: "Secret-shaped token requires review",
  summary: "A bounded scan found a secret-shaped token.",
  confidence: {
    level: "high",
    score: 0.9,
    rationale: "Direct evidence supports the finding.",
  },
  evidenceReferences: [packageReference],
};

const securityAssessment: DimensionAssessment = {
  dimension: "security",
  title: "Security",
  summary: "Security has a high-risk finding.",
  rating: "weak",
  score: 45,
  confidence: {
    level: "high",
    score: 0.9,
    rationale: "Direct evidence supports the dimension.",
  },
  evidenceReferences: [collectorReference],
  findings: [securityFinding],
  caveatIds: ["caveat:security:manual-review"],
};

const operabilityAssessment: DimensionAssessment = {
  dimension: "operability",
  title: "Operability",
  summary: "CI evidence is present, but deployment history is missing.",
  rating: "fair",
  score: 64,
  confidence: {
    level: "medium",
    score: 0.64,
    rationale: "Workflow evidence is available.",
  },
  evidenceReferences: [workflowReference],
  findings: [],
  caveatIds: [],
};

const reportCard: ReportCard = {
  id: "report:repo-analyzer-green",
  schemaVersion: "report-card.v1",
  generatedAt: "2026-04-26T09:30:00-07:00",
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
    reviewedAt: "2026-04-26T09:30:00-07:00",
  },
  evidenceReferences: [packageReference, workflowReference, collectorReference],
  dimensionAssessments: [securityAssessment, operabilityAssessment],
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

const contentSource: EvidenceContentSource = {
  readEvidence: async (reference) => {
    if (reference.path === "package.json") {
      return {
        kind: "content",
        text: [
          "{",
          '  "scripts": {',
          '    "test": "vitest",',
          '    "lint": "oxlint ."',
          "  }",
          "}",
        ].join("\n"),
      };
    }

    if (reference.path === ".github/workflows/ci.yml") {
      return {
        kind: "content",
        text: [
          "name: CI",
          "jobs:",
          "  quality:",
          "    steps:",
          "      - run: pnpm test",
        ].join("\n"),
      };
    }

    return {
      kind: "missing",
      reason: "not available",
    };
  },
};

describe("retrieveEvidenceForFollowUp", () => {
  it("retrieves and ranks snippets connected to a finding target and question text", async () => {
    const result = await retrieveEvidenceForFollowUp({
      reportCard,
      target: {
        kind: "finding",
        findingId: "finding:security:risk:0",
        dimension: "security",
      },
      question: "Which package scripts should we review for secret risk?",
      contentSource,
    });

    expect(result.snippets[0]).toMatchObject({
      evidenceReference: packageReference,
      source: "fresh-content",
      targetRelevance: "finding",
    });
    expect(result.snippets[0]?.text).toContain('"test": "vitest"');
    expect(result.snippets[0]?.rank).toBeGreaterThan(
      result.snippets[1]?.rank ?? 0,
    );
  });

  it("retrieves dimension evidence and related finding evidence for a dimension target", async () => {
    const result = await retrieveEvidenceForFollowUp({
      reportCard,
      target: {
        kind: "dimension",
        dimension: "security",
      },
      question: "What evidence supports the security assessment?",
      contentSource,
    });

    expect(
      result.snippets.map((snippet) => snippet.evidenceReference.id),
    ).toEqual(["evidence:collector", "evidence:package-json"]);
    expect(result.snippets[0]?.source).toBe("saved-metadata");
    expect(result.snippets[0]?.text).toContain("File inventory");
  });

  it("uses saved metadata when fresh repository content is unavailable", async () => {
    const result = await retrieveEvidenceForFollowUp({
      reportCard,
      target: {
        kind: "evidence",
        evidenceReference: workflowReference,
      },
      question: "How does CI run tests?",
      contentSource: {
        readEvidence: async () => ({
          kind: "missing",
          reason: "repository snapshot was not saved",
        }),
      },
    });

    expect(result.snippets).toEqual([
      expect.objectContaining({
        evidenceReference: workflowReference,
        source: "saved-metadata",
        text: "CI workflow\n.github/workflows/ci.yml",
        targetRelevance: "evidence",
      }),
    ]);
    expect(result.missingContext).toEqual([
      {
        evidenceReference: workflowReference,
        reason: "repository snapshot was not saved",
      },
    ]);
  });

  it("falls back to report evidence for whole-report questions", async () => {
    const result = await retrieveEvidenceForFollowUp({
      reportCard,
      target: {
        kind: "report",
      },
      question: "What should we inspect first?",
      contentSource,
    });

    expect(result.snippets).toHaveLength(3);
    expect(
      result.snippets.map((snippet) => snippet.evidenceReference.id),
    ).toContain("evidence:ci-workflow");
  });
});
