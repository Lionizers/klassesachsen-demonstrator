import { describe, expect, it } from 'vitest'
import { EARTH_RADIUS_M, distanceMeters, isWithinRadius } from './geo'

const origin = { lat: 0, lon: 0 }
const north = (m: number) => ({ lat: ((m / EARTH_RADIUS_M) * 180) / Math.PI, lon: 0 })

describe('geo', () => {
  it('measures a known distance along a meridian', () => {
    expect(distanceMeters(origin, north(250))).toBeCloseTo(250, 6)
  })

  it('AE4: exactly 100 m counts as inside the radius', () => {
    expect(isWithinRadius(origin, north(100), 100)).toBe(true)
  })

  it('AE5: 101 m is outside the radius', () => {
    expect(isWithinRadius(origin, north(101), 100)).toBe(false)
  })
})
