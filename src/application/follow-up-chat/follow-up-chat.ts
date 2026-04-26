import {
  ChatAnswerContractSchema,
  type ChatAnswerContract,
  type ChatAnswerMetadata,
} from "../../domain/chat/chat-answer";
import {
  ChatMessageSchema,
  ConversationSchema,
  ConversationSchemaVersion,
  type ChatAssumption,
  type ChatEvidenceCitation,
  type ChatMessage,
  type Conversation,
  type ConversationTarget,
} from "../../domain/chat/conversation";
import {
  type ConversationTargetSelector,
  type InvalidConversationTargetReason,
  resolveConversationTarget,
} from "../../domain/chat/conversation-target-resolver";
import {
  type EvidenceContentSource,
  type RetrieveEvidenceForFollowUpResult,
  retrieveEvidenceForFollowUp,
} from "../../domain/chat/evidence-retrieval";
import type { ReportCard } from "../../domain/report/report-card";

export interface ConversationRepository {
  get(id: string): Promise<Conversation | undefined>;
  save(conversation: Conversation): Promise<void>;
}

export type ChatReviewerRequest = {
  readonly reportCard: ReportCard;
  readonly conversation: Conversation;
  readonly target: ConversationTarget;
  readonly question: string;
  readonly evidence: RetrieveEvidenceForFollowUpResult;
};

export interface ChatReviewer {
  answer(request: ChatReviewerRequest): Promise<ChatAnswerContract>;
}

export type FollowUpChatDependencies = {
  readonly conversationRepository: ConversationRepository;
  readonly chatReviewer: ChatReviewer;
  readonly contentSource?: EvidenceContentSource;
  readonly now?: () => Date;
  readonly createId?: (prefix: string) => string;
};

export type StartFollowUpConversationInput = {
  readonly reportCard: ReportCard;
  readonly targetSelector: ConversationTargetSelector;
  readonly question: string;
};

export type ContinueFollowUpConversationInput = {
  readonly conversationId: string;
  readonly reportCard: ReportCard;
  readonly question: string;
};

export type FollowUpChatResult =
  | {
      readonly kind: "conversation";
      readonly conversation: Conversation;
      readonly answer: ChatAnswerContract;
      readonly evidence: RetrieveEvidenceForFollowUpResult;
    }
  | {
      readonly kind: "invalid-target";
      readonly reason: InvalidConversationTargetReason;
      readonly targetId: string;
    }
  | {
      readonly kind: "conversation-not-found";
      readonly conversationId: string;
    };

export async function startFollowUpConversation(
  input: StartFollowUpConversationInput,
  dependencies: FollowUpChatDependencies,
): Promise<FollowUpChatResult> {
  const targetResult = resolveConversationTarget(
    input.reportCard,
    input.targetSelector,
  );

  if (targetResult.kind === "invalid-target") {
    return targetResult;
  }

  const target = targetResult.target;
  const userMessage = userMessageFor(input.question, dependencies);
  const initialConversation = ConversationSchema.parse({
    id: createId(dependencies, "conversation"),
    schemaVersion: ConversationSchemaVersion,
    reportCardId: input.reportCard.id,
    repository: input.reportCard.repository,
    target,
    messages: [userMessage],
    createdAt: nowIso(dependencies),
    updatedAt: nowIso(dependencies),
  });

  return answerAndSaveConversation({
    reportCard: input.reportCard,
    conversation: initialConversation,
    target,
    question: input.question,
    dependencies,
  });
}

export async function continueFollowUpConversation(
  input: ContinueFollowUpConversationInput,
  dependencies: FollowUpChatDependencies,
): Promise<FollowUpChatResult> {
  const existing = await dependencies.conversationRepository.get(
    input.conversationId,
  );

  if (existing === undefined) {
    return {
      kind: "conversation-not-found",
      conversationId: input.conversationId,
    };
  }

  const target = existing.target ?? { kind: "report" };
  const conversationWithQuestion = ConversationSchema.parse({
    ...existing,
    messages: [
      ...existing.messages,
      userMessageFor(input.question, dependencies),
    ],
    updatedAt: nowIso(dependencies),
  });

  return answerAndSaveConversation({
    reportCard: input.reportCard,
    conversation: conversationWithQuestion,
    target,
    question: input.question,
    dependencies,
  });
}

