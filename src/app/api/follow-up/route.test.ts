import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ChatAnswerSchemaVersion,
  type ChatAnswerContract,
} from "../../../domain/chat/chat-answer";
import type { Conversation } from "../../../domain/chat/conversation";
import type { EvidenceContentResult } from "../../../domain/chat/evidence-retrieval";
import type { ReportCard } from "../../../domain/report/report-card";
import type { EvidenceReference } from "../../../domain/shared/evidence-reference";
import type {
  ChatReviewer,
  ConversationRepository,
} from "../../../application/follow-up-chat/follow-up-chat";
import { OpenRouterDefaultBaseUrl } from "../../../infrastructure/llm/openrouter-config";
import {
  FollowUpAnswerValidationError,
  FollowUpProviderError,
  handleFollowUpRequest,
  POST,
  type FollowUpRouteOptions,
} from "./route";

const packageEvidence: EvidenceReference = {
  id: "evidence:package-json",
  kind: "file",
  label: "Package manifest",
  path: "package.json",
  lineStart: 1,
  lineEnd: 5,
};

const ciEvidence: EvidenceReference = {
  id: "evidence:ci-workflow",
  kind: "file",
  label: "CI workflow",
  path: ".github/workflows/ci.yml",
};

const reportCard: ReportCard = {
  id: "report:repo-analyzer-green",
  schemaVersion: "report-card.v1",
  generatedAt: "2026-04-26T12:00:00-07:00",
  scoringPolicy: {
    name: "repo-analyzer-green scoring policy",
    version: "0.1.0",
  },
  repository: {
    provider: "github",
    owner: "lightstrikelabs",
    name: "repo-analyzer-green",
    url: "https://github.com/lightstrikelabs/repo-analyzer-green",
    revision: "main",
  },
  assessedArchetype: "web-app",
  reviewerMetadata: {
    kind: "fake",
    name: "Fixture reviewer",
    reviewedAt: "2026-04-26T12:00:00-07:00",
  },
  evidenceReferences: [packageEvidence, ciEvidence],
  dimensionAssessments: [
    {
      dimension: "verifiability",
      title: "Verifiability",
      summary: "Tests and CI are present.",
      rating: "good",
      score: 82,
      confidence: {
        level: "high",
        score: 0.86,
        rationale: "Package and workflow evidence were collected.",
      },
      evidenceReferences: [packageEvidence, ciEvidence],
      findings: [
        {
          id: "finding:verifiability:test-script",
          dimension: "verifiability",
          severity: "medium",
          title: "Test script exists",
          summary: "The package manifest exposes a test script.",
          confidence: {
            level: "high",
            score: 0.9,
            rationale: "package.json was collected.",
          },
          evidenceReferences: [packageEvidence],
        },
      ],
      caveatIds: ["caveat:deployment-missing"],
    },
  ],
  caveats: [
    {
      id: "caveat:deployment-missing",
      title: "Deployment evidence missing",
      summary: "Deployment workflow context was not collected.",
      affectedDimensions: ["verifiability"],
      missingEvidence: ["Deployment workflow"],
    },
  ],
  recommendedNextQuestions: [],
};

