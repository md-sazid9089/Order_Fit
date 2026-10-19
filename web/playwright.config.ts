import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000",
    // Traces include HttpOnly cookies and password/one-time-token request bodies.
    // Keep visual evidence without persisting authentication material.
    trace: "off",
    screenshot: "only-on-failure",
    ...devices["Desktop Chrome"],
  },
});
