import { describe, expect, it } from "vitest";

import { POST } from "../../src/app/api/follow-up/route";
import { OpenRouterDefaultModelId } from "../../src/infrastructure/llm/openrouter-config";
import { analyzeRepositoryResponseFixture } from "../support/analyze-repository-response-fixture";

const shouldRunLiveOpenRouter =
  process.env.RUN_OPENROUTER_LIVE === "1" &&
  process.env.OPENROUTER_API_KEY !== undefined &&
  process.env.OPENROUTER_API_KEY.trim() !== "";

const describeLiveOpenRouter = shouldRunLiveOpenRouter
  ? describe
  : describe.skip;

describeLiveOpenRouter("OpenRouter follow-up route live contract", () => {
  it("returns a validated follow-up answer through the route boundary", async () => {
    const response = await POST(
      new Request("http://localhost/api/follow-up", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          reportCard: analyzeRepositoryResponseFixture.reportCard,
          target: {
            kind: "dimension",
            dimension: "verifiability",
          },
          question: "Which tests are flaky?",
          apiKey: requiredOpenRouterKey(),
          model: OpenRouterDefaultModelId,
        }),
      }),
    );
    const body: unknown = await response.json();

    expect(response.status, JSON.stringify(body)).toBe(200);
    expect(body).toMatchObject({
      answer: {
        answer: {
          schemaVersion: "chat-answer.v1",
        },
      },
      conversation: {
        messages: expect.any(Array),
      },
    });
  }, 60_000);
});

function requiredOpenRouterKey(): string {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();

  if (apiKey === undefined || apiKey === "") {
    throw new Error(
      "OPENROUTER_API_KEY is required for live OpenRouter tests.",
    );
  }

  return apiKey;
}
