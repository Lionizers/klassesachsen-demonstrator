import { describe, expect, it } from 'vitest'
import { MAX_NAME_LENGTH, ROLES, SUGGESTED_NAMES, rolesFor, validateName } from './group'

describe('group start', () => {
  it('AE1: offers at least 12 distinct neutral names', () => {
    expect(SUGGESTED_NAMES.length).toBeGreaterThanOrEqual(12)
    expect(new Set(SUGGESTED_NAMES).size).toBe(SUGGESTED_NAMES.length)
  })

  it('AE3: round 0 lists the three roles in base order', () => {
    expect(rolesFor(0)).toEqual(['Protokoll', 'Navigation', 'Recherche'])
    expect(ROLES).toHaveLength(3)
  })

  it('AE4: roles rotate each round and repeat after three rounds', () => {
    expect(rolesFor(1)).not.toEqual(rolesFor(0))
    expect(rolesFor(1)).toEqual(['Navigation', 'Recherche', 'Protokoll'])
    expect(rolesFor(3)).toEqual(rolesFor(0))
  })

  it('AE5: rejects empty and whitespace-only names with an explanation', () => {
    expect(validateName('')).toMatch(/Gruppennamen/)
    expect(validateName('   ')).toMatch(/Gruppennamen/)
    expect(validateName('Fuchs')).toBeNull()
  })

  it('accepts a name of exactly the maximum length and rejects one character more', () => {
    expect(validateName('a'.repeat(MAX_NAME_LENGTH))).toBeNull()
    expect(validateName('a'.repeat(MAX_NAME_LENGTH + 1))).toMatch(/höchstens/)
  })
})
