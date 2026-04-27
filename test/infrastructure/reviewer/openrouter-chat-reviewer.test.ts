import { z } from "zod";
import { describe, expect, it } from "vitest";

import {
  ChatAnswerSchemaVersion,
  type ChatAnswer,
} from "../../../src/domain/chat/chat-answer";
import {
  ConversationSchemaVersion,
  type Conversation,
} from "../../../src/domain/chat/conversation";
import type { RetrieveEvidenceForFollowUpResult } from "../../../src/domain/chat/evidence-retrieval";
import type { ReportCard } from "../../../src/domain/report/report-card";
import type { EvidenceReference } from "../../../src/domain/shared/evidence-reference";
import type { OpenRouterChatCompletionProvider } from "../../../src/infrastructure/llm/openrouter-chat-provider";
import {
  OpenRouterDefaultBaseUrl,
  OpenRouterDefaultModelId,
} from "../../../src/infrastructure/llm/openrouter-config";
import { OpenRouterChatReviewer } from "../../../src/infrastructure/reviewer/openrouter-chat-reviewer";
import { analyzeRepositoryResponseFixture } from "../../support/analyze-repository-response-fixture";

const reportCard = analyzeRepositoryResponseFixture.reportCard;

const packageEvidence: EvidenceReference = {
  id: "evidence:package-json",
  kind: "file",
  label: "Package manifest",
  path: "package.json",
};

const PromptContextSchema = z
  .object({
    report: z
      .object({
        repository: z.object({ name: z.string().min(1) }).passthrough(),
        target: z.object({ kind: z.string().min(1) }).passthrough(),
      })
      .passthrough(),
    reportCard: z.unknown().optional(),
    responseShape: z
      .object({
        answer: z.object({ summary: z.string().min(1) }).passthrough(),
      })
      .passthrough(),
  })
  .passthrough();

