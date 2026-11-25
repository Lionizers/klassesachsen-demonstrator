import { normalizeCode } from './places/places'

export const SUGGESTED_NAMES = [
  'Otter', 'Kraniche', 'Igel', 'Luchse', 'Bernstein', 'Himmelblau',
  'Moosgrün', 'Kompass', 'Laterne', 'Sternwarte', 'Windrad', 'Pusteblume',
] as const

export const ROLES = ['Protokoll', 'Navigation', 'Recherche'] as const
export type Role = (typeof ROLES)[number]

/** `createdAt` starts the deletion periods, see teacher/report.ts. */
export type Group = { name: string; round: number; createdAt: number }
export const GROUP_KEY = 'group'
export const MAX_NAME_LENGTH = 30

/** Roles are positions, not people: each round shifts who holds which position. */
export function rolesFor(round: number): Role[] {
  const shift = round % ROLES.length
  return [...ROLES.slice(shift), ...ROLES.slice(0, shift)]
}

export function validateName(name: string): string | null {
  const trimmed = name.trim()
  if (trimmed === '') return 'Bitte einen Gruppennamen eingeben.'
  // The teacher view tells the invented demo groups apart from real ones by this prefix.
  if (/^beispiel\b/i.test(trimmed)) return 'Namen mit „Beispiel“ sind für die Beispielgruppen reserviert.'
  if (trimmed.length > MAX_NAME_LENGTH) return `Der Gruppenname darf höchstens ${MAX_NAME_LENGTH} Zeichen haben.`
  return null
}
/** A start code is a suggested name in capitals, so an own name, which could be a child's, cannot be started by code. */
export const startCode = (name: string) => name.toUpperCase()
export const nameForCode = (code: string) => SUGGESTED_NAMES.find((n) => normalizeCode(n) === normalizeCode(code))
