import { defineConfig, devices } from "@playwright/test";

/**
 * E2E de los flujos críticos del MVP contra el stack real (backend, Postgres,
 * Redis, MinIO). Levantarlo antes con `../e2e/start-stack.sh`.
 * El OTP viaja por la integración real de WhatsApp Cloud API apuntada a un
 * servidor falso de Meta (e2e/fake-meta-server.mjs) que expone el código.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3010",
    locale: "es-AR",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "mobile", use: { ...devices["Pixel 7"] } },
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
  ],
});
