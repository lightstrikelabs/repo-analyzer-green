import { describe, expect, it } from "vitest";

import type { AnalyzeRepositoryResponse } from "../analyze-repository/analyze-repository-response";
import type {
  DimensionAssessment,
  ReportCard,
  ReportDimensionKey,
} from "../../domain/report/report-card";
import { buildReportDashboardViewModel } from "./report-dashboard-view-model";

const generatedAt = "2026-04-26T07:00:00-07:00";
const reviewedAt = "2026-04-26T06:59:00-07:00";

describe("buildReportDashboardViewModel", () => {
  it("adapts a complete report into red-compatible overview, big numbers, languages, notes, and sections", () => {
    const viewModel = buildReportDashboardViewModel(completeAnalysis());

    expect(viewModel.overview).toMatchObject({
      repositoryLabel: "github:lightstrikelabs/repo-analyzer-green @ abc123",
      analyzedAt: generatedAt,
      reviewerNote: "Fixture reviewer reviewed this report",
      overallScore: 80,
      grade: "B",
      summary:
        "Files analyzed: 24. Source files: 10. Test files: 4. Documentation files: 2.",
    });
    expect(viewModel.bigNumbers).toEqual([
      {
        id: "overall-score",
        label: "Overall Score",
        value: "80",
        detail: "Average of 5 scored dashboard sections",
        provenance: { source: "report-card", referenceIds: [] },
      },
      {
        id: "source-files",
        label: "Source Files",
        value: "10",
        detail: "Files classified as source evidence",
        provenance: { source: "code-shape-summary", referenceIds: [] },
      },
      {
        id: "code-lines",
        label: "Code Lines",
        value: "1,000",
        detail: "Evidence-backed code line count",
        provenance: { source: "code-shape-summary", referenceIds: [] },
      },
      {
        id: "test-ratio",
        label: "Test Ratio",
        value: "40%",
        detail: "4 test files for 10 source files",
        provenance: { source: "code-shape-summary", referenceIds: [] },
      },
    ]);
    expect(viewModel.languageSlices).toEqual([
      {
        language: "TypeScript",
        percentOfCode: 80,
        codeLineCount: 800,
        fileCount: 10,
        color: "#146c60",
        provenance: {
          source: "language-mix",
          referenceIds: ["language-code-shape:file:src/app.ts"],
        },
      },
      {
        language: "Markdown",
        percentOfCode: 20,
        codeLineCount: 200,
        fileCount: 2,
        color: "#d97706",
        provenance: {
          source: "language-mix",
          referenceIds: ["language-code-shape:file:README.md"],
        },
      },
    ]);
    expect(viewModel.reviewerNotes.map((note) => note.text)).toEqual([
      "Bounded modules keep the API surface easy to review.",
      "Focused tests cover the main workflow.",
      "Add dependency audit evidence before relying on the security rating.",
      "Document deployment assumptions.",
    ]);
    expect(viewModel.reviewerNotes[0]?.provenance.referenceIds).toEqual([
      "evidence:architecture",
    ]);

    expect(viewModel.sections.map((section) => section.id)).toEqual([
      "maintainability",
      "testing",
      "security",
      "architecture",
      "documentation",
    ]);
    expect(viewModel.sections[1]).toMatchObject({
      id: "testing",
      title: "Testing",
      sourceDimension: "verifiability",
      status: "assessed",
      score: 86,
      rating: "good",
      confidenceLabel: "high confidence",
      summary: "Tests exercise the main repository-analysis workflow.",
      metrics: [
        { label: "Score", value: "86", detail: "Dimension score" },
        { label: "Findings", value: "1", detail: "Reviewer signals" },
        { label: "Evidence", value: "1", detail: "Structured references" },
      ],
      highlights: ["Focused tests cover the main workflow."],
      risks: [],
      nextChecks: [],
      chartPoints: [
        { label: "Score", value: 86 },
        { label: "Confidence", value: 92 },
        { label: "Evidence", value: 25 },
        { label: "Risk", value: 0 },
      ],
    });
  });

  it("keeps required dashboard sections visible when dimensions are missing", () => {
    const analysis = completeAnalysis({
      dimensionAssessments: [dimension("maintainability", 74)],
    });

    const viewModel = buildReportDashboardViewModel(analysis);
    const security = viewModel.sections.find(
      (section) => section.id === "security",
    );

    expect(viewModel.sections).toHaveLength(5);
    expect(security).toMatchObject({
      id: "security",
      title: "Security",
      sourceDimension: "security",
      status: "missing",
      score: undefined,
      rating: "not-assessed",
      confidenceLabel: "not assessed",
      summary: "Security evidence was not available in this report.",
      caveats: ["Security evidence was not available in this report."],
      metrics: [
        { label: "Score", value: "Not assessed", detail: "Missing dimension" },
        { label: "Findings", value: "0", detail: "Reviewer signals" },
        { label: "Evidence", value: "0", detail: "Structured references" },
      ],
    });
  });

  it("surfaces low-confidence dimensions as explicit caveats", () => {
    const analysis = completeAnalysis({
      dimensionAssessments: [
        dimension("security", undefined, {
          confidenceLevel: "low",
          confidenceScore: 0.28,
          rating: "not-assessed",
          summary: "Security posture needs more evidence.",
        }),
      ],
      caveats: [
        {
          id: "caveat:security:low-confidence",
          title: "Low-confidence security assessment",
          summary:
            "Reviewer confidence is low, so this should guide follow-up rather than quality judgment.",
          affectedDimensions: ["security"],
          missingEvidence: ["Dependency audit output"],
        },
      ],
    });

    const viewModel = buildReportDashboardViewModel(analysis);
    const security = viewModel.sections.find(
      (section) => section.id === "security",
    );

    expect(security).toMatchObject({
      status: "low-confidence",
      confidenceLabel: "low confidence",
      caveats: [
        "Reviewer confidence is low, so this should guide follow-up rather than quality judgment.",
        "Missing evidence: Dependency audit output",
      ],
      chartPoints: [
        { label: "Score", value: 0 },
        { label: "Confidence", value: 28 },
        { label: "Evidence", value: 25 },
        { label: "Risk", value: 0 },
      ],
    });
  });

  it("promotes caveats into reviewer notes and section next checks without using raw ids as display copy", () => {
    const viewModel = buildReportDashboardViewModel(
      completeAnalysis({
        caveats: [
          {
            id: "caveat:documentation:missing-evidence",
            title: "Missing documentation evidence",
            summary: "No onboarding guide was found.",
            affectedDimensions: ["documentation"],
            missingEvidence: ["Architecture decision records"],
          },
        ],
      }),
    );

    const documentation = viewModel.sections.find(
      (section) => section.id === "documentation",
    );

    expect(viewModel.reviewerNotes.map((note) => note.text)).toContain(
      "No onboarding guide was found.",
    );
    expect(documentation?.nextChecks).toEqual([
      "Architecture decision records",
    ]);
    expect(
      viewModel.reviewerNotes.map((note) => note.text).join(" "),
    ).not.toContain("caveat:documentation:missing-evidence");
  });

  it("returns an explicit empty language state when language data is absent", () => {
    const viewModel = buildReportDashboardViewModel(
      completeAnalysis({
        languageMix: [],
      }),
    );

    expect(viewModel.languageSlices).toEqual([]);
    expect(viewModel.emptyLanguageMessage).toBe(
      "No language mix was available in the collected evidence.",
    );
  });
});

