import { defineConfig } from '@playwright/test';
import { env } from 'node:process';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: true,
  retries: 0,
  timeout: 30_000,
  globalTimeout: 180_000,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:5173',
    browserName: 'chromium',
    viewport: { width: 1440, height: 1000 },
    locale: 'en-GB',
    timezoneId: 'Europe/Vilnius',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: env.PLAYWRIGHT_BASE_URL
    ? undefined
    : [
        {
          name: 'API',
          command:
            'dotnet run --project ../src/RoomReservations.Api --configuration Release --no-launch-profile --urls http://127.0.0.1:5080',
          url: 'http://127.0.0.1:5080/api/health',
          timeout: 120_000,
          reuseExistingServer: false,
        },
        {
          name: 'Web',
          command: 'npm run dev',
          url: 'http://127.0.0.1:5173',
          reuseExistingServer: false,
        },
      ],
});
