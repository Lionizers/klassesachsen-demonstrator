import { describe, expect, it } from 'vitest'
import { MAX_NAME_LENGTH, ROLES, SUGGESTED_NAMES, nameForCode, rolesFor, startCode, validateName } from './group'

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

  it('reserves names starting with „Beispiel“ for the invented demo groups', () => {
    expect(validateName('Beispiel Ahorn')).toMatch(/Beispiel/)
    expect(validateName(' beispiel')).toMatch(/Beispiel/)
    expect(validateName('Beispielhaft')).toBeNull()
  })

  it('accepts a name of exactly the maximum length and rejects one character more', () => {
    expect(validateName('a'.repeat(MAX_NAME_LENGTH))).toBeNull()
    expect(validateName('a'.repeat(MAX_NAME_LENGTH + 1))).toMatch(/höchstens/)
  })
})

describe('start codes', () => {
  it('AE1: the start code is the suggested name in capitals and leads back to it', () => {
    expect(startCode('Moosgrün')).toBe('MOOSGRÜN')
    for (const name of SUGGESTED_NAMES) expect(nameForCode(startCode(name))).toBe(name)
    expect(nameForCode(' otter ')).toBe('Otter')
    expect(nameForCode('Moosgrün')).toBe('Moosgrün')
    expect(nameForCode('MOOSGRUEN')).toBe('Moosgrün')
  })

  it('AE1: accepts only suggested names, no own name and no unknown code', () => {
    expect(nameForCode('HAMSTER')).toBeUndefined()
    expect(nameForCode('STERNSCHNUPPEN')).toBeUndefined()
    expect(nameForCode('')).toBeUndefined()
  })
})
