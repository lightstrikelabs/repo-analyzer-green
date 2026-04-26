import { describe, expect, it } from "vitest";

import {
  ReviewerAssessmentSchemaVersion,
  type ReviewerAssessment,
} from "../../../src/domain/reviewer/reviewer-assessment";
import type { ReviewerRequest } from "../../../src/domain/reviewer/reviewer";
import {
  OpenRouterChatCompletionProvider,
  type OpenRouterChatFetcher,
} from "../../../src/infrastructure/llm/openrouter-chat-provider";
import { OpenRouterDefaultModelId } from "../../../src/infrastructure/llm/openrouter-config";
import { OpenRouterReviewer } from "../../../src/infrastructure/reviewer/openrouter-reviewer";

const packageManifestReference = {
  id: "evidence:package-json",
  kind: "file",
  label: "Package manifest",
  path: "package.json",
  lineStart: 1,
  lineEnd: 24,
} as const;

const testFileReference = {
  id: "evidence:test-file",
  kind: "file",
  label: "Unit test file",
  path: "test/add.spec.ts",
} as const;

const request: ReviewerRequest = {
  repository: {
    provider: "local-fixture",
    name: "minimal-node-library",
    revision: "fixture",
  },
  evidenceReferences: [packageManifestReference, testFileReference],
  evidenceSummary: "A minimal TypeScript library with one unit test.",
};

const assessment = {
  schemaVersion: ReviewerAssessmentSchemaVersion,
  reviewer: {
    kind: "llm",
    name: "OpenRouter reviewer",
    reviewerVersion: "openrouter-reviewer.v1",
    modelProvider: "openrouter",
    modelName: OpenRouterDefaultModelId,
    reviewedAt: "2026-04-26T12:00:00-07:00",
  },
  assessedArchetype: {
    value: "library",
    confidence: {
      level: "high",
      score: 0.91,
      rationale: "Package and test files support this conclusion.",
    },
    evidenceReferences: [packageManifestReference],
    rationale: "The package manifest exposes reusable library code.",
  },
  dimensions: [
    {
      dimension: "verifiability",
      summary: "The fixture includes a focused public API test.",
      confidence: {
        level: "high",
        score: 0.9,
        rationale: "The test reference directly covers this claim.",
      },
      evidenceReferences: [testFileReference],
      strengths: ["The exported add function is covered by a unit test."],
      risks: ["The test suite remains narrow."],
      missingEvidence: [],
    },
  ],
  caveats: [],
  followUpQuestions: [],
} satisfies ReviewerAssessment;

