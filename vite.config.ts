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
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      injectManifest: { globPatterns: ['**/*.{js,css,html,svg,png,woff2,yaml}'] },
    }),
  ],
  test: { include: ['src/**/*.test.ts'] },
})
