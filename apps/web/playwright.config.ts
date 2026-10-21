import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  timeout: 60000,
  workers: 1,
  use: { baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3101', viewport: { width: 1440, height: 1000 }, headless: true, trace: 'retain-on-failure' },
});