function completeAnalysis(
  overrides: {
    readonly dimensionAssessments?: DimensionAssessment[];
    readonly caveats?: ReportCard["caveats"];
    readonly languageMix?: AnalyzeRepositoryResponse["dashboardInsights"]["languageMix"];
  } = {},
): AnalyzeRepositoryResponse {
  const reportCard: ReportCard = {
    id: "report:repo-analyzer-green",
    schemaVersion: "report-card.v1",
    generatedAt,
    scoringPolicy: {
      name: "repo-analyzer-green scoring policy",
      version: "0.1.0",
    },
    repository: {
      provider: "github",
      owner: "lightstrikelabs",
      name: "repo-analyzer-green",
      revision: "abc123",
    },
    assessedArchetype: "web-app",
    reviewerMetadata: {
      kind: "fake",
      name: "Fixture reviewer",
      reviewedAt,
    },
    evidenceReferences: [
      evidence("evidence:maintainability", "Maintainability evidence"),
      evidence("evidence:testing", "Testing evidence"),
      evidence("evidence:security", "Security evidence"),
      evidence("evidence:architecture", "Architecture evidence"),
      evidence("evidence:documentation", "Documentation evidence"),
    ],
    dimensionAssessments: overrides.dimensionAssessments ?? [
      dimension("maintainability", 78, {
        summary: "Module shape is readable with a few growth hotspots.",
      }),
      dimension("verifiability", 86, {
        summary: "Tests exercise the main repository-analysis workflow.",
        findingSummary: "Focused tests cover the main workflow.",
        evidenceId: "evidence:testing",
      }),
      dimension("security", 70, {
        summary:
          "Security hygiene has basic evidence but audit output is absent.",
        findingSeverity: "medium",
        findingSummary:
          "Add dependency audit evidence before relying on the security rating.",
        evidenceId: "evidence:security",
      }),
      dimension("architecture-boundaries", 88, {
        summary: "Boundaries keep domain logic independent from adapters.",
        findingSummary: "Bounded modules keep the API surface easy to review.",
        evidenceId: "evidence:architecture",
      }),
      dimension("documentation", 76, {
        summary: "Documentation explains the main development constraints.",
        findingSeverity: "low",
        findingSummary: "Document deployment assumptions.",
        evidenceId: "evidence:documentation",
      }),
    ],
    caveats: overrides.caveats ?? [],
    recommendedNextQuestions: [],
  };

  return {
    reportCard,
    dashboardInsights: {
      evidenceSummary:
        "Files analyzed: 24. Source files: 10. Test files: 4. Documentation files: 2.",
      languageMix: overrides.languageMix ?? [
        {
          language: "TypeScript",
          fileCount: 10,
          sourceFileCount: 8,
          textLineCount: 1_100,
          codeLineCount: 800,
          percentOfCode: 80,
          evidenceReferenceIds: ["language-code-shape:file:src/app.ts"],
        },
        {
          language: "Markdown",
          fileCount: 2,
          sourceFileCount: 0,
          textLineCount: 220,
          codeLineCount: 200,
          percentOfCode: 20,
          evidenceReferenceIds: ["language-code-shape:file:README.md"],
        },
      ],
      codeShapeSummary: {
        analyzedFileCount: 24,
        sourceFileCount: 10,
        testFileCount: 4,
        documentationFileCount: 2,
        largeFileCount: 1,
        skippedFileCount: 0,
        unsupportedFileCount: 0,
        totalTextLineCount: 1_320,
        totalCodeLineCount: 1_000,
        totalDeferredWorkMarkerCount: 2,
        totalBranchLikeTokenCount: 30,
      },
    },
  };
}

