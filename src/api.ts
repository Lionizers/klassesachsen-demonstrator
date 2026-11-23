import { metaOf, type Contribution } from './collage/layout'
import { zip } from './zip'

export const API_PREFIX = '/api/'
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
const EXTENSION: Record<string, string> = { 'image/png': 'png', 'image/webp': 'webp', 'image/jpeg': 'jpg' }
const IMAGE = new RegExp(`^${API_PREFIX}beitraege/(${UUID})\\.(${Object.values(EXTENSION).join('|')})$`)
/** Every answer says it is the simulation, so nobody mistakes it for the real interface. */
const SIMULATION = { 'X-Demonstrator': 'simulation' }

const notFound = () => new Response('Nicht gefunden', { status: 404, headers: SIMULATION })
const file = (body: BodyInit, type: string) => new Response(body, { headers: { ...SIMULATION, 'Content-Type': type } })
const bytes = async (blob: Blob) => new Uint8Array(await blob.arrayBuffer())

/** The interface of the demonstrator, answered in the service worker from the stored contributions. */
export async function apiResponse(pathname: string, contributions: Contribution[]): Promise<Response> {
  const released = contributions.filter((c) => c.released)
  if (pathname === `${API_PREFIX}beitraege`) return file(JSON.stringify(released.map(metaOf)), 'application/json')
  if (pathname === `${API_PREFIX}export.zip`) {
    const json = (value: unknown) => new TextEncoder().encode(JSON.stringify(value, null, 2))
    const files = [{ name: 'beitraege.json', data: json(released.map(metaOf)) }]
    for (const c of released) {
      files.push(
        { name: `${c.id}.json`, data: json(metaOf(c)) },
        { name: `${c.id}.png`, data: await bytes(c.png) },
        { name: `${c.id}.${EXTENSION[c.preview.type]}`, data: await bytes(c.preview) },
      )
    }
    return file(zip(files), 'application/zip')
  }
  const [, id, extension] = IMAGE.exec(pathname) ?? []
  const contribution = released.find((c) => c.id === id)
  if (!contribution) return notFound()
  const image = extension === 'png' ? contribution.png : contribution.preview
  return EXTENSION[image.type] === extension ? file(image, image.type) : notFound()
}

export const isApiRequest = ({ url, sameOrigin }: { url: URL; sameOrigin: boolean }) =>
  sameOrigin && url.pathname.startsWith(API_PREFIX)

export async function handleApi(pathname: string, loadContributions: () => Promise<Contribution[] | undefined>): Promise<Response> {
  try {
    return await apiResponse(pathname, (await loadContributions()) ?? [])
  } catch (error) {
    console.error('Demonstrator-Schnittstelle: Beiträge nicht lesbar', error)
    return new Response('Nicht verfügbar', { status: 503, headers: SIMULATION })
  }
}
