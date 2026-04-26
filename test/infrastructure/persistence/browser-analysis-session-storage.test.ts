import { describe, expect, it } from "vitest";

import type { AnalyzeRepositoryResponse } from "../../../src/application/analyze-repository/analyze-repository-response";
import type {
  BrowserFollowUpState,
  BrowserLocalSession,
} from "../../../src/infrastructure/persistence/browser-local-session-storage";
import {
  browserRepositoryFormFromIdentity,
  clearBrowserLocalSession,
  defaultBrowserRepositoryForm,
  loadBrowserAnalysisSession,
  loadBrowserFollowUpState,
  loadBrowserLocalSession,
  saveBrowserAnalysisSession,
  saveBrowserFollowUpState,
  saveBrowserLocalSession,
} from "../../../src/infrastructure/persistence/browser-local-session-storage";

describe("browser-analysis-session-storage", () => {
  it("round-trips the browser local session with analysis and chat state", () => {
    const storage = new FakeStorage();
    const session: BrowserLocalSession = {
      schemaVersion: "browser-local-session.v1",
      analysis: {
        form: {
          provider: "local-fixture",
          name: "minimal-node-library",
          revision: "fixture",
          selectedModel: "fixture-default",
        },
        latestReport: analysis,
      },
      followUpThreads: {
        "report:minimal-node-library": followUpState,
      },
      updatedAt: "2026-04-26T10:00:00-07:00",
    };

    saveBrowserLocalSession(storage, session);

    expect(loadBrowserLocalSession(storage)).toEqual(session);
    expect(loadBrowserAnalysisSession(storage)).toEqual(session.analysis);
    expect(
      loadBrowserFollowUpState(storage, "report:minimal-node-library"),
    ).toEqual(followUpState);
  });

  it("keeps follow-up threads when analysis is saved and keeps analysis when chat is saved", () => {
    const storage = new FakeStorage();

    saveBrowserAnalysisSession(storage, {
      form: defaultBrowserRepositoryForm(),
      latestReport: analysis,
    });
    saveBrowserFollowUpState(
      storage,
      "report:minimal-node-library",
      followUpState,
    );

    expect(loadBrowserAnalysisSession(storage)).toEqual({
      form: defaultBrowserRepositoryForm(),
      latestReport: analysis,
    });
    expect(
      loadBrowserFollowUpState(storage, "report:minimal-node-library"),
    ).toEqual(followUpState);
  });

  it("discards invalid JSON and schema mismatches", () => {
    const storage = new FakeStorage({
      raw: JSON.stringify({ schemaVersion: "browser-local-session.v0" }),
    });

    expect(loadBrowserLocalSession(storage)).toBeNull();
    expect(loadBrowserAnalysisSession(storage)).toBeNull();
    expect(
      loadBrowserFollowUpState(storage, "report:minimal-node-library"),
    ).toBeNull();

    storage.raw = "{ not json";
    expect(loadBrowserLocalSession(storage)).toBeNull();
  });

  it("can clear the stored browser session", () => {
    const storage = new FakeStorage();
    saveBrowserAnalysisSession(storage, {
      form: defaultBrowserRepositoryForm(),
      latestReport: analysis,
    });
    saveBrowserFollowUpState(
      storage,
      "report:minimal-node-library",
      followUpState,
    );

    clearBrowserLocalSession(storage);

    expect(loadBrowserLocalSession(storage)).toBeNull();
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

const followUpState: BrowserFollowUpState = {
  sessions: [
    {
      conversation: {
        id: "conversation:report:minimal-node-library:0",
        schemaVersion: "conversation.v1",
        reportCardId: "report:minimal-node-library",
        repository: {
          provider: "local-fixture",
          name: "minimal-node-library",
          revision: "fixture",
        },
        target: {
          kind: "report",
        },
        messages: [
          {
            id: "message:user:0",
            role: "user",
            content: "What should we inspect first?",
            citations: [],
            assumptions: [],
            createdAt: "2026-04-26T09:55:00-07:00",
          },
          {
            id: "message:assistant:0",
            role: "assistant",
            content: "Inspect the package manifest and test surface.",
            citations: [],
            assumptions: [],
            createdAt: "2026-04-26T09:56:00-07:00",
          },
        ],
        createdAt: "2026-04-26T09:55:00-07:00",
        updatedAt: "2026-04-26T09:56:00-07:00",
      },
      target: {
        kind: "report",
      },
      answer: {
        answer: {
          schemaVersion: "chat-answer.v1",
          status: "answered",
          summary: "Inspect the package manifest and test surface.",
          evidenceBackedClaims: [
            {
              claim: "The manifest provides the primary evidence.",
              citations: [
                {
                  evidenceReference: {
                    id: "evidence:package-json",
                    kind: "file",
                    label: "Package manifest",
                    path: "package.json",
                  },
                },
              ],
            },
          ],
          assumptions: [],
          caveats: [],
          suggestedNextQuestions: [],
        },
        metadata: {
          provider: "fixture",
          modelName: "demo-chat-reviewer",
          generatedAt: "2026-04-26T09:56:00-07:00",
        },
      },
      evidenceSummary: "Retrieved 1 snippet from Package manifest.",
      title: "Report: What should we inspect first?",
    },
  ],
  activeConversationId: "conversation:report:minimal-node-library:0",
};
