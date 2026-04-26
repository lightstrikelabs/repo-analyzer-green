import { describe, expect, it } from "vitest";

import { FakeReviewer } from "../../infrastructure/reviewer/fake-reviewer";
import { LocalFixtureRepositorySource } from "../../infrastructure/filesystem/local-fixture-repository-source";
import {
  ReviewerAssessmentSchemaVersion,
  type ReviewerAssessment,
} from "../../domain/reviewer/reviewer-assessment";
import { analyzeRepository } from "./analyze-repository";
import { getRepositoryFixture } from "../../../test/support/fixtures";

const fixture = getRepositoryFixture("minimal-node-library");
const repository = {
  provider: "local-fixture",
  name: fixture.id,
  revision: "fixture",
} as const;

const packageManifestReference = {
  id: "evidence:package-json",
  kind: "file",
  label: "Package manifest",
  path: "package.json",
} as const;

const testFileReference = {
  id: "evidence:test-file",
  kind: "file",
  label: "Unit test file",
  path: "test/add.spec.ts",
} as const;

const reviewerAssessment: ReviewerAssessment = {
  schemaVersion: ReviewerAssessmentSchemaVersion,
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
      rationale: "Package metadata and source files identify a library.",
    },
    evidenceReferences: [packageManifestReference],
    rationale: "The fixture exposes reusable TypeScript source.",
  },
  dimensions: [
    {
      dimension: "maintainability",
      summary: "The fixture has a small source surface.",
      confidence: {
        level: "high",
        score: 0.9,
        rationale: "The fixture source file is small and readable.",
      },
      evidenceReferences: [packageManifestReference],
      strengths: ["The source surface is intentionally small."],
      risks: [],
      missingEvidence: [],
    },
    {
      dimension: "verifiability",
      summary: "A focused unit test exercises exported behavior.",
      confidence: {
        level: "high",
        score: 0.9,
        rationale: "The fixture includes a deterministic unit test.",
      },
      evidenceReferences: [testFileReference],
      strengths: ["The public add function has a unit test."],
      risks: [],
      missingEvidence: [],
    },
  ],
  caveats: [],
  followUpQuestions: [
    {
      id: "question:test-depth",
      question: "What behavior remains untested?",
      targetDimension: "verifiability",
      rationale: "The initial fixture has intentionally narrow behavior.",
    },
  ],
};

describe("analyzeRepository", () => {
  it("uses a local fixture source and fake reviewer to produce an evidence-backed report card", async () => {
    const reviewer = new FakeReviewer({
      result: {
        kind: "assessment",
        assessment: reviewerAssessment,
      },
    });
    const result = await analyzeRepository(
      { repository },
      {
        repositorySource: new LocalFixtureRepositorySource({
          fixtures: {
            [fixture.id]: fixture,
          },
        }),
        reviewer,
        now: () => new Date("2026-04-25T20:05:00-07:00"),
        createReportId: () => "report:minimal-node-library",
      },
    );

    expect(result.kind).toBe("report-card");
    if (result.kind !== "report-card") {
      return;
    }

    expect(result.reportCard).toMatchObject({
      id: "report:minimal-node-library",
      schemaVersion: "report-card.v1",
      repository: {
        provider: "local-fixture",
        name: "minimal-node-library",
        revision: "fixture",
      },
      assessedArchetype: "library",
      reviewerMetadata: {
        kind: "fake",
        name: "Fake reviewer",
      },
      scoringPolicy: {
        name: "repo-analyzer-green scoring policy",
        version: "0.1.0",
      },
    });
    expect(result.reportCard.evidenceReferences).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "file",
          path: "package.json",
        }),
        expect.objectContaining({
          kind: "file",
          path: "test/add.spec.ts",
        }),
      ]),
    );
    expect(
      result.evidenceBundle.fileInventory.files.map((file) => file.path),
    ).toEqual(fixture.expectedFiles);
    expect(result.evidenceBundle.manifestWorkflowSignals.scriptSignals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "test",
          purpose: "test",
        }),
      ]),
    );
    expect(
      result.evidenceBundle.languageCodeShapeMetrics.summary,
    ).toMatchObject({
      sourceFileCount: 2,
      testFileCount: 1,
    });
    expect(
      result.evidenceBundle.securityHygieneSignals.limitations,
    ).toContainEqual(
      expect.objectContaining({
        kind: "human-review-required",
      }),
    );
    expect(reviewer.receivedRequests[0]).toMatchObject({
      repository: {
        provider: "local-fixture",
        name: "minimal-node-library",
      },
    });
    expect(
      reviewer.receivedRequests[0]?.evidenceReferences.length,
    ).toBeGreaterThan(0);
    expect(reviewer.receivedRequests[0]?.evidenceSummary).toContain(
      "Files analyzed: 4",
    );
  });

  it("returns a recoverable failure when reviewer output is malformed", async () => {
    const result = await analyzeRepository(
      { repository },
      {
        repositorySource: new LocalFixtureRepositorySource({
          fixtures: {
            [fixture.id]: fixture,
          },
        }),
        reviewer: new FakeReviewer({
          result: {
            kind: "malformed-response",
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
          },
        }),
        now: () => new Date("2026-04-25T20:05:00-07:00"),
      },
    );

    expect(result).toMatchObject({
      kind: "reviewer-malformed-response",
      reviewer: {
        kind: "fake",
        name: "Malformed fake reviewer",
      },
      validationIssues: [
        {
          path: ["dimensions"],
          message: "Required",
        },
      ],
    });
  });
});
