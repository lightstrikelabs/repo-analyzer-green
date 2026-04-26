import type { AnalyzeRepositoryResponse } from "../../src/application/analyze-repository/analyze-repository-response";

export const analyzeRepositoryResponseFixture: AnalyzeRepositoryResponse = {
  reportCard: {
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
      {
        id: "evidence:ci-workflow",
        kind: "file",
        label: "CI workflow",
        path: ".github/workflows/ci.yml",
      },
    ],
    dimensionAssessments: [
      {
        dimension: "maintainability",
        title: "Maintainability",
        summary: "Minimal fixture.",
        rating: "good",
        score: 88,
        confidence: {
          level: "high",
          score: 0.9,
          rationale: "Fixture is minimal.",
        },
        evidenceReferences: [
          {
            id: "evidence:source-file",
            kind: "file",
            label: "Source file",
            path: "src/add.ts",
          },
        ],
        findings: [
          {
            id: "finding:test-surface",
            dimension: "verifiability",
            severity: "info",
            title: "Focused test surface",
            summary: "A unit test exercises the exported behavior.",
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
          },
        ],
        caveatIds: [],
      },
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
        findings: [],
        caveatIds: [],
      },
    ],
    caveats: [],
    recommendedNextQuestions: [
      {
        id: "question:test-depth",
        question: "What behavior remains untested?",
        targetDimension: "verifiability",
        rationale: "The deterministic fixture is intentionally narrow.",
      },
    ],
  },
  dashboardInsights: {
    evidenceSummary: "Fixture evidence.",
    languageMix: [
      {
        language: "TypeScript",
        fileCount: 2,
        sourceFileCount: 1,
        textLineCount: 12,
        codeLineCount: 10,
        percentOfCode: 100,
        evidenceReferenceIds: ["language-code-shape:file:src/add.ts"],
      },
    ],
    codeShapeSummary: {
      analyzedFileCount: 2,
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
