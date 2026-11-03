import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: /.*\.perf\.ts/,
  workers: 1,
  reporter: "list",
  use: {
    ...devices["Pixel 7"],
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3010",
  },
});
