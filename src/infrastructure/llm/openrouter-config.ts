import { z } from "zod";

export const OpenRouterDefaultModelId = "openrouter/free";
export const OpenRouterDefaultBaseUrl = "https://openrouter.ai/api/v1";

export const OpenRouterModelIdSchema = z.preprocess(
  (value) => normalizeTextInput(value) ?? OpenRouterDefaultModelId,
  z.string().min(1).regex(/^\S+$/, "Model id must not contain whitespace"),
);

export type OpenRouterModelId = z.infer<typeof OpenRouterModelIdSchema>;

const OpenRouterProviderConfigInputSchema = z
  .object({
    provider: z.literal("openrouter").default("openrouter"),
    apiKey: z.preprocess(normalizeTextInput, z.string().min(1).optional()),
    model: OpenRouterModelIdSchema,
    baseUrl: z.preprocess(
      (value) => normalizeTextInput(value) ?? OpenRouterDefaultBaseUrl,
      z.url(),
    ),
  })
  .strict();

export type OpenRouterProviderConfig = {
  readonly provider: "openrouter";
  readonly apiKey?: string;
  readonly model: OpenRouterModelId;
  readonly baseUrl: string;
};

export const OpenRouterProviderConfigSchema: z.ZodType<OpenRouterProviderConfig> =
  OpenRouterProviderConfigInputSchema.transform((config) => {
    const baseConfig = {
      provider: config.provider,
      model: config.model,
      baseUrl: config.baseUrl,
    };

    if (config.apiKey === undefined) {
      return baseConfig;
    }

    return {
      ...baseConfig,
      apiKey: config.apiKey,
    };
  });

export const OpenRouterRequestMetadataSchema = z
  .object({
    usageContext: z.enum(["reviewer-assessment", "follow-up-answer"]),
    requestId: z.string().min(1).optional(),
    repository: z.string().min(1).optional(),
  })
  .strict();

export type OpenRouterRequestMetadata = z.infer<
  typeof OpenRouterRequestMetadataSchema
>;

export function parseOpenRouterProviderConfig(
  input: unknown,
): OpenRouterProviderConfig {
  return OpenRouterProviderConfigSchema.parse(input);
}

function normalizeTextInput(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  const trimmedValue = value.trim();
  return trimmedValue === "" ? undefined : trimmedValue;
}
