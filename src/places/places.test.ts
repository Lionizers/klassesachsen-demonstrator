import { describe, expect, it } from 'vitest'
import { PLACES, checkCode } from './places'

describe('places', () => {
  it('AE1: has three fictional places with distinct codes', () => {
    expect(PLACES.map((p) => p.name)).toEqual(['Burg Funkelfels', 'Kloster Krümelbach', 'Mühle Wackelstein'])
    expect(new Set(PLACES.map((p) => p.code)).size).toBe(3)
  })

  it('AE2: the place own code is reached, ignoring case and spaces', () => {
    expect(checkCode('funkelfels', 'FUNKELFELS')).toBe('reached')
    expect(checkCode('funkelfels', ' funkelfels ')).toBe('reached')
  })

  it('AE3: another place code is wrong', () => {
    expect(checkCode('funkelfels', 'WACKELSTEIN')).toBe('wrong')
    expect(checkCode('funkelfels', '')).toBe('wrong')
  })
})
