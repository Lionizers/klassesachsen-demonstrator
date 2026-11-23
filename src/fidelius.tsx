import type { ComponentChildren } from 'preact'
import { GUIDE_NAME } from './minigames/burg-funkelfels'

const FUR = '#e8702a'
const CREAM = '#fff3e3'
const DARK = '#2b1d12'

/** Own drawing of the guide; with `label` it is a named image, without it decoration next to text that names him. */
export function FoxArt({ label, class: className }: { label?: string; class?: string }) {
  return (
    <svg viewBox="0 0 120 120" class={className} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <path d="M30 120c0-26 13-38 30-38s30 12 30 38Z" fill={FUR} />
      <path d="M48 120c0-16 5-25 12-25s12 9 12 25Z" fill={CREAM} />
      <path d="M40 84q20 12 40 0l3 9q-23 13-46 0Z" fill="#1f7a72" />
      <path d="M26 14l22 26-26 12ZM94 14 72 40l26 12Z" fill={FUR} />
      <path d="M30 24l11 15-11 5ZM90 24 79 39l11 5Z" fill="#ffd2ad" />
      <path d="M22 48c0-16 16-22 38-22s38 6 38 22c0 18-18 36-38 38-20-2-38-20-38-38Z" fill={FUR} />
      <path d="M40 62q20-12 40 0-6 22-20 24-14-2-20-24Z" fill={CREAM} />
      <circle cx="45" cy="50" r="4.5" fill={DARK} />
      <circle cx="75" cy="50" r="4.5" fill={DARK} />
      <circle cx="46.5" cy="48.5" r="1.5" fill="#fff" />
      <circle cx="76.5" cy="48.5" r="1.5" fill="#fff" />
      <path d="M54 66q6-5 12 0-6 7-12 0Z" fill={DARK} />
      <path d="M53 73q7 6 14 0" fill="none" stroke={DARK} stroke-width="2.5" stroke-linecap="round" />
    </svg>
  )
}

/** The guide with a speech bubble; `live` makes the bubble announce what is added to it. */
export function Fidelius({ children, live }: { children: ComponentChildren; live?: boolean }) {
  return (
    <div class="fidelius">
      <FoxArt label={GUIDE_NAME} class="fox" />
      <div class="bubble" aria-live={live ? 'polite' : undefined}>{children}</div>
    </div>
  )
}
