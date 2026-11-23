import type { ManifestOptions } from 'vite-plugin-pwa'

export const manifest: Partial<ManifestOptions> = {
  name: 'Entdeckerreise – Demonstrator',
  short_name: 'Entdeckerreise',
  description: 'Demonstrator der Lionizers GmbH: ortsbasierte Lern- und Entdecker-App als PWA.',
  lang: 'de',
  start_url: '/',
  scope: '/',
  display: 'standalone',
  background_color: '#fff8ec',
  theme_color: '#0b5c5a',
  icons: [
    { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
    { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
}
