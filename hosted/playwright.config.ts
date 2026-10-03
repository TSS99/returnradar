import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/browser",
  workers: 1,
  fullyParallel: false,
  timeout: 45000,
  use: { baseURL: "http://127.0.0.1:5174", headless: true },
  reporter: "list",
});
