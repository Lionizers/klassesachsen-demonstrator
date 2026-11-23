/**
 * Moves focus to the heading of the view just rendered; keyboard and screen reader users would otherwise land on body.
 * `selector` names another target, e.g. a part of the view; without a match the view heading gets the focus.
 */
export function focusHeading(selector?: string) {
  requestAnimationFrame(() => ((selector && document.querySelector<HTMLElement>(selector)) || document.querySelector<HTMLElement>('main h2'))?.focus())
}
