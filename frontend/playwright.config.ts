import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './browser-tests',
  fullyParallel: true,
  workers: process.env.CI ? 2 : 1,
  expect: { timeout: 10000 },
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:4173', browserName: 'chromium', launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }, trace: 'retain-on-failure', serviceWorkers: 'block' },
  webServer: { command: 'npm run dev -- --host 127.0.0.1 --port 4173 --strictPort', url: 'http://127.0.0.1:4173/__ui', reuseExistingServer: !process.env.CI },
});
