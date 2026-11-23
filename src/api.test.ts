import { describe, expect, it, vi } from 'vitest'
import { apiResponse, handleApi, isApiRequest } from './api'
import type { Contribution } from './collage/layout'

const contribution = (id: string, released: boolean, previewType = 'image/webp'): Contribution => ({
  id,
  createdAt: '2026-11-23T09:00:00.000Z',
  type: 'item-collage',
  items: ['turmuhr'],
  released,
  png: new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' }),
  preview: new Blob([new Uint8Array([1, 2, 3])], { type: previewType }),
})
const RELEASED = '11111111-2222-4333-8444-555555555555'
const HIDDEN = '66666666-7777-4888-9999-aaaaaaaaaaaa'
const JPEG = '0f0f0f0f-1e1e-4d4d-8c8c-3b3b3b3b3b3b'
const all = [contribution(RELEASED, true), contribution(HIDDEN, false), contribution(JPEG, true, 'image/jpeg')]

describe('apiResponse', () => {
  it('AE6: lists only released contributions, as metadata without the images', async () => {
    const response = await apiResponse('/api/beitraege', all)
    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toMatch(/^application\/json/)
    expect(await response.json()).toEqual([
      { id: RELEASED, createdAt: '2026-11-23T09:00:00.000Z', type: 'item-collage', items: ['turmuhr'] },
      { id: JPEG, createdAt: '2026-11-23T09:00:00.000Z', type: 'item-collage', items: ['turmuhr'] },
    ])
  })

  it('AE6: serves the images of a released contribution', async () => {
    const png = await apiResponse(`/api/beitraege/${RELEASED}.png`, all)
    expect(png.headers.get('Content-Type')).toBe('image/png')
    expect(new Uint8Array(await png.arrayBuffer())).toEqual(new Uint8Array([137, 80, 78, 71]))
    expect((await apiResponse(`/api/beitraege/${RELEASED}.webp`, all)).headers.get('Content-Type')).toBe('image/webp')
    expect((await apiResponse(`/api/beitraege/${JPEG}.jpg`, all)).headers.get('Content-Type')).toBe('image/jpeg')
  })

  it('AE6: unreleased, unknown, malformed and mismatched requests are 404', async () => {
    for (const path of [
      `/api/beitraege/${HIDDEN}.png`,
      `/api/beitraege/${HIDDEN}.webp`,
      '/api/beitraege/00000000-0000-4000-8000-000000000000.png',
      '/api/beitraege/../secret.png',
      `/api/beitraege/${RELEASED}.png.exe`,
      `/api/beitraege/${RELEASED}.jpg`,
      `/api/beitraege/${JPEG}.webp`,
      '/api/unknown',
    ]) {
      const response = await apiResponse(path, all)
      expect(response.status, path).toBe(404)
      expect(response.headers.get('X-Demonstrator'), path).toBe('simulation')
    }
  })

  it('AE6/AE9: every answer says it comes from the simulation', async () => {
    for (const path of ['/api/beitraege', `/api/beitraege/${RELEASED}.png`, '/api/export.zip']) {
      expect((await apiResponse(path, all)).headers.get('X-Demonstrator'), path).toBe('simulation')
    }
  })

  it('AE9: the export is a zip with metadata and both images of every released contribution only', async () => {
    const response = await apiResponse('/api/export.zip', all)
    expect(response.headers.get('Content-Type')).toBe('application/zip')
    const text = new TextDecoder('latin1').decode(await response.arrayBuffer())
    expect(text.startsWith('PK\x03\x04')).toBe(true)
    for (const name of [`${RELEASED}.json`, `${RELEASED}.png`, `${RELEASED}.webp`, `${JPEG}.jpg`, 'beitraege.json']) expect(text).toContain(name)
    expect(text).not.toContain(HIDDEN)
  })
})

describe('isApiRequest', () => {
  const at = (href: string, sameOrigin: boolean) => isApiRequest({ url: new URL(href), sameOrigin })

  it('answers only same-origin paths of the interface', () => {
    expect(at('https://app.example/api/beitraege', true)).toBe(true)
    expect(at('https://other.example/api/beitraege', false)).toBe(false)
    expect(at('https://app.example/karte', true)).toBe(false)
  })
})

describe('handleApi', () => {
  it('answers from the loaded contributions', async () => {
    const response = await handleApi('/api/beitraege', async () => all)
    expect(response.status).toBe(200)
  })

  it('a failed load is a 503 from the simulation and is logged', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const failure = new Error('quota')
    const response = await handleApi('/api/beitraege', () => Promise.reject(failure))
    expect(response.status).toBe(503)
    expect(response.headers.get('X-Demonstrator')).toBe('simulation')
    expect(log).toHaveBeenCalledWith(expect.any(String), failure)
    log.mockRestore()
  })
})
