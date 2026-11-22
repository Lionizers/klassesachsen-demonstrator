import { describe, expect, it } from 'vitest'
import { manifest } from './pwa-manifest'

describe('PWA manifest', () => {
  it('has the fields browsers require for installation', () => {
    expect(manifest.name).toBeTruthy()
    expect(manifest.short_name).toBeTruthy()
    expect(manifest.start_url).toBe('/')
    expect(manifest.display).toBe('standalone')
    expect(manifest.lang).toBe('de')
  })

  it('ships 192 and 512 px icons, one of them maskable', () => {
    const icons = manifest.icons ?? []
    expect(icons.map((i) => i.sizes)).toEqual(expect.arrayContaining(['192x192', '512x512']))
    expect(icons.some((i) => i.purpose === 'maskable')).toBe(true)
  })

  it('does not carry the contracting authority brand', () => {
    expect(JSON.stringify(manifest)).not.toMatch(/Schl[öo]sser|SBG|Burgen und G[äa]rten/i)
  })
})
