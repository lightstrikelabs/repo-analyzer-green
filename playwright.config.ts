import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const vercelAutomationBypassSecret =
  process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
const webServer = process.env.PLAYWRIGHT_BASE_URL
  ? undefined
  : {
      command: "pnpm dev",
      url: baseURL,
      reuseExistingServer: !process.env.CI,
    };

export default defineConfig({
  testDir: "./e2e",
  ...(webServer === undefined ? {} : { webServer }),
  use: {
    baseURL,
    ...(vercelAutomationBypassSecret === undefined ||
    vercelAutomationBypassSecret === ""
      ? {}
      : {
          extraHTTPHeaders: {
            "x-vercel-protection-bypass": vercelAutomationBypassSecret,
            "x-vercel-set-bypass-cookie": "true",
          },
        }),
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
