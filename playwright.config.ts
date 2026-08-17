import { defineConfig } from "@playwright/test";

const port = process.env.CIVICPIN_E2E_PORT ?? "3100";
const host = process.env.CIVICPIN_E2E_HOST ?? "127.0.0.1";
const baseURL = `http://${host}:${port}`;
const geocodingFixture = `data:application/json,${encodeURIComponent(JSON.stringify({ display_name: "桃園市桃園區測試路1號" }))}`;

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  webServer: {
    command: `npm run build && npm run start -- --hostname 127.0.0.1 --port ${port}`,
    url: baseURL,
    env: { ...process.env, NOMINATIM_URL: geocodingFixture },
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
