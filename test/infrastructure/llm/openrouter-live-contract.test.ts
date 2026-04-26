import { describe, expect, it } from "vitest";

import { OpenRouterChatCompletionProvider } from "../../../src/infrastructure/llm/openrouter-chat-provider";

const shouldRunLiveOpenRouter =
  process.env.RUN_OPENROUTER_LIVE === "1" &&
  process.env.OPENROUTER_API_KEY !== undefined &&
  process.env.OPENROUTER_API_KEY.trim() !== "";

const describeLiveOpenRouter = shouldRunLiveOpenRouter
  ? describe
  : describe.skip;

describeLiveOpenRouter("OpenRouter live contract", () => {
  it.each(["openai/gpt-4.1-mini", "openrouter/free"])(
    "returns JSON object content from %s",
    async (model) => {
      const provider = new OpenRouterChatCompletionProvider();

      const result = await provider.complete({
        config: {
          provider: "openrouter",
          apiKey: requiredOpenRouterKey(),
          model,
          baseUrl: "https://openrouter.ai/api/v1",
        },
        metadata: {
          usageContext: "reviewer-assessment",
          repository: "github:lightstrikelabs/repo-analyzer-green",
        },
        messages: [
          {
            role: "system",
            content: "Return JSON only.",
          },
          {
            role: "user",
            content: 'Return {"ok":true,"reason":"live-contract"} as JSON.',
          },
        ],
        controls: {
          maxOutputTokens: 1_000,
          responseFormat: "json_object",
          temperature: 0,
        },
      });

      expect(result.kind).toBe("completed");
      if (result.kind !== "completed") {
        throw new Error(result.userFacingCaveat);
      }
      expect(normalizeLiveJson(JSON.parse(result.content))).toMatchObject({
        ok: true,
        reason: "live-contract",
      });
    },
  );
});

function normalizeLiveJson(value: unknown): unknown {
  return Array.isArray(value) && value.length === 1 ? value[0] : value;
}

function requiredOpenRouterKey(): string {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();

  if (apiKey === undefined || apiKey === "") {
    throw new Error(
      "OPENROUTER_API_KEY is required for live OpenRouter tests.",
    );
  }

  return apiKey;
}
