import type {
  AnalyzeRepositoryResponse,
  DashboardLanguageMixItem,
} from "../analyze-repository/analyze-repository-response";
import type {
  DimensionAssessment,
  FindingSeverity,
  ReportCaveat,
  ReportDimensionKey,
  ReportFinding,
  ReportRating,
} from "../../domain/report/report-card";

export type ReportDashboardViewModel = {
  readonly overview: ReportDashboardOverview;
  readonly bigNumbers: readonly ReportDashboardBigNumber[];
  readonly languageSlices: readonly ReportDashboardLanguageSlice[];
  readonly emptyLanguageMessage: string | undefined;
  readonly reviewerNotes: readonly ReportDashboardReviewerNote[];
  readonly sections: readonly ReportDashboardSection[];
};

export type ReportDashboardOverview = {
  readonly repositoryLabel: string;
  readonly analyzedAt: string;
  readonly reviewerNote: string;
  readonly overallScore: number | undefined;
  readonly grade: string;
  readonly summary: string;
  readonly provenance: ReportDashboardProvenance;
};

export type ReportDashboardBigNumber = {
  readonly id: "overall-score" | "source-files" | "code-lines" | "test-ratio";
  readonly label: string;
  readonly value: string;
  readonly detail: string;
  readonly provenance: ReportDashboardProvenance;
};

export type ReportDashboardLanguageSlice = {
  readonly language: string;
  readonly percentOfCode: number;
  readonly codeLineCount: number;
  readonly fileCount: number;
  readonly color: string;
  readonly provenance: ReportDashboardProvenance;
};

export type ReportDashboardReviewerNote = {
  readonly text: string;
  readonly tone: "signal" | "risk" | "caveat";
  readonly provenance: ReportDashboardProvenance;
};

export type ReportDashboardSection = {
  readonly id: ReportDashboardSectionId;
  readonly title: string;
  readonly sourceDimension: ReportDimensionKey;
  readonly status: "assessed" | "low-confidence" | "missing";
  readonly score: number | undefined;
  readonly rating: ReportRating;
  readonly confidenceLabel: string;
  readonly summary: string;
  readonly metrics: readonly ReportDashboardMetric[];
  readonly highlights: readonly string[];
  readonly risks: readonly string[];
  readonly nextChecks: readonly string[];
  readonly caveats: readonly string[];
  readonly chartPoints: readonly ReportDashboardChartPoint[];
  readonly provenance: ReportDashboardProvenance;
};

export type ReportDashboardSectionId =
  | "maintainability"
  | "testing"
  | "security"
  | "architecture"
  | "documentation";

export type ReportDashboardMetric = {
  readonly label: string;
  readonly value: string;
  readonly detail: string;
};

export type ReportDashboardChartPoint = {
  readonly label: "Score" | "Confidence" | "Evidence" | "Risk";
  readonly value: number;
};

export type ReportDashboardProvenance = {
  readonly source:
    | "report-card"
    | "code-shape-summary"
    | "language-mix"
    | "dimension-assessment"
    | "finding"
    | "caveat";
  readonly referenceIds: readonly string[];
};

const dashboardSections = [
  {
    id: "maintainability",
    title: "Maintainability",
    sourceDimension: "maintainability",
  },
  {
    id: "testing",
    title: "Testing",
    sourceDimension: "verifiability",
  },
  {
    id: "security",
    title: "Security",
    sourceDimension: "security",
  },
  {
    id: "architecture",
    title: "Architecture",
    sourceDimension: "architecture-boundaries",
  },
  {
    id: "documentation",
    title: "Documentation",
    sourceDimension: "documentation",
  },
] as const satisfies readonly {
  readonly id: ReportDashboardSectionId;
  readonly title: string;
  readonly sourceDimension: ReportDimensionKey;
}[];

const languageColors = ["#047857", "#2563eb", "#d97706", "#be123c", "#7c3aed"];

export function buildReportDashboardViewModel(
  analysis: AnalyzeRepositoryResponse,
): ReportDashboardViewModel {
  const sections = dashboardSections.map((section) =>
    buildSection(
      section,
      analysis.reportCard.dimensionAssessments,
      analysis.reportCard.caveats,
    ),
  );
  const overallScore = scoreAverage(
    sections
      .map((section) => section.score)
      .filter((score) => score !== undefined),
  );
  const languageSlices =
    analysis.dashboardInsights.languageMix.map(languageSlice);

  return {
    overview: {
      repositoryLabel: repositoryLabel(analysis),
      analyzedAt: analysis.reportCard.generatedAt,
      reviewerNote: reviewerNote(analysis),
      overallScore,
      grade: gradeForScore(overallScore),
      summary: analysis.dashboardInsights.evidenceSummary,
      provenance: {
        source: "report-card",
        referenceIds: analysis.reportCard.evidenceReferences.map(
          (reference) => reference.id,
        ),
      },
    },
    bigNumbers: bigNumbers(analysis, overallScore, sections),
    languageSlices,
    emptyLanguageMessage:
      languageSlices.length === 0
        ? "No language mix was available in the collected evidence."
        : undefined,
    reviewerNotes: reviewerNotes(sections, analysis.reportCard.caveats),
    sections,
  };
}

