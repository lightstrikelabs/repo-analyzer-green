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
      maxOutputTokens: 1_200,
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
      responseFormat: "json_object",
      temperature: 0.25,
    });
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
