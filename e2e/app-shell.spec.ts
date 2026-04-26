import { expect, test } from "@playwright/test";

test("runs the repository analysis workflow", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Repository analysis" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Analyze repository" }).click();

  await expect(
    page.getByRole("heading", { name: "Evidence-backed report" }),
  ).toBeVisible();
  await expect(
    page.getByText("local-fixture:minimal-node-library @ fixture"),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Dimensions" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Caveats And Missing Evidence" }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Dimensions").getByText("evidence:test-file").first(),
  ).toBeVisible();
});

test("starts a follow-up thread from the report view", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Analyze repository" }).click();

  await expect(page.getByText("Follow-up").first()).toBeVisible();

  await page.getByRole("button", { name: "Ask about report" }).first().click();

  await expect(
    page.getByText("Report: What should we inspect first?").first(),
  ).toBeVisible();
  await expect(page.getByText("Evidence summary")).toBeVisible();
  await expect(page.getByText("Evidence-backed answer")).toBeVisible();
  await expect(page.getByText("Relevant evidence from").first()).toBeVisible();
});
