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
  await expect(page.getByText("Follow-up").first()).toBeVisible();
});

test("starts a follow-up thread from the report view", async ({ page }) => {
  await mockAnalyzeRoute(page);
  await page.goto("/");
  await page
    .getByLabel("GitHub repository URL")
    .fill("https://github.com/lightstrikelabs/repo-analyzer-green");
  await page.getByText("Advanced", { exact: true }).click();
  await page.getByLabel("OpenRouter Model").fill("fixture-parity-model");
  await page.getByRole("button", { name: "Analyze" }).click();

  await expect(page.getByText("Follow-up").first()).toBeVisible();

  await page.getByRole("button", { name: "Ask about report" }).first().click();

  await expect(
    page.getByText("Report: What should we inspect first?").first(),
  ).toBeVisible();
  await expect(page.getByText("Evidence summary")).toBeVisible();
  await expect(page.getByText("Evidence-backed answer")).toBeVisible();
  await expect(page.getByText("Relevant evidence from").first()).toBeVisible();

  await page.waitForFunction(
    () =>
      window.localStorage
        .getItem("repo-analyzer-green.browser-local-session")
        ?.includes("fixture-parity-model") &&
      window.localStorage
        .getItem("repo-analyzer-green.browser-local-session")
        ?.includes("Report: What should we inspect first?"),
  );

  await page.reload();

  await page.getByText("Advanced", { exact: true }).click();
  await expect(page.getByLabel("OpenRouter Model")).toHaveValue(
    "fixture-parity-model",
  );
  await expect(
    page.getByText("Report: What should we inspect first?").first(),
  ).toBeVisible();
  await expect(page.getByText("Evidence summary")).toBeVisible();
  await expect(page.getByText("Evidence-backed answer")).toBeVisible();
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
