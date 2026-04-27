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

    await expect(
      page.getByText("Repository Quality", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Report Card" }),
    ).toBeVisible();
    await expect(page.getByLabel("GitHub repository URL")).toBeVisible();
    await expect(page.getByLabel("OpenRouter API key")).toBeVisible();
    await expect(page.getByRole("button", { name: "Analyze" })).toBeVisible();

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
    await page.goto("/");
    await expect(page.getByLabel("GitHub repository URL")).toBeVisible();
    await page
      .getByLabel("GitHub repository URL")
      .fill("https://github.com/lightstrikelabs/repo-analyzer-green");
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
    await expect(page.getByText("Conversations")).toBeVisible();
    await expect(page.getByText("Searches matching repo files")).toBeVisible();

    await page.getByRole("button", { name: "Close chat" }).click();

    await expect(page.getByText("Chats")).toBeVisible();
    await expect(page.getByText("Recent Threads")).toBeVisible();
    await expect(page.getByText("What should we fix first?")).toBeVisible();
  });
});