function dimension(
  dimensionKey: ReportDimensionKey,
  score: number | undefined,
  options: {
    readonly confidenceLevel?: DimensionAssessment["confidence"]["level"];
    readonly confidenceScore?: number;
    readonly evidenceId?: string;
    readonly findingSeverity?: DimensionAssessment["findings"][number]["severity"];
    readonly findingSummary?: string;
    readonly rating?: DimensionAssessment["rating"];
    readonly summary?: string;
  } = {},
): DimensionAssessment {
  const evidenceId = options.evidenceId ?? `evidence:${dimensionKey}`;
  const title = titleForDimension(dimensionKey);

  return {
    dimension: dimensionKey,
    title,
    summary: options.summary ?? `${title} has enough evidence for review.`,
    rating: options.rating ?? "good",
    score,
    confidence: {
      level: options.confidenceLevel ?? "high",
      score: options.confidenceScore ?? 0.92,
      rationale: `${title} evidence is fixture-backed.`,
    },
    evidenceReferences: [evidence(evidenceId, `${title} evidence`)],
    findings:
      options.findingSummary === undefined
        ? []
        : [
            {
              id: `finding:${dimensionKey}:0`,
              dimension: dimensionKey,
              severity: options.findingSeverity ?? "info",
              title: `${title} signal`,
              summary: options.findingSummary,
              confidence: {
                level: options.confidenceLevel ?? "high",
                score: options.confidenceScore ?? 0.92,
                rationale: `${title} finding is fixture-backed.`,
              },
              evidenceReferences: [evidence(evidenceId, `${title} evidence`)],
            },
          ],
    caveatIds: [],
  };
}

function evidence(id: string, label: string) {
  return {
    id,
    kind: "derived" as const,
    label,
  };
}

function titleForDimension(dimensionKey: ReportDimensionKey): string {
  switch (dimensionKey) {
    case "architecture-boundaries":
      return "Architecture";
    case "documentation":
      return "Documentation";
    case "maintainability":
      return "Maintainability";
    case "operability":
      return "Operability";
    case "security":
      return "Security";
    case "verifiability":
      return "Testing";
  }
}
