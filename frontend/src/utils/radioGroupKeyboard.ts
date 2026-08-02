/**
 * Arrow-key traversal for segmented value pickers exposed as `role="radiogroup"`.
 *
 * A radiogroup implies arrow-key navigation, so a segmented picker built from
 * plain buttons has to provide it. Rather than duplicating each component's
 * selection logic, this walks to the sibling `role="radio"` element and
 * dispatches a real click on it: the component's existing `@click` handler stays
 * the single source of truth, so emit names, emit order and any side effects
 * are identical whether the user clicked or used the keyboard.
 */
const STEP_BY_KEY: Record<string, number> = {
  ArrowLeft: -1,
  ArrowUp: -1,
  ArrowRight: 1,
  ArrowDown: 1,
}

export function handleRadioGroupKeydown(event: KeyboardEvent): void {
  const step = STEP_BY_KEY[event.key]
  if (step === undefined) {
    return
  }

  const current = event.currentTarget
  if (!(current instanceof HTMLElement)) {
    return
  }

  const group = current.closest('[role="radiogroup"]')
  if (!group) {
    return
  }

  const radios = Array.from(
    group.querySelectorAll<HTMLElement>('[role="radio"]'),
  ).filter(
    (radio) =>
      !radio.hasAttribute('disabled') &&
      radio.getAttribute('aria-disabled') !== 'true',
  )
  if (radios.length < 2) {
    return
  }

  const currentIndex = radios.indexOf(current)
  if (currentIndex < 0) {
    return
  }

  // Arrow keys would otherwise scroll the page.
  event.preventDefault()

  const next = radios[(currentIndex + step + radios.length) % radios.length]
  next.focus()
  next.click()
}