describe("POST /api/follow-up", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses follow-up controls that leave room for reasoning-model answers", async () => {
    const providerRequests: Request[] = [];
    vi.stubGlobal("fetch", async (providerRequest: Request) => {
      providerRequests.push(providerRequest);
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({ answer: answeredContract().answer }),
              },
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });

    const response = await POST(jsonRequest(validStartRequest()));

    expect(response.status).toBe(200);
    expect(providerRequests).toHaveLength(1);
    expect(await providerRequests[0]?.json()).toMatchObject({
      max_tokens: 4_000,
      reasoning: {
        effort: "minimal",
        exclude: true,
      },
      response_format: { type: "json_object" },
    });
  });

  it("starts a live follow-up from a red-style report section target and preserves evidence snippets", async () => {
    const repository = new InMemoryConversationRepository();
    const reviewer = new RecordingChatReviewer(answeredContract());
    const response = await handleFollowUpRequest(
      jsonRequest({
        reportCard,
        target: {
          kind: "report-section",
          sectionId: "testing",
        },
        messages: [
          {
            role: "user",
            content: "What should I verify first?",
          },
        ],
        question: "What should I verify first?",
        apiKey: " sk-or-v1-test ",
        model: "openai/gpt-4.1-mini",
      }),
      dependencies({ repository, reviewer }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.conversation.target).toEqual({
      kind: "dimension",
      dimension: "verifiability",
    });
    expect(body.answer.answer.status).toBe("answered");
    expect(body.evidence.snippets[0]).toMatchObject({
      evidenceReference: packageEvidence,
      text: expect.stringContaining('"test": "vitest"'),
      source: "fresh-content",
      targetRelevance: "dimension",
    });
    expect(reviewer.requests[0]?.question).toBe("What should I verify first?");
    expect(reviewer.options).toEqual([
      {
        openRouterConfig: {
          provider: "openrouter",
          apiKey: "sk-or-v1-test",
          model: "openai/gpt-4.1-mini",
          baseUrl: OpenRouterDefaultBaseUrl,
        },
      },
    ]);
    expect(JSON.stringify(repository.saved)).not.toContain("sk-or-v1-test");
  });

  it("continues a persisted conversation by id", async () => {
    const repository = new InMemoryConversationRepository();
    const reviewer = new RecordingChatReviewer(answeredContract());
    const startResponse = await handleFollowUpRequest(
      jsonRequest(validStartRequest()),
      dependencies({ repository, reviewer }),
    );
    const started = await startResponse.json();

    const response = await handleFollowUpRequest(
      jsonRequest({
        reportCard,
        conversationId: started.conversation.id,
        messages: started.conversation.messages.map(
          (message: { readonly role: string; readonly content: string }) => ({
            role: message.role,
            content: message.content,
          }),
        ),
        question: "Which file proves that?",
        apiKey: "sk-or-v1-test",
      }),
      dependencies({ repository, reviewer }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.conversation.id).toBe(started.conversation.id);
    expect(body.conversation.messages).toHaveLength(4);
    expect(reviewer.requests[1]?.conversation.messages).toHaveLength(3);
  });

  it("requires an API key for live follow-up without persisting a conversation", async () => {
    const repository = new InMemoryConversationRepository();
    const response = await handleFollowUpRequest(
      jsonRequest({
        ...validStartRequest(),
        apiKey: "",
      }),
      dependencies({
        repository,
        reviewer: new RecordingChatReviewer(answeredContract()),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toEqual({
      code: "openrouter-api-key-required",
      message: "OpenRouter API key is required for follow-up questions.",
    });
    expect(repository.saved).toEqual([]);
  });

  it("returns invalid target details", async () => {
    const response = await handleFollowUpRequest(
      jsonRequest({
        ...validStartRequest(),
        target: {
          kind: "finding",
          findingId: "finding:missing",
        },
      }),
      dependencies({
        repository: new InMemoryConversationRepository(),
        reviewer: new RecordingChatReviewer(answeredContract()),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toEqual({
      code: "invalid-target",
      message: "Follow-up target could not be resolved.",
      reason: "finding-not-found",
      targetId: "finding:missing",
    });
  });

  it("returns missing conversation details", async () => {
    const response = await handleFollowUpRequest(
      jsonRequest({
        reportCard,
        conversationId: "conversation:missing",
        messages: [],
        question: "What changed?",
        apiKey: "sk-or-v1-test",
      }),
      dependencies({
        repository: new InMemoryConversationRepository(),
        reviewer: new RecordingChatReviewer(answeredContract()),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toEqual({
      code: "conversation-not-found",
      message: "Follow-up conversation could not be found.",
      conversationId: "conversation:missing",
    });
  });

  it("maps malformed model output to a bad gateway response", async () => {
    const response = await handleFollowUpRequest(
      jsonRequest(validStartRequest()),
      dependencies({
        repository: new InMemoryConversationRepository(),
        reviewer: new ThrowingChatReviewer(
          new FollowUpAnswerValidationError([
            {
              path: ["answer", "evidenceBackedClaims", 0, "citations"],
              message: "Evidence-backed claims must include citations.",
            },
          ]),
        ),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.error).toEqual({
      code: "follow-up-answer-malformed",
      message: "Follow-up answer could not be validated.",
      issues: [
        {
          path: ["answer", "evidenceBackedClaims", 0, "citations"],
          message: "Evidence-backed claims must include citations.",
        },
      ],
    });
  });

  it("maps provider failures without leaking credentials", async () => {
    const response = await handleFollowUpRequest(
      jsonRequest(validStartRequest()),
      dependencies({
        repository: new InMemoryConversationRepository(),
        reviewer: new ThrowingChatReviewer(
          new FollowUpProviderError(
            "provider-error",
            "OpenRouter follow-up answer is unavailable because the provider request failed.",
            502,
          ),
        ),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(JSON.stringify(body)).not.toContain("sk-or-v1-test");
    expect(body.error).toEqual({
      code: "provider-error",
      message:
        "OpenRouter follow-up answer is unavailable because the provider request failed.",
      status: 502,
    });
  });

  it("preserves insufficient-context answers and missing evidence state", async () => {
    const response = await handleFollowUpRequest(
      jsonRequest({
        ...validStartRequest(),
        target: {
          kind: "caveat",
          caveatId: "caveat:deployment-missing",
        },
      }),
      dependencies({
        repository: new InMemoryConversationRepository(),
        reviewer: new RecordingChatReviewer(insufficientContextContract()),
        contentByPath: new Map(),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.answer.answer.status).toBe("insufficient-context");
    expect(body.answer.answer.missingContext).toEqual([
      {
        reason: "Deployment workflow evidence was not available.",
        requestedEvidence: "Deployment workflow",
      },
    ]);
    expect(body.evidence.missingContext).toEqual([
      {
        evidenceReference: packageEvidence,
        reason: "package.json was not available in the content source",
      },
      {
        evidenceReference: ciEvidence,
        reason:
          ".github/workflows/ci.yml was not available in the content source",
      },
    ]);
  });

  it("rejects malformed request bodies with validation issues", async () => {
    const response = await handleFollowUpRequest(
      jsonRequest({
        reportCard,
        target: {
          kind: "dimension",
          dimension: "testing",
        },
        messages: [
          {
            role: "assistant",
            content: "",
          },
        ],
        question: "",
        apiKey: "sk-or-v1-test",
      }),
      dependencies({
        repository: new InMemoryConversationRepository(),
        reviewer: new RecordingChatReviewer(answeredContract()),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("invalid-request");
    expect(body.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: ["question"],
        }),
        expect.objectContaining({
          path: ["target"],
        }),
      ]),
    );
  });
});

function validStartRequest() {
  return {
    reportCard,
    target: {
      kind: "finding",
      findingId: "finding:verifiability:test-script",
    },
    messages: [
      {
        role: "user",
        content: "What test signal matters most?",
      },
    ],
    question: "What test signal matters most?",
    apiKey: "sk-or-v1-test",
  } as const;
}

function dependencies(input: {
  readonly repository: InMemoryConversationRepository;
  readonly reviewer: ChatReviewer;
  readonly contentByPath?: ReadonlyMap<string, string>;
}) {
  const recorder =
    input.reviewer instanceof RecordingChatReviewer
      ? input.reviewer
      : undefined;

  return {
    conversationRepository: input.repository,
    createChatReviewer: (options: FollowUpRouteOptions) => {
      recorder?.options.push(options);
      return input.reviewer;
    },
    contentSource: {
      readEvidence: async (
        reference: EvidenceReference,
      ): Promise<EvidenceContentResult> => {
        const content = input.contentByPath?.get(reference.path ?? "");
        if (content !== undefined) {
          return {
            kind: "content",
            text: content,
          };
        }

        if (input.contentByPath !== undefined) {
          return {
            kind: "missing",
            reason: `${reference.path ?? reference.id} was not available in the content source`,
          };
        }

        return {
          kind: "content",
          text: [
            "{",
            '  "scripts": {',
            '    "test": "vitest",',
            '    "lint": "oxlint ."',
            "  }",
            "}",
          ].join("\n"),
        };
      },
    },
    now: () => new Date("2026-04-26T12:30:00-07:00"),
    createId: (() => {
      let index = 0;
      return (prefix: string) => `${prefix}:${++index}`;
    })(),
  };
}

function answeredContract(): ChatAnswerContract {
  return {
    answer: {
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
    },
    metadata: {
      provider: "fixture-provider",
      modelName: "fixture-model",
      generatedAt: "2026-04-26T12:31:00-07:00",
    },
  };
}

function insufficientContextContract(): ChatAnswerContract {
  return {
    answer: {
      schemaVersion: ChatAnswerSchemaVersion,
      status: "insufficient-context",
      summary: "Deployment workflow evidence was not available.",
      missingContext: [
        {
          reason: "Deployment workflow evidence was not available.",
          requestedEvidence: "Deployment workflow",
        },
      ],
      suggestedNextQuestions: [],
    },
    metadata: {
      provider: "fixture-provider",
      modelName: "fixture-model",
      generatedAt: "2026-04-26T12:31:00-07:00",
    },
  };
}

class RecordingChatReviewer implements ChatReviewer {
  readonly requests: Parameters<ChatReviewer["answer"]>[0][] = [];
  readonly options: FollowUpRouteOptions[] = [];

  constructor(private readonly contract: ChatAnswerContract) {}

  async answer(
    request: Parameters<ChatReviewer["answer"]>[0],
  ): Promise<ChatAnswerContract> {
    this.requests.push(request);
    return this.contract;
  }
}

class ThrowingChatReviewer implements ChatReviewer {
  constructor(private readonly error: Error) {}

  async answer(): Promise<ChatAnswerContract> {
    throw this.error;
  }
}

class InMemoryConversationRepository implements ConversationRepository {
  readonly saved: Conversation[] = [];
  private readonly conversations = new Map<string, Conversation>();

  async get(id: string): Promise<Conversation | undefined> {
    return this.conversations.get(id);
  }

  async save(conversation: Conversation): Promise<void> {
    this.saved.push(conversation);
    this.conversations.set(conversation.id, conversation);
  }
}

function jsonRequest(body: object): Request {
  return new Request("http://localhost/api/follow-up", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}
