export type PlaceId = 'funkelfels' | 'kruemelbach' | 'wackelstein'

/** The one place that has minigames in the demonstrator. */
export const MINIGAME_PLACE: PlaceId = 'funkelfels'

/** x/y are percent positions on the map image; lat/lon are fictional, near 0°N 0°E. */
export type Place = { id: PlaceId; name: string; code: string; lat: number; lon: number; x: number; y: number }

export const PLACES: Place[] = [
  { id: 'funkelfels', name: 'Burg Funkelfels', code: 'FUNKELFELS', lat: 0.004, lon: 0.002, x: 22, y: 22 },
  { id: 'kruemelbach', name: 'Kloster Krümelbach', code: 'KRUEMELBACH', lat: 0.001, lon: 0.006, x: 70, y: 40 },
  { id: 'wackelstein', name: 'Mühle Wackelstein', code: 'WACKELSTEIN', lat: -0.002, lon: 0.001, x: 30, y: 78 },
]

/** Codes are printed without umlauts, but children type the name as they know it ("Krümelbach"); ß already becomes SS. */
export const normalizeCode = (code: string) =>
  code.trim().toUpperCase().replace(/Ä/g, 'AE').replace(/Ö/g, 'OE').replace(/Ü/g, 'UE')

export function checkCode(placeId: PlaceId, code: string): 'reached' | 'wrong' {
  const place = PLACES.find((p) => p.id === placeId)
  return place && normalizeCode(code) === place.code ? 'reached' : 'wrong'
}
