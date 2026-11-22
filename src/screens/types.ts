import type { Group } from '../group'

export type Screen = 'start' | 'roles' | 'map'
export type ScreenProps = {
  go: (screen: Screen) => void
  group: Group | undefined
  setGroup: (group: Group) => void
}