function buildSection(
  section: (typeof dashboardSections)[number],
  assessments: readonly DimensionAssessment[],
  caveats: readonly ReportCaveat[],
): ReportDashboardSection {
  const assessment = assessments.find(
    (candidate) => candidate.dimension === section.sourceDimension,
  );

  if (assessment === undefined) {
    const summary = `${section.title} evidence was not available in this report.`;
    return {
      id: section.id,
      title: section.title,
      sourceDimension: section.sourceDimension,
      status: "missing",
      score: undefined,
      rating: "not-assessed",
      confidenceLabel: "not assessed",
      summary,
      metrics: [
        { label: "Score", value: "Not assessed", detail: "Missing dimension" },
        { label: "Findings", value: "0", detail: "Reviewer signals" },
        { label: "Evidence", value: "0", detail: "Structured references" },
      ],
      highlights: [],
      risks: [],
      nextChecks: [],
      caveats: [summary],
      chartPoints: [
        { label: "Score", value: 0 },
        { label: "Confidence", value: 0 },
        { label: "Evidence", value: 0 },
        { label: "Risk", value: 0 },
      ],
      provenance: {
        source: "report-card",
        referenceIds: [],
      },
    };
  }

  const relevantCaveats = caveats.filter((caveat) =>
    caveat.affectedDimensions.includes(assessment.dimension),
  );
  const confidencePercent = Math.round(assessment.confidence.score * 100);
  const highlights = assessment.findings
    .filter(
      (finding) => severityRank(finding.severity) === severityRank("info"),
    )
    .map((finding) => finding.summary);
  const risks = assessment.findings
    .filter((finding) => severityRank(finding.severity) > severityRank("info"))
    .map((finding) => finding.summary);
  const nextChecks = relevantCaveats.flatMap(
    (caveat) => caveat.missingEvidence,
  );

  return {
    id: section.id,
    title: section.title,
    sourceDimension: section.sourceDimension,
    status:
      assessment.confidence.level === "low" ? "low-confidence" : "assessed",
    score: assessment.score,
    rating: assessment.rating,
    confidenceLabel: `${assessment.confidence.level} confidence`,
    summary: assessment.summary,
    metrics: [
      {
        label: "Score",
        value:
          assessment.score === undefined
            ? "Not assessed"
            : String(assessment.score),
        detail: "Dimension score",
      },
      {
        label: "Findings",
        value: String(assessment.findings.length),
        detail: "Reviewer signals",
      },
      {
        label: "Evidence",
        value: String(assessment.evidenceReferences.length),
        detail: "Structured references",
      },
    ],
    highlights,
    risks,
    nextChecks,
    caveats: caveatDisplayText(relevantCaveats),
    chartPoints: [
      { label: "Score", value: assessment.score ?? 0 },
      { label: "Confidence", value: confidencePercent },
      {
        label: "Evidence",
        value: Math.min(100, assessment.evidenceReferences.length * 25),
      },
      { label: "Risk", value: riskValue(assessment.findings) },
    ],
    provenance: {
      source: "dimension-assessment",
      referenceIds: assessment.evidenceReferences.map(
        (reference) => reference.id,
      ),
    },
  };
}

function bigNumbers(
  analysis: AnalyzeRepositoryResponse,
  overallScore: number | undefined,
  sections: readonly ReportDashboardSection[],
): readonly ReportDashboardBigNumber[] {
  const summary = analysis.dashboardInsights.codeShapeSummary;
  const scoredSectionCount = sections.filter(
    (section) => section.score !== undefined,
  ).length;

  return [
    {
      id: "overall-score",
      label: "Overall Score",
      value: overallScore === undefined ? "Not assessed" : String(overallScore),
      detail:
        overallScore === undefined
          ? "No scored dashboard sections"
          : `Average of ${scoredSectionCount} scored dashboard sections`,
      provenance: { source: "report-card", referenceIds: [] },
    },
    {
      id: "source-files",
      label: "Source Files",
      value: formatNumber(summary.sourceFileCount),
      detail: "Files classified as source evidence",
      provenance: { source: "code-shape-summary", referenceIds: [] },
    },
    {
      id: "code-lines",
      label: "Code Lines",
      value: formatNumber(summary.totalCodeLineCount),
      detail: "Evidence-backed code line count",
      provenance: { source: "code-shape-summary", referenceIds: [] },
    },
    {
      id: "test-ratio",
      label: "Test Ratio",
      value: testRatioValue(summary.testFileCount, summary.sourceFileCount),
      detail: `${formatNumber(summary.testFileCount)} test files for ${formatNumber(
        summary.sourceFileCount,
      )} source files`,
      provenance: { source: "code-shape-summary", referenceIds: [] },
    },
  ];
}

