import { expect, test, type Page } from "@playwright/test";

import { analyzeRepositoryResponseFixture } from "../test/support/analyze-repository-response-fixture";

test("runs the repository analysis workflow", async ({ page }) => {
  await mockAnalyzeRoute(page);
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Report Card" }),
  ).toBeVisible();

  await page
    .getByLabel("GitHub repository URL")
    .fill("https://github.com/lightstrikelabs/repo-analyzer-green");
  await page.getByRole("button", { name: "Analyze" }).click();

  await expect(
    page.getByRole("heading", { name: "Evidence-backed report" }),
  ).toBeVisible();
  await expect(
    page.getByText("local-fixture:minimal-node-library @ fixture"),
  ).toBeVisible();
  await expect(page.getByText("Overall Score", { exact: true })).toBeVisible();
  await expect(page.getByText("Source Files", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Language Mix" }),
  ).toBeVisible();
  const testingPanel = page.locator("article").filter({
    has: page.getByRole("heading", { name: "Testing" }),
  });
  await expect(
    testingPanel.getByText("Signals", { exact: true }),
  ).toBeVisible();
  await expect(
    testingPanel.getByText("Next Checks", { exact: true }),
  ).toBeVisible();

  await page
    .getByText("Evidence, Caveats, And Suggested Follow-Ups", { exact: true })
    .click();
  await expect(page.getByText("No caveats were reported.")).toBeVisible();
  await expect(
    page.getByText("Package manifest", { exact: true }),
  ).toBeVisible();

  await page.reload();

  await expect(
    page.getByRole("heading", { name: "Evidence-backed report" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Open Chat" }).first(),
  ).toBeVisible();
});

test("starts a follow-up thread from the report view", async ({ page }) => {
  await mockAnalyzeRoute(page);
  await mockFollowUpRoute(page);
  await page.goto("/");
  await page
    .getByLabel("GitHub repository URL")
    .fill("https://github.com/lightstrikelabs/repo-analyzer-green");
  await page.getByLabel("OpenRouter API key").fill("sk-or-v1-e2e");
  await page.getByText("Advanced", { exact: true }).click();
  await page.getByLabel("OpenRouter Model").fill("fixture-parity-model");
  await page.getByRole("button", { name: "Analyze" }).click();

  const testingPanel = page.locator("article").filter({
    has: page.getByRole("heading", { name: "Testing" }),
  });
  await testingPanel
    .getByLabel("Ask About Testing")
    .fill("What should we inspect first?");
  await testingPanel.getByRole("button", { name: "Open Chat" }).click();

  await expect(
    page.getByRole("heading", { name: "What should we inspect first?" }),
  ).toBeVisible();
  await expect(page.getByText("Searches matching repo files")).toBeVisible();
  await expect(page.getByText("Evidence-backed answer")).toBeVisible();
  await expect(
    page.getByText("The package manifest includes a test script."),
  ).toBeVisible();

  await page.waitForFunction(
    () =>
      window.localStorage
        .getItem("repo-analyzer-green.browser-local-session")
        ?.includes("fixture-parity-model") &&
      window.localStorage
        .getItem("repo-analyzer-green.browser-local-session")
        ?.includes("What should we inspect first?"),
  );

  await page.getByRole("button", { name: "Close chat" }).click();
  await page.reload();

  await page.getByText("Advanced", { exact: true }).click();
  await expect(page.getByLabel("OpenRouter Model")).toHaveValue(
    "fixture-parity-model",
  );
  await expect(page.getByText("Recent Threads")).toBeVisible();
  await expect(page.getByText("What should we inspect first?")).toBeVisible();
});

async function mockAnalyzeRoute(page: Page) {
  await page.route("**/api/analyze", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(analyzeRepositoryResponseFixture),
    });
  });
}

async function mockFollowUpRoute(page: Page) {
  await page.route("**/api/follow-up", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(followUpResponse()),
    });
  });
}

function followUpResponse() {
  return {
    conversation: {
      id: "conversation:testing",
      schemaVersion: "conversation.v1",
      reportCardId: analyzeRepositoryResponseFixture.reportCard.id,
      repository: analyzeRepositoryResponseFixture.reportCard.repository,
      target: {
        kind: "dimension",
        dimension: "verifiability",
      },
      messages: [
        {
          id: "message:1",
          role: "user",
          content: "What should we inspect first?",
          citations: [],
          assumptions: [],
          createdAt: "2026-04-26T19:00:00.000Z",
        },
        {
          id: "message:2",
          role: "assistant",
          content: "Review the highest-risk test gap first.",
          citations: [],
          assumptions: [],
          createdAt: "2026-04-26T19:00:00.000Z",
        },
      ],
      createdAt: "2026-04-26T19:00:00.000Z",
      updatedAt: "2026-04-26T19:00:00.000Z",
    },
    answer: {
      answer: {
        schemaVersion: "chat-answer.v1",
        status: "answered",
        summary: "Review the highest-risk test gap first.",
        evidenceBackedClaims: [
          {
            claim: "The package manifest includes a test script.",
            citations: [
              {
                evidenceReference: packageEvidence(),
                quote: '"test": "vitest"',
              },
            ],
          },
        ],
        assumptions: [],
        caveats: [],
        suggestedNextQuestions: [],
      },
      metadata: {
        provider: "fixture",
        modelName: "fixture-chat",
        generatedAt: "2026-04-26T19:00:00.000Z",
      },
    },
    evidence: {
      snippets: [
        {
          evidenceReference: packageEvidence(),
          text: '"test": "vitest"',
          source: "fresh-content",
          targetRelevance: "dimension",
          rank: 100,
        },
      ],
      missingContext: [],
    },
  };
}

function packageEvidence() {
  return {
    id: "evidence:package-json",
    kind: "file",
    label: "Package manifest",
    path: "package.json",
  };
}
