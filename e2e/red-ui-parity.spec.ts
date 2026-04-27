import { expect, test } from "@playwright/test";

const parityEnabled = process.env.RED_UI_PARITY === "1";

test.skip(
  !parityEnabled,
  "Red UI parity harness is opt-in until milestone 7 UI slices satisfy it.",
);

test.describe("red UI/UX parity", () => {
  test.setTimeout(45_000);

  test("matches the red first-screen analysis workflow", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator("body")).toHaveCSS(
      "background-color",
      "rgb(246, 245, 241)",
    );
    await expect(page.locator("body")).toHaveCSS("font-family", /Geist/);
    await expect(page.locator("main").first()).toHaveCSS(
      "background-color",
      "rgb(246, 245, 241)",
    );
    await expect(page.locator("section").first()).toHaveCSS(
      "background-color",
      "rgb(251, 250, 247)",
    );
    await expect(
      page.getByText("Repository Quality", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Report Card" }),
    ).toBeVisible();
    await expect(page.getByLabel("GitHub repository URL")).toBeVisible();
    await expect(page.getByLabel("OpenRouter API key")).toBeVisible();
    await expect(
      page.getByTestId("repo-url-control").locator("svg"),
    ).toBeVisible();
    await expect(
      page.getByTestId("api-key-control").locator("svg"),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Analyze" }).locator("svg"),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Analyze" })).toHaveCSS(
      "background-color",
      "rgb(17, 17, 17)",
    );

    await page.getByText("Advanced", { exact: true }).click();
    await expect(page.getByLabel("OpenRouter Model")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Use Free Router" }),
    ).toBeVisible();

    await expect(page.getByText("No report loaded")).toBeVisible();
    await expect(
      page.getByText("Enter a repository URL to begin."),
    ).toBeVisible();
  });

  test("matches the red report dashboard workflow", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByLabel("GitHub repository URL")).toBeVisible();
    await page
      .getByLabel("GitHub repository URL")
      .fill("https://github.com/lightstrikelabs/repo-analyzer-green");
    await page.getByRole("button", { name: "Analyze" }).click();

    await expect(
      page.getByText("Reviewer Notes", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Overall Score", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("Source Files", { exact: true })).toBeVisible();
    await expect(page.getByText("Code Lines", { exact: true })).toBeVisible();
    await expect(page.getByText("Test Ratio", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Language Mix" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Download PDF" }),
    ).toBeVisible();

    await expect(page.getByText("Provider", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Repository name")).toHaveCount(0);
    await expect(page.getByText("Revision", { exact: true })).toHaveCount(0);

    for (const section of [
      "Maintainability",
      "Testing",
      "Security",
      "Architecture",
      "Documentation",
    ]) {
      const panel = page.locator("article").filter({
        has: page.getByRole("heading", { name: section }),
      });
      await expect(panel).toHaveCSS("background-color", "rgb(255, 255, 255)");
      await expect(panel).toHaveCSS("border-color", "rgb(216, 210, 197)");
      await expect(panel.getByRole("heading", { name: section })).toBeVisible();
      await expect(panel.getByText("Signals", { exact: true })).toBeVisible();
      await expect(
        panel.getByText("Next Checks", { exact: true }),
      ).toBeVisible();
      await expect(panel.getByLabel(`Ask About ${section}`)).toBeVisible();
      await expect(
        panel.getByRole("button", { name: "Open Chat" }),
      ).toBeVisible();
    }
  });

  test("matches the red section chat workflow", async ({ page }) => {
    await page.route("**/api/follow-up", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(followUpResponse("What should we fix first?")),
      });
    });
    await page.goto("/");
    await expect(page.getByLabel("GitHub repository URL")).toBeVisible();
    await page
      .getByLabel("GitHub repository URL")
      .fill("https://github.com/lightstrikelabs/repo-analyzer-green");
    await page.getByLabel("OpenRouter API key").fill("sk-or-v1-e2e");
    await page.getByRole("button", { name: "Analyze" }).click();

    const maintainability = page.locator("article").filter({
      has: page.getByRole("heading", { name: "Maintainability" }),
    });
    await maintainability
      .getByLabel("Ask About Maintainability")
      .fill("What should we fix first?");
    await maintainability.getByRole("button", { name: "Open Chat" }).click();

    await expect(
      page.getByRole("heading", { name: "What should we fix first?" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Conversations" }),
    ).toBeVisible();
    await expect(page.getByText("Searches matching repo files")).toBeVisible();
    await expect(page.getByRole("complementary")).toHaveCSS(
      "background-color",
      "rgb(251, 250, 247)",
    );

    await page.getByRole("button", { name: "Close chat" }).click();

    await expect(page.getByRole("button", { name: "Chats" })).toBeVisible();
    await expect(page.getByText("Recent Threads")).toBeVisible();
    await expect(page.getByText("What should we fix first?")).toBeVisible();
  });
});

function followUpResponse(question: string) {
  const timestamp = "2026-04-26T19:00:00.000Z";
  return {
    conversation: {
      id: "conversation:maintainability",
      schemaVersion: "conversation.v1",
      reportCardId: "report:red-parity",
      repository: {
        provider: "github",
        owner: "lightstrikelabs",
        name: "repo-analyzer-green",
      },
      target: {
        kind: "dimension",
        dimension: "maintainability",
      },
      messages: [
        {
          id: "message:1",
          role: "user",
          content: question,
          citations: [],
          assumptions: [],
          createdAt: timestamp,
        },
        {
          id: "message:2",
          role: "assistant",
          content: "Review the highest-risk maintainability signal first.",
          citations: [],
          assumptions: [],
          createdAt: timestamp,
        },
      ],
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    answer: {
      answer: {
        schemaVersion: "chat-answer.v1",
        status: "answered",
        summary: "Review the highest-risk maintainability signal first.",
        evidenceBackedClaims: [
          {
            claim: "Repository structure evidence supports the answer.",
            citations: [
              {
                evidenceReference: packageEvidence(),
                quote: "Repository structure evidence",
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
        generatedAt: timestamp,
      },
    },
    evidence: {
      snippets: [
        {
          evidenceReference: packageEvidence(),
          text: "Repository structure evidence",
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
