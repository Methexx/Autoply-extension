import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  reporter: 'html',
  use: {
    // Extension e2e tests launch a real Chromium with the extension loaded from dist/
    // The actual launch context is set up in each test file
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium-extension',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
