import type { Group } from '../group'

export type Screen = 'start' | 'roles' | 'place'
export type ScreenProps = {
  go: (screen: Screen) => void
  group: Group | undefined
  setGroup: (group: Group) => void
}