describe("OpenRouterReviewer", () => {
  it("renders the reviewer prompt, calls OpenRouter, and returns a validated assessment", async () => {
    const requests: Request[] = [];
    const fetcher: OpenRouterChatFetcher = async (providerRequest) => {
      requests.push(providerRequest);
      return new Response(
        JSON.stringify({
          id: "completion-1",
          choices: [{ message: { content: JSON.stringify(assessment) } }],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    };
    const reviewer = new OpenRouterReviewer({
      chatProvider: new OpenRouterChatCompletionProvider({ fetcher }),
      config: {
        provider: "openrouter",
        apiKey: "sk-or-v1-test",
        model: OpenRouterDefaultModelId,
        baseUrl: "https://openrouter.ai/api/v1",
      },
      controls: {
        maxEvidenceSummaryCharacters: 32,
        maxOutputTokens: 2_000,
        temperature: 0,
      },
      now: () => new Date("2026-04-26T12:00:00-07:00"),
    });

    const result = await reviewer.assess(request);

    expect(result).toEqual({ kind: "assessment", assessment });
    const body = await requests[0]?.json();
    expect(body).toMatchObject({
      model: OpenRouterDefaultModelId,
      metadata: {
        usageContext: "reviewer-assessment",
        repository: "local-fixture:minimal-node-library @ fixture",
      },
      max_tokens: 2_000,
      response_format: { type: "json_object" },
      temperature: 0,
    });
    expect(body.messages).toHaveLength(2);
    expect(body.messages[0]).toMatchObject({ role: "system" });
    expect(body.messages[1]).toMatchObject({ role: "user" });
    expect(body.messages[1].content).toContain(
      "[Evidence summary truncated at 32 characters.]",
    );
  });

  it("requests structured JSON output with reviewer-safe defaults", async () => {
    const requests: Parameters<OpenRouterReviewer["assess"]>[0][] = [];
    const completionRequests: Parameters<
      OpenRouterChatCompletionProvider["complete"]
    >[0][] = [];
    const reviewer = new OpenRouterReviewer({
      chatProvider: {
        complete: async (completionRequest) => {
          completionRequests.push(completionRequest);
          return {
            kind: "completed",
            provider: "openrouter",
            model: OpenRouterDefaultModelId,
            content: JSON.stringify(assessment),
          };
        },
      },
      config: {
        provider: "openrouter",
        apiKey: "sk-or-v1-test",
        model: OpenRouterDefaultModelId,
        baseUrl: "https://openrouter.ai/api/v1",
      },
      now: () => new Date("2026-04-26T12:00:00-07:00"),
    });

    requests.push(request);
    await reviewer.assess(request);

    expect(completionRequests[0]?.controls).toEqual({
      maxOutputTokens: 10_000,
      responseFormat: "json_object",
      temperature: 0,
    });
  });

  it("returns malformed-response when model content is not JSON", async () => {
    const reviewer = new OpenRouterReviewer({
      chatProvider: completionProviderForContent("This is not JSON."),
      config: {
        provider: "openrouter",
        apiKey: "sk-or-v1-test",
        model: OpenRouterDefaultModelId,
        baseUrl: "https://openrouter.ai/api/v1",
      },
      now: () => new Date("2026-04-26T12:00:00-07:00"),
    });

    const result = await reviewer.assess(request);

    expect(result).toEqual({
      kind: "malformed-response",
      reviewer: {
        kind: "llm",
        name: "OpenRouter reviewer",
        reviewerVersion: "openrouter-reviewer.v1",
        modelProvider: "openrouter",
        modelName: OpenRouterDefaultModelId,
        reviewedAt: "2026-04-26T19:00:00.000Z",
      },
      rawResponse: "This is not JSON.",
      validationIssues: [
        {
          path: [],
          message: "Reviewer response was not valid JSON.",
        },
      ],
    });
  });

  it("accepts reviewer JSON wrapped in common model formatting", async () => {
    const reviewer = new OpenRouterReviewer({
      chatProvider: completionProviderForContent(
        [
          "Here is the structured reviewer assessment:",
          "",
          "```json",
          JSON.stringify(assessment),
          "```",
        ].join("\n"),
      ),
      config: {
        provider: "openrouter",
        apiKey: "sk-or-v1-test",
        model: OpenRouterDefaultModelId,
        baseUrl: "https://openrouter.ai/api/v1",
      },
      now: () => new Date("2026-04-26T12:00:00-07:00"),
    });

    const result = await reviewer.assess(request);

    expect(result).toEqual({ kind: "assessment", assessment });
  });

  it("accepts reviewer JSON returned as a JSON-encoded string", async () => {
    const reviewer = new OpenRouterReviewer({
      chatProvider: completionProviderForContent(
        JSON.stringify(JSON.stringify(assessment)),
      ),
      config: {
        provider: "openrouter",
        apiKey: "sk-or-v1-test",
        model: OpenRouterDefaultModelId,
        baseUrl: "https://openrouter.ai/api/v1",
      },
      now: () => new Date("2026-04-26T12:00:00-07:00"),
    });

    const result = await reviewer.assess(request);

    expect(result).toEqual({ kind: "assessment", assessment });
  });

  it("accepts reviewer JSON wrapped in a single-item array", async () => {
    const reviewer = new OpenRouterReviewer({
      chatProvider: completionProviderForContent(JSON.stringify([assessment])),
      config: {
        provider: "openrouter",
        apiKey: "sk-or-v1-test",
        model: OpenRouterDefaultModelId,
        baseUrl: "https://openrouter.ai/api/v1",
      },
      now: () => new Date("2026-04-26T12:00:00-07:00"),
    });

    const result = await reviewer.assess(request);

    expect(result).toEqual({ kind: "assessment", assessment });
  });

  it("normalizes reviewer evidence reference strings against collected evidence", async () => {
    const reviewer = new OpenRouterReviewer({
      chatProvider: completionProviderForContent(
        JSON.stringify({
          ...assessment,
          assessedArchetype: {
            ...assessment.assessedArchetype,
            evidenceReferences: ["evidence:package-json"],
          },
          dimensions: [
            {
              ...assessment.dimensions[0],
              evidenceReferences: [
                "test/add.spec.ts",
                "Reviewer-only reference",
              ],
            },
          ],
          caveats: [
            {
              id: "caveat:reviewer-only",
              summary: "Reviewer cited an unknown but useful reference.",
              affectedDimensions: ["verifiability"],
              missingEvidence: ["Additional test plan context"],
              confidence: {
                level: "medium",
                score: 0.6,
                rationale: "The reference came from reviewer output.",
              },
              evidenceReferences: ["Reviewer-only reference"],
            },
          ],
        }),
      ),
      config: {
        provider: "openrouter",
        apiKey: "sk-or-v1-test",
        model: OpenRouterDefaultModelId,
        baseUrl: "https://openrouter.ai/api/v1",
      },
      now: () => new Date("2026-04-26T12:00:00-07:00"),
    });

    const result = await reviewer.assess(request);

    expect(result.kind).toBe("assessment");
    if (result.kind !== "assessment") {
      throw new Error("Expected reviewer assessment");
    }
    expect(result.assessment.assessedArchetype.evidenceReferences).toEqual([
      packageManifestReference,
    ]);
    expect(result.assessment.dimensions[0]?.evidenceReferences).toEqual([
      testFileReference,
      {
        id: "reviewer:reviewer-only-reference",
        kind: "reviewer",
        label: "Reviewer-only reference",
      },
    ]);
    expect(result.assessment.caveats[0]?.evidenceReferences).toEqual([
      {
        id: "reviewer:reviewer-only-reference",
        kind: "reviewer",
        label: "Reviewer-only reference",
      },
    ]);
  });

  it("normalizes missing reviewer confidence rationales with a cautious default", async () => {
    const reviewer = new OpenRouterReviewer({
      chatProvider: completionProviderForContent(
        JSON.stringify({
          ...assessment,
          assessedArchetype: {
            ...assessment.assessedArchetype,
            confidence: {
              level: "high",
              score: 0.91,
            },
          },
          dimensions: [
            {
              ...assessment.dimensions[0],
              confidence: {
                level: "high",
                score: 0.9,
              },
            },
          ],
        }),
      ),
      config: {
        provider: "openrouter",
        apiKey: "sk-or-v1-test",
        model: OpenRouterDefaultModelId,
        baseUrl: "https://openrouter.ai/api/v1",
      },
      now: () => new Date("2026-04-26T12:00:00-07:00"),
    });

    const result = await reviewer.assess(request);

    expect(result.kind).toBe("assessment");
    if (result.kind !== "assessment") {
      throw new Error("Expected reviewer assessment");
    }
    expect(result.assessment.assessedArchetype.confidence.rationale).toContain(
      "did not provide",
    );
    expect(result.assessment.dimensions[0]?.confidence.rationale).toContain(
      "did not provide",
    );
  });

  it("normalizes loose reviewer evidence objects and missing archetype rationale", async () => {
    const reviewer = new OpenRouterReviewer({
      chatProvider: completionProviderForContent(
        JSON.stringify({
          ...assessment,
          assessedArchetype: {
            ...assessment.assessedArchetype,
            rationale: undefined,
            evidenceReferences: [
              {
                ...packageManifestReference,
                notes: "",
              },
            ],
          },
          dimensions: [
            {
              ...assessment.dimensions[0],
              evidenceReferences: [
                {
                  ...testFileReference,
                  path: null,
                  notes: "",
                  lineStart: 0,
                  lineEnd: 0,
                },
              ],
            },
          ],
        }),
      ),
      config: {
        provider: "openrouter",
        apiKey: "sk-or-v1-test",
        model: OpenRouterDefaultModelId,
        baseUrl: "https://openrouter.ai/api/v1",
      },
      now: () => new Date("2026-04-26T12:00:00-07:00"),
    });

    const result = await reviewer.assess(request);

    expect(result.kind).toBe("assessment");
    if (result.kind !== "assessment") {
      throw new Error("Expected reviewer assessment");
    }
    expect(result.assessment.assessedArchetype.rationale).toContain(
      "did not provide",
    );
    expect(
      result.assessment.assessedArchetype.evidenceReferences[0]?.notes,
    ).toBeUndefined();
    expect(
      result.assessment.dimensions[0]?.evidenceReferences[0]?.path,
    ).toBeUndefined();
    expect(
      result.assessment.dimensions[0]?.evidenceReferences[0]?.lineStart,
    ).toBeUndefined();
  });

  it("returns malformed-response when model JSON does not match the reviewer assessment schema", async () => {
    const malformedContent = JSON.stringify({
      schemaVersion: ReviewerAssessmentSchemaVersion,
    });
    const reviewer = new OpenRouterReviewer({
      chatProvider: completionProviderForContent(malformedContent),
      config: {
        provider: "openrouter",
        apiKey: "sk-or-v1-test",
        model: OpenRouterDefaultModelId,
        baseUrl: "https://openrouter.ai/api/v1",
      },
      now: () => new Date("2026-04-26T12:00:00-07:00"),
    });

    const result = await reviewer.assess(request);

    expect(result.kind).toBe("malformed-response");
    if (result.kind !== "malformed-response") {
      throw new Error("Expected malformed reviewer response");
    }
    expect(result.rawResponse).toBe(malformedContent);
    expect(result.validationIssues).toContainEqual({
      path: ["reviewer"],
      message: "Invalid input: expected object, received undefined",
    });
  });

  it("returns malformed-response when OpenRouter returns a provider failure", async () => {
    const reviewer = new OpenRouterReviewer({
      chatProvider: new OpenRouterChatCompletionProvider({
        fetcher: async () =>
          new Response(JSON.stringify({ error: "rate limited" }), {
            status: 429,
            headers: { "content-type": "application/json" },
          }),
      }),
      config: {
        provider: "openrouter",
        apiKey: "sk-or-v1-test",
        model: OpenRouterDefaultModelId,
        baseUrl: "https://openrouter.ai/api/v1",
      },
      now: () => new Date("2026-04-26T12:00:00-07:00"),
    });

    const result = await reviewer.assess(request);

    expect(result).toEqual({
      kind: "malformed-response",
      reviewer: {
        kind: "llm",
        name: "OpenRouter reviewer",
        reviewerVersion: "openrouter-reviewer.v1",
        modelProvider: "openrouter",
        modelName: OpenRouterDefaultModelId,
        reviewedAt: "2026-04-26T19:00:00.000Z",
      },
      rawResponse: "",
      validationIssues: [
        {
          path: [],
          message: `OpenRouter reviewer output is unavailable because OpenRouter returned status 429 for ${OpenRouterDefaultModelId}. The selected model or account may be rate limited; retry later or choose another structured-output-capable model.`,
        },
      ],
    });
  });
});

function completionProviderForContent(
  content: string,
): OpenRouterChatCompletionProvider {
  return new OpenRouterChatCompletionProvider({
    fetcher: async () =>
      new Response(
        JSON.stringify({
          choices: [{ message: { content } }],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
  });
}
