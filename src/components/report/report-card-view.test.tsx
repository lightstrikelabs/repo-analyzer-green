import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { ReportCard } from "../../domain/report/report-card";
import { ReportCardView } from "./report-card-view";

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

describe("ReportCardView", () => {
  it("renders dimensions, confidence, findings, caveats, missing evidence, and evidence references", () => {
    const html = renderToStaticMarkup(
      <ReportCardView reportCard={reportCard} />,
    );

    expect(html).toContain("minimal-node-library");
    expect(html).toContain("library");
    expect(html).toContain("Verifiability");
    expect(html).toContain("good");
    expect(html).toContain("high confidence");
    expect(html).toContain("Test depth");
    expect(html).toContain("Limited fixture evidence");
    expect(html).toContain("Release workflow history");
    expect(html).toContain("evidence:test-file");
    expect(html).toContain("How is this package released and verified?");
  });

  it("does not collapse the report into a single overall score", () => {
    const html = renderToStaticMarkup(
      <ReportCardView reportCard={reportCard} />,
    );

    expect(html).not.toContain("Overall score");
    expect(html).not.toContain("Total score");
  });
});
