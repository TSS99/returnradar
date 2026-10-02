import { defineConfig } from "@playwright/test";
import path from "node:path";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  use: {
    baseURL: "http://127.0.0.1:5173",
    viewport: { width: 1440, height: 1100 },
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: `${process.env.RETURNRADAR_PYTHON || ".venv/bin/python"} -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000`,
      cwd: "..",
      env: {
        RETURNRADAR_DATA_DIR: path.resolve(".cache/e2e-private_data"),
        RETURNRADAR_WORKER_ENABLED: "false",
      },
      url: "http://127.0.0.1:8000/api/health",
      reuseExistingServer: false,
    },
    {
      command: "npm run dev",
      url: "http://127.0.0.1:5173",
      reuseExistingServer: false,
    },
  ],
});
