import { defineConfig } from "@playwright/test";

const PORT = 3100;

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: `next start -p ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    timeout: 180_000,
    reuseExistingServer: true,
    env: {
      TURSO_DATABASE_URL: "file:./test.db",
      TURSO_AUTH_TOKEN: "",
      NEXTAUTH_SECRET: "test-secret",
      AUTH_SECRET: "test-secret",
      AUTH_TRUST_HOST: "true",
      NEXTAUTH_URL: `http://localhost:${PORT}`,
    },
  },
});
