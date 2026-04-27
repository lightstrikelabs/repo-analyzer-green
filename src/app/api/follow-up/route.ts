import { z } from "zod";

import {
  continueFollowUpConversation,
  startFollowUpConversation,
  type ChatReviewer,
  type ConversationRepository,
  type FollowUpChatDependencies,
  type FollowUpChatResult,
} from "../../../application/follow-up-chat/follow-up-chat";
import {
  ConversationTargetSelectorSchema,
  type ConversationTargetSelector,
} from "../../../domain/chat/conversation-target-resolver";
import { ChatMessageRoleSchema } from "../../../domain/chat/conversation";
import type { EvidenceContentSource } from "../../../domain/chat/evidence-retrieval";
import { ReportCardSchema } from "../../../domain/report/report-card";
import {
  OpenRouterDefaultBaseUrl,
  OpenRouterDefaultModelId,
  OpenRouterModelIdSchema,
  type OpenRouterProviderConfig,
} from "../../../infrastructure/llm/openrouter-config";
import { InMemoryConversationRepository } from "../../../infrastructure/persistence/in-memory-conversation-repository";
import {
  FollowUpAnswerValidationError,
  FollowUpProviderError,
  OpenRouterChatReviewer,
} from "../../../infrastructure/reviewer/openrouter-chat-reviewer";

export {
  FollowUpAnswerValidationError,
  FollowUpProviderError,
} from "../../../infrastructure/reviewer/openrouter-chat-reviewer";

export type FollowUpRouteOptions = {
  readonly openRouterConfig: OpenRouterProviderConfig;
};

type FollowUpRouteDependencies = {
  readonly conversationRepository: ConversationRepository;
  readonly createChatReviewer: (options: FollowUpRouteOptions) => ChatReviewer;
  readonly contentSource?: EvidenceContentSource;
  readonly now?: () => Date;
  readonly createId?: (prefix: string) => string;
};

type ApiValidationIssue = {
  readonly path: readonly (string | number)[];
  readonly message: string;
};

const RedSectionIdSchema = z.enum([
  "maintainability",
  "testing",
  "security",
  "architecture",
  "documentation",
]);

const RedSectionTargetSchema = z
  .union([
    z
      .object({
        kind: z.enum(["section", "report-section"]),
        sectionId: RedSectionIdSchema,
      })
      .strict(),
    z
      .object({
        kind: z.enum(["section", "report-section"]),
        id: RedSectionIdSchema,
      })
      .strict(),
  ])
  .transform((target) => ({
    kind: target.kind,
    sectionId: "sectionId" in target ? target.sectionId : target.id,
  }));

const RedSectionSchema = z
  .object({
    id: RedSectionIdSchema,
  })
  .passthrough();

const FollowUpMessageInputSchema = z
  .object({
    role: ChatMessageRoleSchema,
    content: z.string().trim().min(1),
  })
  .strict();

const FollowUpRequestSchema = z
  .object({
    reportCard: ReportCardSchema,
    target: z
      .union([ConversationTargetSelectorSchema, RedSectionTargetSchema])
      .optional(),
    section: RedSectionSchema.optional(),
    conversationId: z.string().trim().min(1).optional(),
    messages: z.array(FollowUpMessageInputSchema).default([]),
    question: z.string().trim().min(1),
    apiKey: z.preprocess(normalizeOptionalText, z.string().min(1).optional()),
    model: OpenRouterModelIdSchema.optional(),
  })
  .strict()
  .refine(
    (request) =>
      request.conversationId !== undefined ||
      request.target !== undefined ||
      request.section !== undefined,
    {
      message: "A target or conversationId is required.",
      path: ["target"],
    },
  );

type FollowUpRequest = z.infer<typeof FollowUpRequestSchema>;

const defaultConversationRepository = new InMemoryConversationRepository();

export async function POST(request: Request): Promise<Response> {
  return handleFollowUpRequest(request, {
    conversationRepository: defaultConversationRepository,
    createChatReviewer: (options) =>
      new OpenRouterChatReviewer({
        config: options.openRouterConfig,
        controls: {
          maxOutputTokens: 900,
          temperature: 0.25,
        },
      }),
  });
}

