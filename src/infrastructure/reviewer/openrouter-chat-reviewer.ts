import { z } from "zod";

import {
  ChatAnswerSchema,
  ChatAnswerContractSchema,
  type ChatAnswerContract,
} from "../../domain/chat/chat-answer";
import type {
  ChatReviewer,
  ChatReviewerRequest,
} from "../../application/follow-up-chat/follow-up-chat";
import {
  type OpenRouterChatCompletionControls,
  OpenRouterChatCompletionProvider,
  type OpenRouterProviderFailureCode,
} from "../llm/openrouter-chat-provider";
import type { OpenRouterProviderConfig } from "../llm/openrouter-config";

export type FollowUpValidationIssue = {
  readonly path: readonly (string | number)[];
  readonly message: string;
};

export class FollowUpAnswerValidationError extends Error {
  readonly issues: readonly FollowUpValidationIssue[];

  constructor(issues: readonly FollowUpValidationIssue[]) {
    super("Follow-up answer could not be validated.");
    this.name = "FollowUpAnswerValidationError";
    this.issues = issues;
  }
}

export class FollowUpProviderError extends Error {
  readonly code: OpenRouterProviderFailureCode;
  readonly status: number | undefined;

  constructor(
    code: OpenRouterProviderFailureCode,
    message: string,
    status?: number,
  ) {
    super(message);
    this.name = "FollowUpProviderError";
    this.code = code;
    this.status = status;
  }
}

export type OpenRouterChatReviewerOptions = {
  readonly chatProvider?: Pick<OpenRouterChatCompletionProvider, "complete">;
  readonly config: OpenRouterProviderConfig;
  readonly controls?: OpenRouterChatCompletionControls;
  readonly now?: () => Date;
};

const DefaultFollowUpMaxOutputTokens = 1_200;
const DefaultFollowUpTemperature = 0.2;

const ProviderChatAnswerResponseSchema = z
  .object({
    answer: ChatAnswerSchema,
  })
  .strict();

export class OpenRouterChatReviewer implements ChatReviewer {
  private readonly chatProvider: Pick<
    OpenRouterChatCompletionProvider,
    "complete"
  >;
  private readonly config: OpenRouterProviderConfig;
  private readonly controls: OpenRouterChatCompletionControls | undefined;
  private readonly now: () => Date;

  constructor(options: OpenRouterChatReviewerOptions) {
    this.chatProvider =
      options.chatProvider ?? new OpenRouterChatCompletionProvider();
    this.config = options.config;
    this.controls = chatControls(options.controls);
    this.now = options.now ?? (() => new Date());
  }

  async answer(request: ChatReviewerRequest): Promise<ChatAnswerContract> {
    const result = await this.chatProvider.complete({
      config: this.config,
      metadata: {
        usageContext: "follow-up-answer",
        repository: repositoryLabel(request),
      },
      messages: [
        {
          role: "system",
          content: systemPrompt(),
        },
        {
          role: "user",
          content: JSON.stringify(promptContext(request)),
        },
        ...request.conversation.messages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
      ],
      ...(this.controls === undefined ? {} : { controls: this.controls }),
    });

    if (result.kind === "provider-failure") {
      throw new FollowUpProviderError(
        result.code,
        followUpProviderMessage(result.userFacingCaveat),
        result.status,
      );
    }

    const parsedJson = parseJson(result.content);
    if (!parsedJson.success) {
      throw new FollowUpAnswerValidationError([
        {
          path: [],
          message: "Follow-up answer response was not valid JSON.",
        },
      ]);
    }

    const parsedAnswer = ProviderChatAnswerResponseSchema.safeParse(
      parsedJson.value,
    );
    if (!parsedAnswer.success) {
      throw new FollowUpAnswerValidationError(
        parsedAnswer.error.issues.map(toValidationIssue),
      );
    }

    const parsedContract = ChatAnswerContractSchema.safeParse({
      answer: parsedAnswer.data.answer,
      metadata: {
        provider: "openrouter",
        modelName: result.model,
        ...(result.rawResponseId === undefined
          ? {}
          : { responseId: result.rawResponseId }),
        generatedAt: this.now().toISOString(),
      },
    });

    if (!parsedContract.success) {
      throw new FollowUpAnswerValidationError(
        parsedContract.error.issues.map(toValidationIssue),
      );
    }

    return parsedContract.data;
  }
}

function chatControls(
  controls: OpenRouterChatCompletionControls | undefined,
): OpenRouterChatCompletionControls {
  return {
    maxOutputTokens:
      controls?.maxOutputTokens ?? DefaultFollowUpMaxOutputTokens,
    responseFormat: controls?.responseFormat ?? "json_object",
    temperature: controls?.temperature ?? DefaultFollowUpTemperature,
  };
}

type JsonParseResult =
  | {
      readonly success: true;
      readonly value: unknown;
    }
  | {
      readonly success: false;
    };

function systemPrompt(): string {
  return [
    "You answer follow-up questions about a repository quality report.",
    "Return JSON only matching the chat-answer contract.",
    "Cite evidence references for every evidence-backed claim.",
    "Use insufficient-context when snippets or report context cannot support an answer.",
  ].join(" ");
}

function promptContext(request: ChatReviewerRequest) {
  return {
    reportCard: request.reportCard,
    target: request.target,
    question: request.question,
    evidence: request.evidence,
    responseShape: {
      answer: {
        schemaVersion: "chat-answer.v1",
        status: "answered | insufficient-context",
      },
    },
  };
}

function repositoryLabel(request: ChatReviewerRequest): string {
  const repository = request.reportCard.repository;
  const ownerPrefix =
    repository.owner === undefined ? "" : `${repository.owner}/`;
  const revisionSuffix =
    repository.revision === undefined ? "" : ` @ ${repository.revision}`;

  return `${repository.provider}:${ownerPrefix}${repository.name}${revisionSuffix}`;
}

function parseJson(content: string): JsonParseResult {
  try {
    return {
      success: true,
      value: JSON.parse(content),
    };
  } catch {
    return {
      success: false,
    };
  }
}

function toValidationIssue(issue: z.core.$ZodIssue): FollowUpValidationIssue {
  return {
    path: issue.path.filter(
      (segment): segment is string | number =>
        typeof segment === "string" || typeof segment === "number",
    ),
    message: issue.message,
  };
}

function followUpProviderMessage(message: string): string {
  return message.replace(
    "OpenRouter reviewer output",
    "OpenRouter follow-up answer",
  );
}
