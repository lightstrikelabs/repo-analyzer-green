import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { AnalyzeRepositoryResponse } from "../../application/analyze-repository/analyze-repository-response";
import type { ReportCard } from "../../domain/report/report-card";
import { FollowUpPanel } from "./follow-up-panel";

const reportCard: ReportCard = {
  id: "report:repo-analyzer-green",
  schemaVersion: "report-card.v1",
  generatedAt: "2026-04-26T11:00:00-07:00",
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
    reviewedAt: "2026-04-26T11:00:00-07:00",
  },
  evidenceReferences: [
    {
      id: "evidence:package-json",
      kind: "file",
      label: "Package manifest",
      path: "package.json",
    },
  ],
  dimensionAssessments: [
    {
      dimension: "security",
      title: "Security",
      summary: "Package scripts should be reviewed.",
      rating: "weak",
      score: 45,
      confidence: {
        level: "high",
        score: 0.9,
        rationale: "Direct evidence supports the assessment.",
      },
      evidenceReferences: [
        {
          id: "evidence:package-json",
          kind: "file",
          label: "Package manifest",
          path: "package.json",
        },
      ],
      findings: [
        {
          id: "finding:security:risk:0",
          dimension: "security",
          severity: "high",
          title: "Script review",
          summary: "Package scripts need review before release.",
          confidence: {
            level: "high",
            score: 0.9,
            rationale: "The manifest provides direct evidence.",
          },
          evidenceReferences: [
            {
              id: "evidence:package-json",
              kind: "file",
              label: "Package manifest",
              path: "package.json",
            },
          ],
        },
      ],
      caveatIds: ["caveat:security:manual-review"],
    },
  ],
  caveats: [
    {
      id: "caveat:security:manual-review",
      title: "Manual security review needed",
      summary: "Review the package scripts before shipping.",
      affectedDimensions: ["security"],
      missingEvidence: ["Secret scanning result"],
    },
  ],
  recommendedNextQuestions: [
    {
      id: "question:release-process",
      question: "How is this package released?",
      rationale: "Release readiness is not visible from the manifest alone.",
      targetDimension: "security",
    },
  ],
};

const analysis: AnalyzeRepositoryResponse = {
  reportCard,
  dashboardInsights: {
    evidenceSummary: "Files analyzed: 3. Source files: 1. Test files: 1.",
    languageMix: [
      {
        language: "TypeScript",
        fileCount: 2,
        sourceFileCount: 1,
        textLineCount: 12,
        codeLineCount: 10,
        percentOfCode: 80,
        evidenceReferenceIds: ["evidence:package-json"],
      },
    ],
    codeShapeSummary: {
      analyzedFileCount: 3,
      sourceFileCount: 1,
      testFileCount: 1,
      documentationFileCount: 0,
      largeFileCount: 0,
      skippedFileCount: 0,
      unsupportedFileCount: 0,
      totalTextLineCount: 12,
      totalCodeLineCount: 10,
      totalDeferredWorkMarkerCount: 0,
      totalBranchLikeTokenCount: 0,
    },
  },
};

describe("FollowUpPanel", () => {
  it("renders target shortcuts, suggested questions, and an empty conversation state", () => {
    const html = renderToStaticMarkup(<FollowUpPanel analysis={analysis} />);

    expect(html).toContain("Follow-up");
    expect(html).toContain("Ask about report");
    expect(html).toContain("Ask about Security");
    expect(html).toContain("Ask about Script review");
    expect(html).toContain("Ask about Manual security review needed");
    expect(html).toContain("Ask about Package manifest");
    expect(html).toContain("Suggested Questions");
    expect(html).toContain("How is this package released?");
    expect(html).toContain("No conversation selected");
    expect(html).toContain("Ask a question to start a thread.");
  });
});