function languageSlice(
  item: DashboardLanguageMixItem,
  index: number,
): ReportDashboardLanguageSlice {
  return {
    language: item.language,
    percentOfCode: item.percentOfCode,
    codeLineCount: item.codeLineCount,
    fileCount: item.fileCount,
    color: languageColors[index % languageColors.length] ?? "#047857",
    provenance: {
      source: "language-mix",
      referenceIds: item.evidenceReferenceIds,
    },
  };
}

function reviewerNotes(
  sections: readonly ReportDashboardSection[],
  caveats: readonly ReportCaveat[],
): readonly ReportDashboardReviewerNote[] {
  const signals = sections
    .toSorted((left, right) => (right.score ?? 0) - (left.score ?? 0))
    .flatMap((section) => signalNotesForSection(section));
  const risks = sections
    .toSorted(
      (left, right) =>
        riskChartValue(right.chartPoints) - riskChartValue(left.chartPoints),
    )
    .flatMap((section) => riskNotesForSection(section));
  const caveatNotes = caveats.map((caveat) => ({
    text: caveat.summary,
    tone: "caveat" as const,
    provenance: {
      source: "caveat" as const,
      referenceIds: [caveat.id],
    },
  }));

  return [...signals, ...risks, ...caveatNotes];
}

function signalNotesForSection(
  section: ReportDashboardSection,
): readonly ReportDashboardReviewerNote[] {
  return section.highlights.map((text) => ({
    text,
    tone: "signal",
    provenance: section.provenance,
  }));
}

function riskNotesForSection(
  section: ReportDashboardSection,
): readonly ReportDashboardReviewerNote[] {
  return section.risks.map((text) => ({
    text,
    tone: "risk",
    provenance: section.provenance,
  }));
}

function riskChartValue(points: readonly ReportDashboardChartPoint[]): number {
  return points.find((point) => point.label === "Risk")?.value ?? 0;
}

function caveatDisplayText(
  caveats: readonly ReportCaveat[],
): readonly string[] {
  return caveats.flatMap((caveat) => {
    const missingEvidence =
      caveat.missingEvidence.length === 0
        ? []
        : [`Missing evidence: ${caveat.missingEvidence.join(", ")}`];
    return [caveat.summary, ...missingEvidence];
  });
}

function repositoryLabel(analysis: AnalyzeRepositoryResponse): string {
  const repository = analysis.reportCard.repository;
  const owner = repository.owner === undefined ? "" : `${repository.owner}/`;
  const revision =
    repository.revision === undefined ? "" : ` @ ${repository.revision}`;
  return `${repository.provider}:${owner}${repository.name}${revision}`;
}

function reviewerNote(analysis: AnalyzeRepositoryResponse): string {
  const metadata = analysis.reportCard.reviewerMetadata;
  const model =
    metadata.modelProvider === undefined || metadata.modelName === undefined
      ? ""
      : ` using ${metadata.modelProvider}/${metadata.modelName}`;
  return `${metadata.name} reviewed this report${model}`;
}

function scoreAverage(scores: readonly number[]): number | undefined {
  if (scores.length === 0) {
    return undefined;
  }

  return Math.round(
    scores.reduce((total, score) => total + score, 0) / scores.length,
  );
}

function gradeForScore(score: number | undefined): string {
  if (score === undefined) {
    return "Not assessed";
  }

  if (score >= 90) {
    return "A";
  }

  if (score >= 80) {
    return "B";
  }

  if (score >= 70) {
    return "C";
  }

  if (score >= 60) {
    return "D";
  }

  return "F";
}

function testRatioValue(
  testFileCount: number,
  sourceFileCount: number,
): string {
  if (sourceFileCount === 0) {
    return testFileCount === 0 ? "No source files" : "No source baseline";
  }

  return `${Math.round((testFileCount / sourceFileCount) * 100)}%`;
}

function riskValue(findings: readonly ReportFinding[]): number {
  const highestSeverity = findings.reduce(
    (highest, finding) => Math.max(highest, severityRank(finding.severity)),
    0,
  );
  return highestSeverity * 25;
}

function severityRank(severity: FindingSeverity): number {
  switch (severity) {
    case "info":
      return 0;
    case "low":
      return 1;
    case "medium":
      return 2;
    case "high":
      return 3;
    case "critical":
      return 4;
  }
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}
