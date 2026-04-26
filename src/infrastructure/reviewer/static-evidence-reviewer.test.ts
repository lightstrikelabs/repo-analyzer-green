import { describe, expect, it } from "vitest";

import { StaticEvidenceReviewer } from "./static-evidence-reviewer";

describe("StaticEvidenceReviewer", () => {
  it("returns deterministic reviewer assessment for the red no-key path", async () => {
    const reviewer = new StaticEvidenceReviewer({
      now: () => new Date("2026-04-26T14:15:00-07:00"),
    });

    const result = await reviewer.assess({
      repository: {
        provider: "github",
        owner: "lightstrikelabs",
        name: "repo-analyzer-green",
        url: "https://github.com/lightstrikelabs/repo-analyzer-green",
      },
      evidenceSummary:
        "Files analyzed: 109 Source files: 109 Test files: 49 Documentation files: 27",
      evidenceReferences: [
        {
          id: "evidence:file-inventory",
          kind: "collector",
          label: "File inventory",
        },
      ],
    });

    expect(result).toMatchObject({
      kind: "assessment",
      assessment: {
        schemaVersion: "reviewer-assessment.v1",
        reviewer: {
          kind: "automated",
          name: "Static evidence reviewer",
          reviewedAt: "2026-04-26T21:15:00.000Z",
        },
        assessedArchetype: {
          value: "unknown",
        },
      },
    });

    if (result.kind !== "assessment") {
      throw new Error("Expected deterministic assessment");
    }

    expect(
      result.assessment.dimensions.map((dimension) => dimension.dimension),
    ).toEqual([
      "maintainability",
      "verifiability",
      "security",
      "architecture-boundaries",
      "documentation",
    ]);
    expect(
      result.assessment.dimensions.every(
        (dimension) => dimension.evidenceReferences.length > 0,
      ),
    ).toBe(true);
    expect(result.assessment.followUpQuestions[0]).toMatchObject({
      targetDimension: "maintainability",
    });
  });
});
