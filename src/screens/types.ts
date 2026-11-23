import type { Group } from '../group'

/** Store keys of the last view, so a reopened tab continues there. */
export const SCREEN_KEY = 'screen'
export const PLACE_KEY = 'place'

export type Screen = 'start' | 'roles' | 'map' | 'collection' | 'teacher'
export type ScreenProps = {
  go: (screen: Screen) => void
  group: Group | undefined
  setGroup: (group: Group | undefined) => void
  /** The `?start=` code the app was opened with, until the first navigation. */
  startCode?: string
}
