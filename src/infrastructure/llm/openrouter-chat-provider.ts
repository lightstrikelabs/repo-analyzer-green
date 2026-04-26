import { z } from "zod";

import {
  OpenRouterRequestMetadataSchema,
  type OpenRouterModelId,
  type OpenRouterProviderConfig,
  type OpenRouterRequestMetadata,
} from "./openrouter-config";

export type OpenRouterChatFetcher = (request: Request) => Promise<Response>;

export type OpenRouterChatMessage = {
  readonly role: "system" | "user" | "assistant";
  readonly content: string;
};

export type OpenRouterChatCompletionControls = {
  readonly maxOutputTokens?: number;
  readonly temperature?: number;
};

export type OpenRouterChatCompletionRequest = {
  readonly config: OpenRouterProviderConfig;
  readonly metadata: OpenRouterRequestMetadata;
  readonly messages: readonly OpenRouterChatMessage[];
  readonly controls?: OpenRouterChatCompletionControls;
};

export type OpenRouterChatCompletion = {
  readonly kind: "completed";
  readonly provider: "openrouter";
  readonly model: OpenRouterModelId;
  readonly content: string;
  readonly rawResponseId?: string;
};

export type OpenRouterProviderFailureCode =
  | "missing-api-key"
  | "provider-error"
  | "invalid-response"
  | "empty-response"
  | "network-error";

export type OpenRouterProviderFailure = {
  readonly kind: "provider-failure";
  readonly provider: "openrouter";
  readonly model: OpenRouterModelId;
  readonly code: OpenRouterProviderFailureCode;
  readonly status?: number;
  readonly userFacingCaveat: string;
};

export type OpenRouterChatCompletionResult =
  | OpenRouterChatCompletion
  | OpenRouterProviderFailure;

const OpenRouterChatProviderResponseSchema = z
  .object({
    id: z.string().min(1).optional(),
    model: z.string().min(1).optional(),
    choices: z
      .array(
        z
          .object({
            message: z
              .object({
                content: z.string().optional().nullable(),
              })
              .passthrough()
              .optional(),
          })
          .passthrough(),
      )
      .default([]),
  })
  .passthrough();

const OpenRouterChatCompletionControlsSchema = z
  .object({
    maxOutputTokens: z.int().positive().optional(),
    temperature: z.number().min(0).max(2).optional(),
  })
  .strict();

export class OpenRouterChatCompletionProvider {
  private readonly fetcher: OpenRouterChatFetcher;

  constructor(options: { readonly fetcher?: OpenRouterChatFetcher } = {}) {
    this.fetcher = options.fetcher ?? fetch;
  }

  async complete(
    request: OpenRouterChatCompletionRequest,
  ): Promise<OpenRouterChatCompletionResult> {
    const metadata = OpenRouterRequestMetadataSchema.parse(request.metadata);
    const controls =
      request.controls === undefined
        ? undefined
        : parseOpenRouterChatCompletionControls(request.controls);

    if (request.config.apiKey === undefined) {
      return providerFailure({
        model: request.config.model,
        code: "missing-api-key",
        userFacingCaveat:
          "OpenRouter reviewer output is unavailable because OPENROUTER_API_KEY is not configured for this request.",
      });
    }

    let response: Response;
    try {
      response = await this.fetcher(
        new Request(`${request.config.baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            authorization: `Bearer ${request.config.apiKey}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model: request.config.model,
            messages: request.messages,
            metadata,
            ...requestBodyControls(controls),
          }),
        }),
      );
    } catch {
      return providerFailure({
        model: request.config.model,
        code: "network-error",
        userFacingCaveat:
          "OpenRouter reviewer output is unavailable because the provider request could not be completed.",
      });
    }

    if (!response.ok) {
      return providerFailure({
        model: request.config.model,
        code: "provider-error",
        status: response.status,
        userFacingCaveat:
          "OpenRouter reviewer output is unavailable because the provider request failed.",
      });
    }

    let responseBody: unknown;
    try {
      responseBody = await response.json();
    } catch {
      return providerFailure({
        model: request.config.model,
        code: "invalid-response",
        userFacingCaveat:
          "OpenRouter reviewer output is unavailable because the provider returned an unexpected response shape.",
      });
    }

    const parsedResponse =
      OpenRouterChatProviderResponseSchema.safeParse(responseBody);

    if (!parsedResponse.success) {
      return providerFailure({
        model: request.config.model,
        code: "invalid-response",
        userFacingCaveat:
          "OpenRouter reviewer output is unavailable because the provider returned an unexpected response shape.",
      });
    }

    const content = parsedResponse.data.choices[0]?.message?.content?.trim();

    if (content === undefined || content === "") {
      return providerFailure({
        model: request.config.model,
        code: "empty-response",
        userFacingCaveat:
          "OpenRouter reviewer output is unavailable because the provider returned no usable message content.",
      });
    }

    const completion: Omit<OpenRouterChatCompletion, "rawResponseId"> = {
      kind: "completed",
      provider: "openrouter",
      model: request.config.model,
      content,
    };

    if (parsedResponse.data.id === undefined) {
      return completion;
    }

    return {
      ...completion,
      rawResponseId: parsedResponse.data.id,
    };
  }
}

function requestBodyControls(
  controls: OpenRouterChatCompletionControls | undefined,
): Record<string, number> {
  const requestControls: Record<string, number> = {};

  if (controls?.maxOutputTokens !== undefined) {
    requestControls.max_tokens = controls.maxOutputTokens;
  }

  if (controls?.temperature !== undefined) {
    requestControls.temperature = controls.temperature;
  }

  return requestControls;
}

function parseOpenRouterChatCompletionControls(
  controls: OpenRouterChatCompletionControls,
): OpenRouterChatCompletionControls {
  const parsedControls = OpenRouterChatCompletionControlsSchema.parse(controls);

  return {
    ...(parsedControls.maxOutputTokens === undefined
      ? {}
      : { maxOutputTokens: parsedControls.maxOutputTokens }),
    ...(parsedControls.temperature === undefined
      ? {}
      : { temperature: parsedControls.temperature }),
  };
}

function providerFailure(options: {
  readonly model: OpenRouterModelId;
  readonly code: OpenRouterProviderFailureCode;
  readonly status?: number;
  readonly userFacingCaveat: string;
}): OpenRouterProviderFailure {
  const baseFailure = {
    kind: "provider-failure" as const,
    provider: "openrouter" as const,
    model: options.model,
    code: options.code,
    userFacingCaveat: options.userFacingCaveat,
  };

  if (options.status === undefined) {
    return baseFailure;
  }

  return {
    ...baseFailure,
    status: options.status,
  };
}
