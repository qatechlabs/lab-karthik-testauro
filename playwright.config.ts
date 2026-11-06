import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: process.env.LAB_DIR || 'labs',
  timeout: 30_000,
  retries: 0,
  workers: 1,
  use: {
    baseURL: process.env.LAB_BASE_URL || 'https://interview.qatechlabs.com/sandbox/swagshop',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  reporter: process.env.CI ? [['list'], ['json', { outputFile: 'results.json' }], ['html', { open: 'never' }], ['./lab-reporter.js']] : 'list',
});
