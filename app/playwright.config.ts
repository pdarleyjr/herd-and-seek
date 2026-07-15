import { defineConfig, devices } from "@playwright/test";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:5273";
const LOCAL_WORKER_URL = "http://127.0.0.1:8787";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 3,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 60000,
  reporter: [["list"]],
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  projects: [
    { name: "functional-desktop", testMatch: /(?:phaser-smoke|multiplayer|open-world|perks|admin|performance|soccer)\.spec\.ts/, use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 720 } } },
    { name: "functional-mobile", testMatch: /mobile-gameplay\.spec\.ts/, use: { ...devices["iPhone 13"], viewport: { width: 390, height: 844 } } },
    { name: "tablet-chromium", testMatch: /(?:mobile-gameplay|tablet-controls)\.spec\.ts/, use: { ...devices["iPad Pro 11"], viewport: { width: 1180, height: 820 } } },
    { name: "tablet-webkit", testMatch: /(?:mobile-gameplay|tablet-controls)\.spec\.ts/, use: { ...devices["iPad Pro 11"], browserName: "webkit", viewport: { width: 1180, height: 820 } } },
    { name: "desktop-1920", testMatch: /visual\.spec\.ts/, use: { ...devices["Desktop Chrome"], viewport: { width: 1920, height: 1080 } } },
    { name: "lobby-problem-1714", testMatch: /visual\.spec\.ts/, use: { ...devices["Desktop Chrome"], viewport: { width: 1714, height: 895 } } },
    { name: "laptop-1366", testMatch: /visual\.spec\.ts/, use: { ...devices["Desktop Chrome"], viewport: { width: 1366, height: 768 } } },
    { name: "small-laptop-1280", testMatch: /visual\.spec\.ts/, use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 720 } } },
    { name: "tablet-landscape", testMatch: /visual\.spec\.ts/, use: { ...devices["Desktop Chrome"], viewport: { width: 1180, height: 820 } } },
    { name: "tablet-portrait", testMatch: /visual\.spec\.ts/, use: { ...devices["Desktop Chrome"], viewport: { width: 820, height: 1180 } } },
    { name: "mobile-portrait", testMatch: /visual\.spec\.ts/, use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 } } },
    { name: "mobile-landscape", testMatch: /visual\.spec\.ts/, use: { ...devices["Desktop Chrome"], viewport: { width: 844, height: 390 } } },
    { name: "responsive-source-dpr", testMatch: /responsive-regression\.spec\.ts/, use: { ...devices["Desktop Chrome"], viewport: { width: 1486, height: 776 }, deviceScaleFactor: 1.25 } },
    { name: "responsive-laptop-short", testMatch: /responsive-regression\.spec\.ts/, use: { ...devices["Desktop Chrome"], viewport: { width: 1366, height: 650 } } },
    { name: "responsive-tablet-landscape", testMatch: /responsive-regression\.spec\.ts/, use: { ...devices["iPad Pro 11"], viewport: { width: 1180, height: 820 } } },
    { name: "responsive-mobile-webkit", testMatch: /responsive-regression\.spec\.ts/, use: { ...devices["iPhone 13"], browserName: "webkit", viewport: { width: 390, height: 844 } } },
  ],
  webServer: process.env.E2E_BASE_URL ? undefined : [
    {
      command: "npm --prefix ../worker run dev:e2e",
      url: LOCAL_WORKER_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
    },
    {
      command: "npm run dev -- --port 5273 --host 127.0.0.1",
      url: BASE_URL,
      env: { VITE_BACKEND_ORIGIN: LOCAL_WORKER_URL },
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
    },
  ],
});
