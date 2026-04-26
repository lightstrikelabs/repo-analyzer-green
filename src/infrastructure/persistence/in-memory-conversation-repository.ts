import type { Conversation } from "../../domain/chat/conversation";
import type { ConversationRepository } from "../../application/follow-up-chat/follow-up-chat";

export class InMemoryConversationRepository implements ConversationRepository {
  private readonly conversations = new Map<string, Conversation>();

  constructor(initialConversations: readonly Conversation[] = []) {
    this.replaceAll(initialConversations);
  }

  async get(id: string): Promise<Conversation | undefined> {
    return this.conversations.get(id);
  }

  async save(conversation: Conversation): Promise<void> {
    this.conversations.set(conversation.id, conversation);
  }

  replaceAll(conversations: readonly Conversation[]): void {
    this.conversations.clear();
    for (const conversation of conversations) {
      this.conversations.set(conversation.id, conversation);
    }
  }
}
