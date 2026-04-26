import { expect, test } from "@playwright/test";

test("renders the initial analysis shell", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      name: "Evidence-backed repository quality analysis.",
    }),
  ).toBeVisible();
  await expect(page.getByText("Repo Analyzer Green")).toBeVisible();
});
