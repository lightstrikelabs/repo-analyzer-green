import { describe, expect, it } from "vitest";

import {
  ReviewerAssessmentSchemaVersion,
  ReviewerDimensionAssessmentSchema,
} from "./reviewer-assessment";
import { renderReviewerPrompt } from "./reviewer-prompt";

const repository = {
  provider: "github",
  owner: "lightstrikelabs",
  name: "repo-analyzer-green",
  url: "https://github.com/lightstrikelabs/repo-analyzer-green",
  revision: "main",
} as const;

const evidenceReferences = [
  {
    id: "evidence:package-json",
    kind: "file",
    label: "Package manifest",
    path: "package.json",
  },
  {
    id: "evidence:security-human-review",
    kind: "collector",
    label: "Security hygiene limitation",
    notes: "Security hygiene signals require human review.",
  },
] as const;

describe("renderReviewerPrompt", () => {
  it("renders a structured-output-only prompt grounded in the reviewer assessment schema", () => {
    const prompt = renderReviewerPrompt({
      repository,
      evidenceReferences,
      evidenceSummary: [
        "Files analyzed: 42",
        "Primary archetype signal: web-app",
        "Security hygiene signals: 2",
      ].join("\n"),
    });

    expect(prompt.system).toContain("Return only JSON");
    expect(prompt.system).toContain(ReviewerAssessmentSchemaVersion);
    expect(prompt.system).toContain("Do not make unsupported claims");
    expect(prompt.system).toContain("Missing evidence is not a defect");
    expect(prompt.system).toContain("follow-up questions");
    expect(prompt.user).toContain("lightstrikelabs/repo-analyzer-green");
    expect(prompt.user).toContain("Files analyzed: 42");
    expect(prompt.user).toContain("evidence:package-json");
    expect(prompt.user).toContain(
      "Security hygiene signals require human review",
    );
    expect(prompt.responseContractJson).toContain(
      '"schemaVersion":"reviewer-assessment.v1"',
    );
    expect(prompt.messages).toEqual([
      {
        role: "system",
        content: prompt.system,
      },
      {
        role: "user",
        content: prompt.user,
      },
    ]);
  });

  it("keeps every required dimension visible to the reviewer", () => {
    const prompt = renderReviewerPrompt({
      repository,
      evidenceReferences,
    });

    const dimensions =
      ReviewerDimensionAssessmentSchema.shape.dimension.options;

    for (const dimension of dimensions) {
      expect(prompt.system).toContain(dimension);
    }
  });

  it("bounds the evidence summary to keep prompt size predictable", () => {
    const prompt = renderReviewerPrompt({
      repository,
      evidenceReferences,
      evidenceSummary: "x".repeat(20_000),
      maxEvidenceSummaryCharacters: 120,
    });

    expect(prompt.user).toContain("Evidence Summary");
    expect(prompt.user).toContain("truncated");
    expect(prompt.user.length).toBeLessThan(3_000);
  });
});
