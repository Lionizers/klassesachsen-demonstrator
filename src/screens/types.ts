import type { Group } from '../group'

/** Store keys of the last view, so a reopened tab continues there. */
export const SCREEN_KEY = 'screen'
export const PLACE_KEY = 'place'

export type Screen = 'welcome' | 'start' | 'roles' | 'map' | 'collection' | 'teacher'
export type ScreenProps = {
  /** `anchor` names a part of the next screen that gets the focus instead of its heading. */
  go: (screen: Screen, anchor?: Anchor) => void
  group: Group | undefined
  setGroup: (group: Group | undefined) => void
  /** The `?start=` code the app was opened with, until the first navigation. */
  startCode?: string
  /** Set by `go` until the next navigation. */
  anchor?: Anchor
  openSettings: () => void
}
export type Anchor = 'collage'
