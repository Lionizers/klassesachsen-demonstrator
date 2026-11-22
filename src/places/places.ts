export type PlaceId = 'funkelfels' | 'kruemelbach' | 'wackelstein'

/** x/y are percent positions on the map image; lat/lon are fictional, near 0°N 0°E. */
export type Place = { id: PlaceId; name: string; code: string; lat: number; lon: number; x: number; y: number }

export const PLACES: Place[] = [
  { id: 'funkelfels', name: 'Burg Funkelfels', code: 'FUNKELFELS', lat: 0.004, lon: 0.002, x: 22, y: 22 },
  { id: 'kruemelbach', name: 'Kloster Krümelbach', code: 'KRUEMELBACH', lat: 0.001, lon: 0.006, x: 70, y: 40 },
  { id: 'wackelstein', name: 'Mühle Wackelstein', code: 'WACKELSTEIN', lat: -0.002, lon: 0.001, x: 30, y: 78 },
]

export function checkCode(placeId: PlaceId, code: string): 'reached' | 'wrong' {
  const place = PLACES.find((p) => p.id === placeId)
  return place && code.trim().toUpperCase() === place.code ? 'reached' : 'wrong'
}
