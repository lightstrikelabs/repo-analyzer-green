import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { AnalyzeRepositoryResponse } from "../../application/analyze-repository/analyze-repository-response";
import type { ReportCard } from "../../domain/report/report-card";
import { ReportCardView } from "./report-card-view";
import { triggerPrint } from "./print-report-button";

const reportCard: ReportCard = {
  id: "report:minimal-node-library",
  schemaVersion: "report-card.v1",
  generatedAt: "2026-04-26T07:00:00-07:00",
  scoringPolicy: {
    name: "repo-analyzer-green scoring policy",
    version: "0.1.0",
  },
  repository: {
    provider: "local-fixture",
    name: "minimal-node-library",
    revision: "fixture",
  },
  assessedArchetype: "library",
  reviewerMetadata: {
    kind: "fake",
    name: "Fixture reviewer",
    reviewedAt: "2026-04-26T07:00:00-07:00",
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
      dimension: "verifiability",
      title: "Verifiability",
      summary: "A focused unit test exercises exported behavior.",
      rating: "good",
      score: 90,
      confidence: {
        level: "high",
        score: 0.9,
        rationale: "The fixture includes a deterministic unit test.",
      },
      evidenceReferences: [
        {
          id: "evidence:test-file",
          kind: "file",
          label: "Unit test file",
          path: "test/add.spec.ts",
        },
      ],
      findings: [
        {
          id: "finding:test-depth",
          dimension: "verifiability",
          severity: "info",
          title: "Test depth",
          summary: "The exported add function has a focused test.",
          confidence: {
            level: "high",
            score: 0.9,
            rationale: "The test file directly supports this finding.",
          },
          evidenceReferences: [
            {
              id: "evidence:test-file",
              kind: "file",
              label: "Unit test file",
              path: "test/add.spec.ts",
            },
          ],
        },
      ],
      caveatIds: ["caveat:limited-fixture"],
    },
  ],
  caveats: [
    {
      id: "caveat:limited-fixture",
      title: "Limited fixture evidence",
      summary: "Release and incident history are unavailable.",
      affectedDimensions: ["operability", "verifiability"],
      missingEvidence: ["Release workflow history", "Incident history"],
    },
  ],
  recommendedNextQuestions: [
    {
      id: "question:release-process",
      question: "How is this package released and verified?",
      targetDimension: "operability",
      rationale: "Release readiness is not visible in the fixture.",
    },
  ],
};

const analysis: AnalyzeRepositoryResponse = {
  reportCard,
  dashboardInsights: {
    evidenceSummary:
      "Files analyzed: 3. Source files: 1. Test files: 1. Documentation files: 1.",
    languageMix: [
      {
        language: "TypeScript",
        fileCount: 2,
        sourceFileCount: 1,
        textLineCount: 16,
        codeLineCount: 12,
        percentOfCode: 80,
        evidenceReferenceIds: ["language-code-shape:file:src/add.ts"],
      },
      {
        language: "Markdown",
        fileCount: 1,
        sourceFileCount: 0,
        textLineCount: 4,
        codeLineCount: 3,
        percentOfCode: 20,
        evidenceReferenceIds: ["language-code-shape:file:README.md"],
      },
    ],
    codeShapeSummary: {
      analyzedFileCount: 3,
      sourceFileCount: 1,
      testFileCount: 1,
      documentationFileCount: 1,
      largeFileCount: 0,
      skippedFileCount: 0,
      unsupportedFileCount: 0,
      totalTextLineCount: 20,
      totalCodeLineCount: 15,
      totalDeferredWorkMarkerCount: 0,
      totalBranchLikeTokenCount: 1,
    },
  },
};

describe("ReportCardView", () => {
  it("renders dashboard summary, language mix, dimensions, findings, caveats, missing evidence, and evidence references", () => {
    const html = renderToStaticMarkup(<ReportCardView analysis={analysis} />);

    expect(html).toContain("minimal-node-library");
    expect(html).toContain("library");
    expect(html).toContain("Report overview");
    expect(html).toContain("Language Mix");
    expect(html).toContain("TypeScript");
    expect(html).toContain("80% of code");
    expect(html).toContain("Reviewer Notes");
    expect(html).toContain("Dimensions");
    expect(html).toContain("Verifiability");
    expect(html).toContain("good");
    expect(html).toContain("high confidence");
    expect(html).toContain("Dimension score");
    expect(html).toContain("Test depth");
    expect(html).toContain("Limited fixture evidence");
    expect(html).toContain("Release workflow history");
    expect(html).toContain("evidence:test-file");
    expect(html).toContain("How is this package released and verified?");
  });

  it("renders a Download PDF button so users can export the report", () => {
    const html = renderToStaticMarkup(<ReportCardView analysis={analysis} />);

    expect(html).toContain("Download PDF");
  });

  it("hides the Download PDF button itself from the printed output", () => {
    const html = renderToStaticMarkup(<ReportCardView analysis={analysis} />);

    expect(html).toMatch(
      /<button[^>]*class="[^"]*print:hidden[^"]*"[^>]*>Download PDF<\/button>/,
    );
  });

  it("invokes the native print flow when requested", () => {
    const print = vi.fn();
    vi.stubGlobal("window", { print });

    triggerPrint();

    expect(print).toHaveBeenCalledOnce();
    vi.unstubAllGlobals();
  });

  it("excludes the follow-up chat from the printed output", () => {
    const html = renderToStaticMarkup(<ReportCardView analysis={analysis} />);

    expect(html).toMatch(
      /<section[^>]*aria-labelledby="follow-up-panel-title"[^>]*class="[^"]*print:hidden[^"]*"/,
    );
  });

  it("does not collapse the report into a single overall score", () => {
    const html = renderToStaticMarkup(<ReportCardView analysis={analysis} />);

    expect(html).not.toContain("Overall score");
    expect(html).not.toContain("Total score");
  });

  it("renders explicit empty states when language mix and caveats are absent", () => {
    const html = renderToStaticMarkup(
      <ReportCardView
        analysis={{
          ...analysis,
          reportCard: {
            ...reportCard,
            caveats: [],
          },
          dashboardInsights: {
            ...analysis.dashboardInsights,
            languageMix: [],
          },
        }}
      />,
    );

    expect(html).toContain(
      "No language mix was available in the collected evidence.",
    );
    expect(html).toContain("No caveats were reported.");
  });
});
