export type LatLon = { lat: number; lon: number }

export const EARTH_RADIUS_M = 6371008.8

const rad = (deg: number) => (deg * Math.PI) / 180

export function distanceMeters(a: LatLon, b: LatLon): number {
  const h =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lon - a.lon) / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h))
}

export function isWithinRadius(a: LatLon, b: LatLon, radiusM: number): boolean {
  return distanceMeters(a, b) <= radiusM
}