async function answerAndSaveConversation(input: {
  readonly reportCard: ReportCard;
  readonly conversation: Conversation;
  readonly target: ConversationTarget;
  readonly question: string;
  readonly dependencies: FollowUpChatDependencies;
}): Promise<FollowUpChatResult> {
  const evidence = await retrieveEvidenceForFollowUp({
    reportCard: input.reportCard,
    target: input.target,
    question: input.question,
    ...(input.dependencies.contentSource === undefined
      ? {}
      : { contentSource: input.dependencies.contentSource }),
  });
  const answer = ChatAnswerContractSchema.parse(
    await input.dependencies.chatReviewer.answer({
      reportCard: input.reportCard,
      conversation: input.conversation,
      target: input.target,
      question: input.question,
      evidence,
    }),
  );
  const assistantMessage = assistantMessageFor(answer, input.dependencies);
  const conversation = ConversationSchema.parse({
    ...input.conversation,
    messages: [...input.conversation.messages, assistantMessage],
    updatedAt: nowIso(input.dependencies),
  });

  await input.dependencies.conversationRepository.save(conversation);

  return {
    kind: "conversation",
    conversation,
    answer,
    evidence,
  };
}

function userMessageFor(
  question: string,
  dependencies: FollowUpChatDependencies,
): ChatMessage {
  return ChatMessageSchema.parse({
    id: createId(dependencies, "message"),
    role: "user",
    content: question,
    citations: [],
    assumptions: [],
    createdAt: nowIso(dependencies),
  });
}

function assistantMessageFor(
  contract: ChatAnswerContract,
  dependencies: FollowUpChatDependencies,
): ChatMessage {
  return ChatMessageSchema.parse({
    id: createId(dependencies, "message"),
    role: "assistant",
    content: contentForAnswer(contract.answer),
    citations: citationsForAnswer(contract.answer),
    assumptions: assumptionsForAnswer(contract.answer),
    ...(contract.metadata === undefined
      ? {}
      : { modelMetadata: modelMetadataFor(contract.metadata) }),
    createdAt: nowIso(dependencies),
  });
}

function contentForAnswer(answer: ChatAnswerContract["answer"]): string {
  return answer.summary;
}

function citationsForAnswer(
  answer: ChatAnswerContract["answer"],
): readonly ChatEvidenceCitation[] {
  if (answer.status === "insufficient-context") {
    return [];
  }

  return answer.evidenceBackedClaims.flatMap((claim) =>
    claim.citations.map((citation) => ({
      evidenceReference: citation.evidenceReference,
      relevance: "Evidence-backed claim",
    })),
  );
}

function assumptionsForAnswer(
  answer: ChatAnswerContract["answer"],
): readonly ChatAssumption[] {
  if (answer.status === "answered") {
    return answer.assumptions;
  }

  return answer.missingContext.map((context) => ({
    statement: context.reason,
    ...(context.requestedEvidence === undefined
      ? {}
      : { basis: `Missing evidence: ${context.requestedEvidence}` }),
  }));
}

function modelMetadataFor(metadata: ChatAnswerMetadata) {
  return {
    provider: metadata.provider,
    modelName: metadata.modelName,
    ...(metadata.modelVersion === undefined
      ? {}
      : { modelVersion: metadata.modelVersion }),
    ...(metadata.responseId === undefined
      ? {}
      : { responseId: metadata.responseId }),
  };
}

function nowIso(dependencies: FollowUpChatDependencies): string {
  return (dependencies.now ?? (() => new Date()))().toISOString();
}

function createId(
  dependencies: FollowUpChatDependencies,
  prefix: string,
): string {
  return dependencies.createId?.(prefix) ?? `${prefix}:${crypto.randomUUID()}`;
}
