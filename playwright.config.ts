import { defineConfig, devices } from '@playwright/test'

const PORT = Number(process.env.E2E_PORT ?? 4173)

// Runs against the production build: the service worker only exists there.
export default defineConfig({
  testDir: 'e2e',
  use: { baseURL: `http://localhost:${PORT}` },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: { command: `npm run build && npm run preview -- --port ${PORT} --strictPort`, port: PORT, reuseExistingServer: !process.env.CI },
})