describe("OpenRouterChatReviewer", () => {
  it("requests structured JSON output with follow-up-safe defaults", async () => {
    const completionRequests: Parameters<
      OpenRouterChatCompletionProvider["complete"]
    >[0][] = [];
    const reviewer = new OpenRouterChatReviewer({
      chatProvider: {
        complete: async (completionRequest) => {
          completionRequests.push(completionRequest);
          return {
            kind: "completed",
            provider: "openrouter",
            model: OpenRouterDefaultModelId,
            content: JSON.stringify({ answer: answeredChatAnswer() }),
            rawResponseId: "completion:follow-up",
          };
        },
      },
      config: {
        provider: "openrouter",
        apiKey: "sk-or-v1-test",
        model: OpenRouterDefaultModelId,
        baseUrl: OpenRouterDefaultBaseUrl,
      },
      now: () => new Date("2026-04-26T12:00:00-07:00"),
    });

    const answer = await reviewer.answer({
      reportCard,
      conversation: conversation(),
      target: { kind: "report" },
      question: "What should we verify first?",
      evidence: evidenceResult(),
    });

    expect(answer.metadata).toEqual({
      provider: "openrouter",
      modelName: OpenRouterDefaultModelId,
      responseId: "completion:follow-up",
      generatedAt: "2026-04-26T19:00:00.000Z",
    });
    expect(completionRequests[0]?.controls).toEqual({
      maxOutputTokens: 4_000,
      reasoning: {
        effort: "minimal",
        exclude: true,
      },
      responseFormat: "json_object",
      temperature: 0.2,
    });
    expect(completionRequests[0]?.metadata).toEqual({
      usageContext: "follow-up-answer",
      repository: "local-fixture:minimal-node-library @ fixture",
    });
  });

  it("keeps caller-provided output budget and temperature while enforcing JSON mode", async () => {
    const completionRequests: Parameters<
      OpenRouterChatCompletionProvider["complete"]
    >[0][] = [];
    const reviewer = new OpenRouterChatReviewer({
      chatProvider: {
        complete: async (completionRequest) => {
          completionRequests.push(completionRequest);
          return {
            kind: "completed",
            provider: "openrouter",
            model: OpenRouterDefaultModelId,
            content: JSON.stringify({ answer: answeredChatAnswer() }),
          };
        },
      },
      config: {
        provider: "openrouter",
        apiKey: "sk-or-v1-test",
        model: OpenRouterDefaultModelId,
        baseUrl: OpenRouterDefaultBaseUrl,
      },
      controls: {
        maxOutputTokens: 900,
        temperature: 0.25,
      },
      now: () => new Date("2026-04-26T12:00:00-07:00"),
    });

    await reviewer.answer({
      reportCard,
      conversation: conversation(),
      target: { kind: "report" },
      question: "What should we verify first?",
      evidence: evidenceResult(),
    });

    expect(completionRequests[0]?.controls).toEqual({
      maxOutputTokens: 900,
      reasoning: {
        effort: "minimal",
        exclude: true,
      },
      responseFormat: "json_object",
      temperature: 0.25,
    });
  });

  it("normalizes common provider JSON drift before validating chat answers", async () => {
    const reviewer = new OpenRouterChatReviewer({
      chatProvider: {
        complete: async () => ({
          kind: "completed",
          provider: "openrouter",
          model: OpenRouterDefaultModelId,
          content: JSON.stringify({
            answer: {
              schemaVersion: "chat-answer.v1",
              status: "answered",
              text: "package.json defines a Vitest test script.",
              evidenceBackedClaims: [
                {
                  claim: "The package manifest includes a test script.",
                  citations: [
                    {
                      evidenceReference: {
                        evidenceReference: packageEvidence,
                      },
                      quote: '"test": "vitest"',
                    },
                  ],
                },
              ],
              assumptions: [],
              caveats: [],
              suggestedNextQuestions: [],
            },
          }),
        }),
      },
      config: {
        provider: "openrouter",
        apiKey: "sk-or-v1-test",
        model: OpenRouterDefaultModelId,
        baseUrl: OpenRouterDefaultBaseUrl,
      },
      now: () => new Date("2026-04-26T12:00:00-07:00"),
    });

    const answer = await reviewer.answer({
      reportCard,
      conversation: conversation(),
      target: { kind: "report" },
      question: "What should we verify first?",
      evidence: evidenceResult(),
    });

    expect(answer.answer).toMatchObject({
      status: "answered",
      summary: "package.json defines a Vitest test script.",
      evidenceBackedClaims: [
        {
          citations: [
            {
              evidenceReference: packageEvidence,
              quote: '"test": "vitest"',
            },
          ],
        },
      ],
    });
  });

  it("sends compact target report context instead of the full report card", async () => {
    const completionRequests: Parameters<
      OpenRouterChatCompletionProvider["complete"]
    >[0][] = [];
    const reviewer = new OpenRouterChatReviewer({
      chatProvider: {
        complete: async (completionRequest) => {
          completionRequests.push(completionRequest);
          return {
            kind: "completed",
            provider: "openrouter",
            model: OpenRouterDefaultModelId,
            content: JSON.stringify({ answer: answeredChatAnswer() }),
          };
        },
      },
      config: {
        provider: "openrouter",
        apiKey: "sk-or-v1-test",
        model: OpenRouterDefaultModelId,
        baseUrl: OpenRouterDefaultBaseUrl,
      },
    });
    const unrelatedEvidence: EvidenceReference = {
      id: "evidence:unrelated-large-file",
      kind: "file",
      label: "Unrelated large file",
      path: "src/unrelated-large-file.ts",
    };

    await reviewer.answer({
      reportCard: reportCardWithUnrelatedEvidence(unrelatedEvidence),
      conversation: conversation(),
      target: { kind: "dimension", dimension: "verifiability" },
      question: "Which tests are flaky?",
      evidence: evidenceResult(),
    });

    const userMessage = completionRequests[0]?.messages.find(
      (message) => message.role === "user",
    );

    expect(userMessage?.content).not.toContain("src/unrelated-large-file.ts");
    const promptContext = PromptContextSchema.parse(
      JSON.parse(requiredContent(userMessage?.content)),
    );
    expect(promptContext.reportCard).toBeUndefined();
    expect(promptContext.report.repository.name).toBe("minimal-node-library");
    expect(promptContext.report.target).toMatchObject({
      kind: "dimension",
      assessment: {
        dimension: "verifiability",
      },
    });
    expect(promptContext.responseShape.answer.summary).toBe("string");
    expect(promptContext.responseShape.answer).not.toHaveProperty("text");
  });
});

function conversation(): Conversation {
  const timestamp = "2026-04-26T19:00:00.000Z";
  return {
    id: "conversation:1",
    schemaVersion: ConversationSchemaVersion,
    reportCardId: reportCard.id,
    repository: reportCard.repository,
    target: { kind: "report" },
    messages: [
      {
        id: "message:1",
        role: "user",
        content: "What should we verify first?",
        citations: [],
        assumptions: [],
        createdAt: timestamp,
      },
    ],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function evidenceResult(): RetrieveEvidenceForFollowUpResult {
  return {
    snippets: [
      {
        evidenceReference: packageEvidence,
        text: '"test": "vitest"',
        source: "fresh-content",
        targetRelevance: "report",
        rank: 100,
      },
    ],
    missingContext: [],
  };
}

function answeredChatAnswer(): ChatAnswer {
  return {
    schemaVersion: ChatAnswerSchemaVersion,
    status: "answered",
    summary: "package.json defines a Vitest test script.",
    evidenceBackedClaims: [
      {
        claim: "The package manifest includes a test script.",
        citations: [
          {
            evidenceReference: packageEvidence,
            quote: '"test": "vitest"',
          },
        ],
      },
    ],
    assumptions: [],
    caveats: [],
    suggestedNextQuestions: [],
  };
}

function reportCardWithUnrelatedEvidence(
  unrelatedEvidence: EvidenceReference,
): ReportCard {
  return {
    ...reportCard,
    evidenceReferences: [...reportCard.evidenceReferences, unrelatedEvidence],
  };
}

function requiredContent(content: string | undefined): string {
  if (content === undefined) {
    throw new Error("Expected prompt content to be recorded.");
  }

  return content;
}
