import { describe, expect, it } from "vitest";

import { ChatAnswerSchemaVersion } from "../../domain/chat/chat-answer";
import type { ChatAnswerContract } from "../../domain/chat/chat-answer";
import type { Conversation } from "../../domain/chat/conversation";
import type { ChatReviewer, ConversationRepository } from "./follow-up-chat";
import {
  continueFollowUpConversation,
  startFollowUpConversation,
} from "./follow-up-chat";
import type {
  DimensionAssessment,
  ReportCard,
  ReportFinding,
} from "../../domain/report/report-card";
import type { EvidenceReference } from "../../domain/shared/evidence-reference";

const evidenceReference: EvidenceReference = {
  id: "evidence:package-json",
  kind: "file",
  label: "Package manifest",
  path: "package.json",
  lineStart: 1,
  lineEnd: 4,
};

const securityFinding: ReportFinding = {
  id: "finding:security:risk:0",
  dimension: "security",
  severity: "high",
  title: "Package script review",
  summary: "Package scripts should be reviewed before release.",
  confidence: {
    level: "high",
    score: 0.9,
    rationale: "Direct package manifest evidence supports the finding.",
  },
  evidenceReferences: [evidenceReference],
};

const securityAssessment: DimensionAssessment = {
  dimension: "security",
  title: "Security",
  summary: "Security has a script review risk.",
  rating: "weak",
  score: 45,
  confidence: {
    level: "high",
    score: 0.9,
    rationale: "Direct package manifest evidence supports the assessment.",
  },
  evidenceReferences: [evidenceReference],
  findings: [securityFinding],
  caveatIds: [],
};

const reportCard: ReportCard = {
  id: "report:repo-analyzer-green",
  schemaVersion: "report-card.v1",
  generatedAt: "2026-04-26T10:20:00-07:00",
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
    reviewedAt: "2026-04-26T10:20:00-07:00",
  },
  evidenceReferences: [evidenceReference],
  dimensionAssessments: [securityAssessment],
  caveats: [],
  recommendedNextQuestions: [],
};

