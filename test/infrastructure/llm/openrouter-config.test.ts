import { describe, expect, it } from "vitest";

import {
  OpenRouterDefaultModelId,
  OpenRouterModelIdSchema,
  OpenRouterProviderConfigSchema,
  OpenRouterRequestMetadataSchema,
  parseOpenRouterProviderConfig,
} from "../../../src/infrastructure/llm/openrouter-config";

describe("OpenRouter provider configuration", () => {
  it("defaults empty model input to the documented free model", () => {
    expect(OpenRouterModelIdSchema.parse(undefined)).toBe(
      OpenRouterDefaultModelId,
    );
    expect(OpenRouterModelIdSchema.parse("")).toBe(OpenRouterDefaultModelId);
    expect(OpenRouterModelIdSchema.parse("   ")).toBe(OpenRouterDefaultModelId);
  });

  it("trims provided model ids and rejects whitespace inside ids", () => {
    expect(OpenRouterModelIdSchema.parse(" anthropic/claude-3-haiku ")).toBe(
      "anthropic/claude-3-haiku",
    );

    expect(() => OpenRouterModelIdSchema.parse("bad model")).toThrow();
  });

  it("parses request-scoped API key configuration without requiring storage", () => {
    const config = parseOpenRouterProviderConfig({
      apiKey: " sk-or-v1-request-scoped ",
      model: "",
    });

    expect(config).toEqual({
      provider: "openrouter",
      apiKey: "sk-or-v1-request-scoped",
      model: OpenRouterDefaultModelId,
      baseUrl: "https://openrouter.ai/api/v1",
    });
  });

  it("normalizes missing API key to an explicit unavailable configuration", () => {
    expect(
      OpenRouterProviderConfigSchema.parse({ apiKey: " ", model: "" }),
    ).toEqual({
      provider: "openrouter",
      model: OpenRouterDefaultModelId,
      baseUrl: "https://openrouter.ai/api/v1",
    });
  });

  it("validates request metadata separately from the domain reviewer contract", () => {
    expect(
      OpenRouterRequestMetadataSchema.parse({
        usageContext: "reviewer-assessment",
        requestId: "request-123",
        repository: "lightstrikelabs/repo-analyzer-green",
      }),
    ).toEqual({
      usageContext: "reviewer-assessment",
      requestId: "request-123",
      repository: "lightstrikelabs/repo-analyzer-green",
    });

    expect(() =>
      OpenRouterRequestMetadataSchema.parse({ usageContext: "unsupported" }),
    ).toThrow();
  });
});
