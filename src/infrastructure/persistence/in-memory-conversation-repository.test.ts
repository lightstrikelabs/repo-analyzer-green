import { describe, expect, it } from "vitest";

import { InMemoryConversationRepository } from "./in-memory-conversation-repository";
import type { Conversation } from "../../domain/chat/conversation";

const conversation: Conversation = {
  id: "conversation:1",
  schemaVersion: "conversation.v1",
  reportCardId: "report:1",
  repository: {
    provider: "local-fixture",
    name: "minimal-node-library",
    revision: "fixture",
  },
  target: {
    kind: "report",
  },
  messages: [
    {
      id: "message:1",
      role: "user",
      content: "What should we inspect first?",
      citations: [],
      assumptions: [],
      createdAt: "2026-04-26T10:00:00-07:00",
    },
  ],
  createdAt: "2026-04-26T10:00:00-07:00",
  updatedAt: "2026-04-26T10:01:00-07:00",
};

describe("InMemoryConversationRepository", () => {
  it("stores and retrieves conversations through the shared repository port", async () => {
    const repository = new InMemoryConversationRepository();

    await repository.save(conversation);

    await expect(repository.get(conversation.id)).resolves.toEqual(
      conversation,
    );
  });

  it("can replace all stored conversations for browser hydration", async () => {
    const repository = new InMemoryConversationRepository([conversation]);
    const nextConversation = {
      ...conversation,
      id: "conversation:2",
    } satisfies Conversation;

    repository.replaceAll([nextConversation]);

    await expect(repository.get(conversation.id)).resolves.toBeUndefined();
    await expect(repository.get(nextConversation.id)).resolves.toEqual(
      nextConversation,
    );
  });
});