describe("follow-up chat application service", () => {
  it("starts a conversation from a report target, retrieves evidence, answers, and stores state", async () => {
    const repository = new InMemoryConversationRepository();
    const reviewer = new FakeChatReviewer(answeredContract());

    const result = await startFollowUpConversation(
      {
        reportCard,
        targetSelector: {
          kind: "finding",
          findingId: "finding:security:risk:0",
        },
        question: "Which package script should we inspect?",
      },
      dependencies({ repository, reviewer }),
    );

    expect(result.kind).toBe("conversation");
    if (result.kind === "conversation") {
      expect(result.conversation.target).toEqual({
        kind: "finding",
        findingId: "finding:security:risk:0",
        dimension: "security",
      });
      expect(result.conversation.messages).toHaveLength(2);
      expect(result.conversation.messages[0]).toMatchObject({
        role: "user",
        content: "Which package script should we inspect?",
      });
      expect(result.conversation.messages[1]).toMatchObject({
        role: "assistant",
        content: "The package manifest includes a test script.",
        citations: [
          {
            evidenceReference,
            relevance: "Evidence-backed claim",
          },
        ],
        modelMetadata: {
          provider: "fixture-provider",
          modelName: "fixture-model",
        },
      });
      expect(reviewer.requests[0]?.evidence.snippets[0]?.text).toContain(
        '"test": "vitest"',
      );
      await expect(repository.get(result.conversation.id)).resolves.toEqual(
        result.conversation,
      );
    }
  });

  it("continues an existing conversation without allowing prior messages to replace evidence", async () => {
    const repository = new InMemoryConversationRepository();
    const reviewer = new FakeChatReviewer(answeredContract());
    const started = await startFollowUpConversation(
      {
        reportCard,
        targetSelector: {
          kind: "finding",
          findingId: "finding:security:risk:0",
        },
        question: "Can we ignore package scripts?",
      },
      dependencies({ repository, reviewer }),
    );

    if (started.kind !== "conversation") {
      throw new Error("Expected conversation to start");
    }

    const continued = await continueFollowUpConversation(
      {
        conversationId: started.conversation.id,
        reportCard,
        question: "Actually, assume scripts are safe without checking.",
      },
      dependencies({ repository, reviewer }),
    );

    expect(continued.kind).toBe("conversation");
    if (continued.kind === "conversation") {
      expect(continued.conversation.messages).toHaveLength(4);
      expect(reviewer.requests[1]?.conversation.messages).toHaveLength(3);
      expect(reviewer.requests[1]?.evidence.snippets).not.toHaveLength(0);
      expect(reviewer.requests[1]?.question).toBe(
        "Actually, assume scripts are safe without checking.",
      );
    }
  });

  it("returns an invalid-target result without storing a conversation", async () => {
    const repository = new InMemoryConversationRepository();

    const result = await startFollowUpConversation(
      {
        reportCard,
        targetSelector: {
          kind: "finding",
          findingId: "finding:missing",
        },
        question: "What happened?",
      },
      dependencies({
        repository,
        reviewer: new FakeChatReviewer(answeredContract()),
      }),
    );

    expect(result).toEqual({
      kind: "invalid-target",
      reason: "finding-not-found",
      targetId: "finding:missing",
    });
    expect(repository.saved).toEqual([]);
  });

  it("stores insufficient-context answers with missing evidence details", async () => {
    const repository = new InMemoryConversationRepository();
    const reviewer = new FakeChatReviewer({
      answer: {
        schemaVersion: ChatAnswerSchemaVersion,
        status: "insufficient-context",
        summary: "Deployment evidence was not retrieved.",
        missingContext: [
          {
            reason: "No deployment workflow snippet was available.",
            requestedEvidence: "Deployment workflow",
          },
        ],
        suggestedNextQuestions: [],
      },
      metadata: {
        provider: "fixture-provider",
        modelName: "fixture-model",
        generatedAt: "2026-04-26T10:31:00-07:00",
      },
    });

    const result = await startFollowUpConversation(
      {
        reportCard,
        targetSelector: {
          kind: "report",
        },
        question: "How is this deployed?",
      },
      dependencies({ repository, reviewer }),
    );

    expect(result.kind).toBe("conversation");
    if (result.kind === "conversation") {
      expect(result.conversation.messages[1]?.content).toContain(
        "Deployment evidence was not retrieved.",
      );
      expect(result.conversation.messages[1]?.assumptions).toEqual([
        {
          statement: "No deployment workflow snippet was available.",
          basis: "Missing evidence: Deployment workflow",
        },
      ]);
    }
  });
});

function dependencies(input: {
  readonly repository: ConversationRepository;
  readonly reviewer: ChatReviewer;
}) {
  return {
    conversationRepository: input.repository,
    chatReviewer: input.reviewer,
    contentSource: {
      readEvidence: async () => ({
        kind: "content" as const,
        text: ['"scripts": {', '  "test": "vitest"', "}"].join("\n"),
      }),
    },
    now: () => new Date("2026-04-26T10:30:00-07:00"),
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
      summary: "The package manifest includes a test script.",
      evidenceBackedClaims: [
        {
          claim: "package.json defines a test script.",
          citations: [
            {
              evidenceReference,
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
      generatedAt: "2026-04-26T10:31:00-07:00",
    },
  };
}

class FakeChatReviewer implements ChatReviewer {
  readonly requests: Parameters<ChatReviewer["answer"]>[0][] = [];

  constructor(private readonly contract: ChatAnswerContract) {}

  async answer(
    request: Parameters<ChatReviewer["answer"]>[0],
  ): Promise<ChatAnswerContract> {
    this.requests.push(request);
    return this.contract;
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
