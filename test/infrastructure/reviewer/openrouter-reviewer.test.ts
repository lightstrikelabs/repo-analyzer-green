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
      temperature: 0,
    });
    expect(body.messages).toHaveLength(2);
    expect(body.messages[0]).toMatchObject({ role: "system" });
    expect(body.messages[1]).toMatchObject({ role: "user" });
    expect(body.messages[1].content).toContain(
      "[Evidence summary truncated at 32 characters.]",
    );
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
          message:
            "OpenRouter reviewer output is unavailable because the provider request failed.",
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
