import { describe, expect, it } from "vitest";

import type {
  AnalyzeRepositoryReportCardResult,
  AnalyzeRepositoryResult,
} from "../../../application/analyze-repository/analyze-repository";
import { buildAnalyzeRepositoryResponse } from "../../../application/analyze-repository/analyze-repository-response";
import { RepositorySourceError } from "../../../domain/repository/repository-source";
import { handleAnalyzeRequest } from "./route";

const validRequestBody = {
  repository: {
    provider: "local-fixture",
    name: "minimal-node-library",
    revision: "fixture",
  },
} as const;

const reportResult: AnalyzeRepositoryReportCardResult = {
  kind: "report-card",
  reportCard: {
    id: "report:minimal-node-library",
    schemaVersion: "report-card.v1",
    generatedAt: "2026-04-25T20:05:00-07:00",
    scoringPolicy: {
      name: "repo-analyzer-green scoring policy",
      version: "0.1.0",
    },
    repository: validRequestBody.repository,
    assessedArchetype: "library",
    reviewerMetadata: {
      kind: "fake",
      name: "Fake reviewer",
      reviewedAt: "2026-04-25T20:00:00-07:00",
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
        findings: [],
        caveatIds: [],
      },
    ],
    caveats: [],
    recommendedNextQuestions: [],
  },
  evidenceBundle: {
    repository: validRequestBody.repository,
    fileInventory: {
      files: [],
      omissions: [],
    },
    manifestWorkflowSignals: {
      packageManifests: [],
      dependencySignals: [],
      scriptSignals: [],
      workflowSignals: [],
      unsupportedManifests: [],
      omissions: [],
    },
    projectArchetypeSignals: {
      primaryArchetype: "library",
      candidates: [],
    },
    languageCodeShapeMetrics: {
      summary: {
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
      languageMix: [
        {
          language: "TypeScript",
          extensions: [".ts"],
          fileCount: 2,
          sourceFileCount: 1,
          textLineCount: 12,
          codeLineCount: 10,
          evidenceReferences: [
            {
              id: "language-code-shape:file:src/add.ts",
              kind: "file",
              label: "TypeScript file",
              path: "src/add.ts",
            },
          ],
        },
      ],
      files: [],
      deferredWorkMarkers: [],
      branchLikeTokens: [],
      largeFiles: [],
      omissions: [],
      caveats: [],
    },
    securityHygieneSignals: {
      lockfileSignals: [],
      dependencyCountSignals: [],
      envExampleSignals: [],
      secretRiskSignals: [],
      limitations: [],
    },
    evidenceReferences: [],
    evidenceSummary: "Files analyzed: 0",
  },
  reviewerAssessment: {
    schemaVersion: "reviewer-assessment.v1",
    reviewer: {
      kind: "fake",
      name: "Fake reviewer",
      reviewedAt: "2026-04-25T20:00:00-07:00",
    },
    assessedArchetype: {
      value: "library",
      confidence: {
        level: "high",
        score: 0.9,
        rationale: "Fixture reviewer.",
      },
      evidenceReferences: [],
      rationale: "Fixture reviewer.",
    },
    dimensions: [
      {
        dimension: "verifiability",
        summary: "A focused unit test exercises exported behavior.",
        confidence: {
          level: "high",
          score: 0.9,
          rationale: "Fixture reviewer.",
        },
        evidenceReferences: [],
        strengths: [],
        risks: [],
        missingEvidence: [],
      },
    ],
    caveats: [],
    followUpQuestions: [],
  },
};

describe("POST /api/analyze", () => {
  it("validates the request and returns the report card from the analyzer", async () => {
    const response = await handleAnalyzeRequest(jsonRequest(validRequestBody), {
      analyze: async () => reportResult,
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(buildAnalyzeRepositoryResponse(reportResult));
  });

  it("returns 400 for invalid request bodies", async () => {
    const response = await handleAnalyzeRequest(
      jsonRequest({
        repository: {
          provider: "local-fixture",
          name: "",
        },
      }),
      {
        analyze: async () => reportResult,
      },
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("invalid-request");
    expect(body.error.issues[0]).toMatchObject({
      path: ["repository", "name"],
    });
  });

  it("maps missing repositories to 404 without leaking implementation details", async () => {
    const response = await handleAnalyzeRequest(jsonRequest(validRequestBody), {
      analyze: async () => {
        throw new RepositorySourceError(
          "Repository fixture is not registered.",
          "repository-not-found",
          validRequestBody.repository,
        );
      },
    });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({
      error: {
        code: "repository-not-found",
        message: "Repository could not be found.",
      },
    });
  });

  it("maps malformed reviewer output to a bad gateway response", async () => {
    const malformedResult: AnalyzeRepositoryResult = {
      kind: "reviewer-malformed-response",
      evidenceBundle: reportResult.evidenceBundle,
      reviewer: {
        kind: "fake",
        name: "Malformed fake reviewer",
        reviewedAt: "2026-04-25T20:00:00-07:00",
      },
      rawResponse: "{}",
      validationIssues: [
        {
          path: ["dimensions"],
          message: "Required",
        },
      ],
    };

    const response = await handleAnalyzeRequest(jsonRequest(validRequestBody), {
      analyze: async () => malformedResult,
    });
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body).toEqual({
      error: {
        code: "reviewer-malformed-response",
        message: "Reviewer response could not be validated.",
        issues: malformedResult.validationIssues,
      },
    });
  });
});

function jsonRequest(body: object): Request {
  return new Request("http://localhost/api/analyze", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}
