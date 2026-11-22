/** Moves focus to the heading of the view just rendered; keyboard and screen reader users would otherwise land on body. */
export function focusHeading() {
  requestAnimationFrame(() => document.querySelector<HTMLElement>('main h2')?.focus())
}