export async function handleFollowUpRequest(
  request: Request,
  dependencies: FollowUpRouteDependencies,
): Promise<Response> {
  const bodyResult = await readRequestBody(request);

  if (bodyResult.kind === "invalid-json") {
    return jsonError(400, {
      code: "invalid-json",
      message: "Request body must be valid JSON.",
    });
  }

  const requestResult = FollowUpRequestSchema.safeParse(bodyResult.body);
  if (!requestResult.success) {
    return jsonError(400, {
      code: "invalid-request",
      message: "Request body did not match the follow-up contract.",
      issues: requestResult.error.issues.map(toApiValidationIssue),
    });
  }

  const parsedRequest = requestResult.data;
  if (parsedRequest.apiKey === undefined) {
    return jsonError(400, {
      code: "openrouter-api-key-required",
      message: "OpenRouter API key is required for follow-up questions.",
    });
  }

  const routeOptions = openRouterRouteOptions(
    parsedRequest,
    parsedRequest.apiKey,
  );
  const chatDependencies = chatDependenciesFor(dependencies, routeOptions);

  try {
    const result =
      parsedRequest.conversationId === undefined
        ? await startFollowUpConversation(
            {
              reportCard: parsedRequest.reportCard,
              targetSelector: targetSelectorFor(parsedRequest),
              question: parsedRequest.question,
            },
            chatDependencies,
          )
        : await continueFollowUpConversation(
            {
              reportCard: parsedRequest.reportCard,
              conversationId: parsedRequest.conversationId,
              question: parsedRequest.question,
            },
            chatDependencies,
          );

    return responseForResult(result);
  } catch (error) {
    if (error instanceof FollowUpAnswerValidationError) {
      return jsonError(502, {
        code: "follow-up-answer-malformed",
        message: "Follow-up answer could not be validated.",
        issues: error.issues,
      });
    }

    if (error instanceof FollowUpProviderError) {
      return jsonError(502, {
        code: error.code,
        message: error.message,
        ...(error.status === undefined ? {} : { status: error.status }),
      });
    }

    if (error instanceof z.ZodError) {
      return jsonError(502, {
        code: "follow-up-answer-malformed",
        message: "Follow-up answer could not be validated.",
        issues: error.issues.map(toApiValidationIssue),
      });
    }

    return jsonError(500, {
      code: "internal-error",
      message: "Follow-up answer failed unexpectedly.",
    });
  }
}

function responseForResult(result: FollowUpChatResult): Response {
  switch (result.kind) {
    case "conversation":
      return Response.json({
        conversation: result.conversation,
        answer: result.answer,
        answerText: result.answer.answer.summary,
        evidence: result.evidence,
      });
    case "invalid-target":
      return jsonError(404, {
        code: "invalid-target",
        message: "Follow-up target could not be resolved.",
        reason: result.reason,
        targetId: result.targetId,
      });
    case "conversation-not-found":
      return jsonError(404, {
        code: "conversation-not-found",
        message: "Follow-up conversation could not be found.",
        conversationId: result.conversationId,
      });
  }
}

function targetSelectorFor(
  request: FollowUpRequest,
): ConversationTargetSelector {
  if (request.target !== undefined) {
    if (isRedSectionTarget(request.target)) {
      return targetSelectorForRedSection(request.target.sectionId);
    }

    return request.target;
  }

  if (request.section !== undefined) {
    return targetSelectorForRedSection(request.section.id);
  }

  return { kind: "report" };
}

function isRedSectionTarget(
  target: ConversationTargetSelector | z.infer<typeof RedSectionTargetSchema>,
): target is z.infer<typeof RedSectionTargetSchema> {
  return target.kind === "section" || target.kind === "report-section";
}

function targetSelectorForRedSection(
  sectionId: z.infer<typeof RedSectionIdSchema>,
): ConversationTargetSelector {
  switch (sectionId) {
    case "maintainability":
      return {
        kind: "dimension",
        dimension: "maintainability",
      };
    case "testing":
      return {
        kind: "dimension",
        dimension: "verifiability",
      };
    case "security":
      return {
        kind: "dimension",
        dimension: "security",
      };
    case "architecture":
      return {
        kind: "dimension",
        dimension: "architecture-boundaries",
      };
    case "documentation":
      return {
        kind: "dimension",
        dimension: "documentation",
      };
  }
}

function chatDependenciesFor(
  dependencies: FollowUpRouteDependencies,
  options: FollowUpRouteOptions,
): FollowUpChatDependencies {
  return {
    conversationRepository: dependencies.conversationRepository,
    chatReviewer: dependencies.createChatReviewer(options),
    ...(dependencies.contentSource === undefined
      ? {}
      : { contentSource: dependencies.contentSource }),
    ...(dependencies.now === undefined ? {} : { now: dependencies.now }),
    ...(dependencies.createId === undefined
      ? {}
      : { createId: dependencies.createId }),
  };
}

function openRouterRouteOptions(
  request: FollowUpRequest,
  apiKey: string,
): FollowUpRouteOptions {
  return {
    openRouterConfig: {
      provider: "openrouter",
      apiKey,
      model: request.model ?? OpenRouterDefaultModelId,
      baseUrl: OpenRouterDefaultBaseUrl,
    },
  };
}

async function readRequestBody(request: Request): Promise<
  | {
      readonly kind: "body";
      readonly body: unknown;
    }
  | {
      readonly kind: "invalid-json";
    }
> {
  try {
    const body: unknown = await request.json();
    return {
      kind: "body",
      body,
    };
  } catch {
    return {
      kind: "invalid-json",
    };
  }
}

function normalizeOptionalText(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  const trimmedValue = value.trim();
  return trimmedValue === "" ? undefined : trimmedValue;
}

function toApiValidationIssue(issue: z.core.$ZodIssue): ApiValidationIssue {
  return {
    path: issue.path.map((segment) =>
      typeof segment === "number" ? segment : String(segment),
    ),
    message: issue.message,
  };
}

function jsonError(status: number, error: object): Response {
  return Response.json(
    {
      error,
    },
    {
      status,
    },
  );
}
