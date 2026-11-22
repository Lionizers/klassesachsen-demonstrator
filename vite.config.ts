import { defineConfig } from 'vitest/config'
import preact from '@preact/preset-vite'
import { VitePWA } from 'vite-plugin-pwa'
import { manifest } from './src/pwa-manifest'

export default defineConfig({
  plugins: [
    preact(),
    {
      name: 'html-from-manifest',
      transformIndexHtml: (html: string) =>
        html.replace('%APP_NAME%', manifest.name!).replace('%THEME_COLOR%', manifest.theme_color!),
    },
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      manifest,
      workbox: { globPatterns: ['**/*.{js,css,html,svg,png,woff2}'], navigateFallback: '/index.html' },
    }),
  ],
  test: { include: ['src/**/*.test.ts'] },
})
