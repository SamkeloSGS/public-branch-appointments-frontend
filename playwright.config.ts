import { defineConfig, devices } from '@playwright/test'

// End-to-end tests run against the dev server and a running backend with the local Keycloak realm (see README.md).
// PW_CHANNEL=msedge or chrome uses an installed browser instead of Playwright's own (`npx playwright install chromium`).
export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: { timeout: 10_000 },
  // The journeys share one backend and the same test users, so they run one at a time
  workers: 1,
  fullyParallel: false,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:4200',
    trace: 'retain-on-failure',
    ...(process.env['PW_CHANNEL'] ? { channel: process.env['PW_CHANNEL'] } : {}),
  },
  projects: [
    // Customer screens at phone width (FE-17)
    { name: 'phone', testMatch: /customer-.*\.spec\.ts/, use: { ...devices['Pixel 5'], viewport: { width: 360, height: 780 } } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'npm start',
    url: 'http://localhost:4200',
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
