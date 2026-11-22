export const SUGGESTED_NAMES = [
  'Otter', 'Kraniche', 'Igel', 'Luchse', 'Bernstein', 'Himmelblau',
  'Moosgrün', 'Kompass', 'Laterne', 'Sternwarte', 'Windrad', 'Pusteblume',
] as const

export const ROLES = ['Protokoll', 'Navigation', 'Recherche'] as const
export type Role = (typeof ROLES)[number]

export type Group = { name: string; round: number }
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
  if (trimmed.length > MAX_NAME_LENGTH) return `Der Gruppenname darf höchstens ${MAX_NAME_LENGTH} Zeichen haben.`
  return null
}
