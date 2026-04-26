import { describe, expect, it } from "vitest";

import type { AnalyzeRepositoryResponse } from "../../../src/application/analyze-repository/analyze-repository-response";
import type { BrowserAnalysisSession } from "../../../src/infrastructure/persistence/browser-analysis-session-storage";
import {
  browserRepositoryFormFromIdentity,
  clearBrowserAnalysisSession,
  defaultBrowserRepositoryForm,
  loadBrowserAnalysisSession,
  saveBrowserAnalysisSession,
} from "../../../src/infrastructure/persistence/browser-analysis-session-storage";

describe("browser-analysis-session-storage", () => {
  it("round-trips the browser analysis session with the latest report", () => {
    const storage = new FakeStorage();
    const session: BrowserAnalysisSession = {
      schemaVersion: "browser-analysis-session.v1",
      form: {
        provider: "local-fixture",
        name: "minimal-node-library",
        revision: "fixture",
        selectedModel: "fixture-default",
      },
      latestReport: analysis,
      updatedAt: "2026-04-26T10:00:00-07:00",
    };

    saveBrowserAnalysisSession(storage, session);

    expect(loadBrowserAnalysisSession(storage)).toEqual(session);
  });

  it("discards invalid JSON and schema mismatches", () => {
    const storage = new FakeStorage({
      raw: JSON.stringify({ schemaVersion: "browser-analysis-session.v0" }),
    });

    expect(loadBrowserAnalysisSession(storage)).toBeNull();

    storage.raw = "{ not json";
    expect(loadBrowserAnalysisSession(storage)).toBeNull();
  });

  it("can clear the stored browser session", () => {
    const storage = new FakeStorage();
    saveBrowserAnalysisSession(storage, {
      schemaVersion: "browser-analysis-session.v1",
      form: defaultBrowserRepositoryForm(),
      updatedAt: "2026-04-26T10:00:00-07:00",
    });

    clearBrowserAnalysisSession(storage);

    expect(loadBrowserAnalysisSession(storage)).toBeNull();
  });

  it("can reconstruct a repository form from a repository identity", () => {
    expect(
      browserRepositoryFormFromIdentity({
        provider: "github",
        owner: "lightstrikelabs",
        name: "repo-analyzer-green",
        revision: "main",
      }),
    ).toEqual({
      provider: "github",
      owner: "lightstrikelabs",
      name: "repo-analyzer-green",
      revision: "main",
      selectedModel: "fixture-default",
    });
  });
});

class FakeStorage {
  raw: string | null;

  constructor(input?: { readonly raw?: string | null }) {
    this.raw = input?.raw ?? null;
  }

  getItem(): string | null {
    return this.raw;
  }

  setItem(_key: string, value: string): void {
    this.raw = value;
  }

  removeItem(): void {
    this.raw = null;
  }
}

const analysis: AnalyzeRepositoryResponse = {
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
    evidenceReferences: [],
    dimensionAssessments: [
      {
        dimension: "maintainability",
        title: "Maintainability",
        summary: "Minimal fixture.",
        rating: "good",
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
        findings: [],
        caveatIds: [],
      },
    ],
    caveats: [],
    recommendedNextQuestions: [],
  },
  dashboardInsights: {
    evidenceSummary: "Fixture evidence.",
    languageMix: [],
    codeShapeSummary: {
      analyzedFileCount: 1,
      sourceFileCount: 1,
      testFileCount: 0,
      documentationFileCount: 0,
      largeFileCount: 0,
      skippedFileCount: 0,
      unsupportedFileCount: 0,
      totalTextLineCount: 1,
      totalCodeLineCount: 1,
      totalDeferredWorkMarkerCount: 0,
      totalBranchLikeTokenCount: 0,
    },
  },
};
