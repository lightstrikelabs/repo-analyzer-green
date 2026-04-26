import { describe, expect, it } from "vitest";

import { OpenRouterDefaultModelId } from "../../../src/infrastructure/llm/openrouter-config";
import {
  OpenRouterChatCompletionProvider,
  type OpenRouterChatFetcher,
} from "../../../src/infrastructure/llm/openrouter-chat-provider";

describe("OpenRouterChatCompletionProvider", () => {
  it("posts an OpenAI-compatible chat completion request with request-scoped credentials", async () => {
    const requests: Request[] = [];
    const fetcher: OpenRouterChatFetcher = async (request) => {
      requests.push(request);
      return new Response(
        JSON.stringify({
          id: "completion-1",
          model: OpenRouterDefaultModelId,
          choices: [{ message: { content: "structured assessment" } }],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    };
    const provider = new OpenRouterChatCompletionProvider({ fetcher });

    const result = await provider.complete({
      config: {
        provider: "openrouter",
        apiKey: "sk-or-v1-request-scoped",
        model: OpenRouterDefaultModelId,
        baseUrl: "https://openrouter.ai/api/v1",
      },
      metadata: { usageContext: "reviewer-assessment" },
      messages: [{ role: "user", content: "Review this evidence." }],
    });

    expect(result).toEqual({
      kind: "completed",
      provider: "openrouter",
      model: OpenRouterDefaultModelId,
      content: "structured assessment",
      rawResponseId: "completion-1",
    });
    expect(requests).toHaveLength(1);
    const request = requests[0];
    expect(request?.url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(request?.headers.get("authorization")).toBe(
      "Bearer sk-or-v1-request-scoped",
    );
    expect(request?.headers.get("content-type")).toBe("application/json");
    expect(request?.headers.get("HTTP-Referer")).toBe(
      "https://repo-analyzer-green.vercel.app",
    );
    expect(request?.headers.get("X-Title")).toBe("Repo Analyzer Green");
    expect(await request?.json()).toEqual({
      model: OpenRouterDefaultModelId,
      messages: [{ role: "user", content: "Review this evidence." }],
      metadata: { usageContext: "reviewer-assessment" },
    });
  });

  it("includes request-scoped token and cost controls when provided", async () => {
    const requests: Request[] = [];
    const fetcher: OpenRouterChatFetcher = async (request) => {
      requests.push(request);
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: "structured assessment" } }],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    };
    const provider = new OpenRouterChatCompletionProvider({ fetcher });

    await provider.complete({
      config: {
        provider: "openrouter",
        apiKey: "sk-or-v1-request-scoped",
        model: OpenRouterDefaultModelId,
        baseUrl: "https://openrouter.ai/api/v1",
      },
      metadata: { usageContext: "reviewer-assessment" },
      messages: [{ role: "user", content: "Review this evidence." }],
      controls: {
        maxOutputTokens: 1_500,
        responseFormat: "json_object",
        temperature: 0,
      },
    });

    expect(await requests[0]?.json()).toEqual({
      model: OpenRouterDefaultModelId,
      messages: [{ role: "user", content: "Review this evidence." }],
      metadata: { usageContext: "reviewer-assessment" },
      max_tokens: 1_500,
      response_format: { type: "json_object" },
      temperature: 0,
    });
  });

  it("returns a provider failure without calling fetch when the API key is absent", async () => {
    const fetcher: OpenRouterChatFetcher = async () => {
      throw new Error("fetch should not be called");
    };
    const provider = new OpenRouterChatCompletionProvider({ fetcher });

    await expect(
      provider.complete({
        config: {
          provider: "openrouter",
          model: OpenRouterDefaultModelId,
          baseUrl: "https://openrouter.ai/api/v1",
        },
        metadata: { usageContext: "follow-up-answer" },
        messages: [{ role: "user", content: "What changed?" }],
      }),
    ).resolves.toEqual({
      kind: "provider-failure",
      provider: "openrouter",
      model: OpenRouterDefaultModelId,
      code: "missing-api-key",
      userFacingCaveat:
        "OpenRouter reviewer output is unavailable because OPENROUTER_API_KEY is not configured for this request.",
    });
  });

  it("maps non-2xx provider responses to redacted provider failures", async () => {
    const provider = new OpenRouterChatCompletionProvider({
      fetcher: async () =>
        new Response(
          JSON.stringify({ error: { message: "quota exceeded for secret" } }),
          { status: 429, headers: { "content-type": "application/json" } },
        ),
    });

    await expect(
      provider.complete({
        config: {
          provider: "openrouter",
          apiKey: "sk-or-v1-request-scoped",
          model: OpenRouterDefaultModelId,
          baseUrl: "https://openrouter.ai/api/v1",
        },
        metadata: { usageContext: "reviewer-assessment" },
        messages: [{ role: "user", content: "Review this evidence." }],
      }),
    ).resolves.toEqual({
      kind: "provider-failure",
      provider: "openrouter",
      model: OpenRouterDefaultModelId,
      code: "provider-error",
      status: 429,
      userFacingCaveat: `OpenRouter reviewer output is unavailable because OpenRouter returned status 429 for ${OpenRouterDefaultModelId}. The selected model or account may be rate limited; retry later or choose another structured-output-capable model.`,
    });
  });

  it("maps network failures to retryable redacted diagnostics", async () => {
    const provider = new OpenRouterChatCompletionProvider({
      fetcher: async () => {
        throw new TypeError("fetch failed");
      },
    });

    await expect(
      provider.complete({
        config: {
          provider: "openrouter",
          apiKey: "sk-or-v1-request-scoped",
          model: OpenRouterDefaultModelId,
          baseUrl: "https://openrouter.ai/api/v1",
        },
        metadata: { usageContext: "reviewer-assessment" },
        messages: [{ role: "user", content: "Review this evidence." }],
      }),
    ).resolves.toEqual({
      kind: "provider-failure",
      provider: "openrouter",
      model: OpenRouterDefaultModelId,
      code: "network-error",
      userFacingCaveat: `OpenRouter reviewer output is unavailable because the network request to OpenRouter could not be completed for ${OpenRouterDefaultModelId}. Retry the request; if it persists, choose another structured-output-capable model or check provider connectivity.`,
    });
  });

  it("treats empty or reasoning-only responses as provider failures", async () => {
    const provider = new OpenRouterChatCompletionProvider({
      fetcher: async () =>
        new Response(
          JSON.stringify({
            id: "completion-2",
            model: OpenRouterDefaultModelId,
            choices: [{ message: { reasoning: "internal chain omitted" } }],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
    });

    await expect(
      provider.complete({
        config: {
          provider: "openrouter",
          apiKey: "sk-or-v1-request-scoped",
          model: OpenRouterDefaultModelId,
          baseUrl: "https://openrouter.ai/api/v1",
        },
        metadata: { usageContext: "reviewer-assessment" },
        messages: [{ role: "user", content: "Review this evidence." }],
      }),
    ).resolves.toEqual({
      kind: "provider-failure",
      provider: "openrouter",
      model: OpenRouterDefaultModelId,
      code: "empty-response",
      userFacingCaveat:
        "OpenRouter reviewer output is unavailable because the provider returned no usable message content.",
    });
  });

  it("maps invalid JSON responses to typed provider failures", async () => {
    const provider = new OpenRouterChatCompletionProvider({
      fetcher: async () =>
        new Response("{not json", {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    });

    await expect(
      provider.complete({
        config: {
          provider: "openrouter",
          apiKey: "sk-or-v1-request-scoped",
          model: OpenRouterDefaultModelId,
          baseUrl: "https://openrouter.ai/api/v1",
        },
        metadata: { usageContext: "reviewer-assessment" },
        messages: [{ role: "user", content: "Review this evidence." }],
      }),
    ).resolves.toEqual({
      kind: "provider-failure",
      provider: "openrouter",
      model: OpenRouterDefaultModelId,
      code: "invalid-response",
      userFacingCaveat:
        "OpenRouter reviewer output is unavailable because the provider returned an unexpected response shape.",
    });
  });
});
