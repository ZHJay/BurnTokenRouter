/**
 * Focus trap - shared by modal overlays (AnnouncementPopup, AnnouncementBell
 * list/detail). New public asset introduced by fix_a11y_overlay; the pattern
 * is lifted from the Cmd+K command palette (CommandPalette.vue handleFocusTrap
 * + useCommandPalette.ts focus capture/restore), which the a11y audit
 * measured as fully passing, so consumers here get the same keyboard contract
 * without copy-pasting it per overlay.
 *
 * While `isActive` is true the trap:
 *  - captures the previously focused element (the trigger) on open;
 *  - moves focus into the container on open (first focusable element, or the
 *    container itself when there is none - containers should carry
 *    `tabindex="-1"`);
 *  - wraps Tab / Shift+Tab inside the container. The listener lives on the
 *    container itself, exactly like CommandPalette's root @keydown: focus
 *    always sits inside the container, so Tab always originates there;
 *  - on close (or unmount while open) restores focus to the trigger.
 *
 * Escape is intentionally NOT handled here. Overlays that stack inside one
 * component (bell list under detail) must route Esc to their own top-most
 * layer, and two components can both be open at once (a global popup can
 * appear over the bell list). Each overlay owner registers exactly one
 * document-level Esc listener while any of its layers is open; a later-opened
 * overlay registers later, runs first, and stopImmediatePropagation keeps
 * layers underneath from closing in the same press.
 *
 * Background hiding: while any trap is active the app root (`#app`) gets
 * `aria-hidden="true"` so assistive tech does not read the page behind the
 * overlay. The overlays themselves Teleport to <body>, outside #app, so they
 * are never hidden. A module-level counter makes nested traps compose: only
 * the last trap leaving removes the attribute. The attribute is removed
 * BEFORE focus returns to a trigger that lives inside #app, or a screen
 * reader would not announce it.
 */
import { nextTick, onBeforeUnmount, watch, type Ref } from 'vue'

export interface UseFocusTrapOptions {
  /** Element whose focusable descendants form the trap cycle. */
  containerRef: Ref<HTMLElement | null>
  /** When true the trap is armed (focus-in, Tab wrap, background hiding). */
  isActive: Ref<boolean>
  /** Restore focus to the trigger on close. Defaults to true. */
  restoreFocus?: boolean
}

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

let backgroundHiddenCount = 0

function hideAppBackground(): void {
  backgroundHiddenCount += 1
  if (backgroundHiddenCount === 1) {
    document.getElementById('app')?.setAttribute('aria-hidden', 'true')
  }
}

function showAppBackground(): void {
  if (backgroundHiddenCount === 0) return
  backgroundHiddenCount -= 1
  if (backgroundHiddenCount === 0) {
    document.getElementById('app')?.removeAttribute('aria-hidden')
  }
}

/** Test-only: drop any leftover background hiding (module-level counter). */
export function resetBackgroundHidden(): void {
  backgroundHiddenCount = 0
  document.getElementById('app')?.removeAttribute('aria-hidden')
}

export function useFocusTrap(options: UseFocusTrapOptions): void {
  const { containerRef, isActive, restoreFocus = true } = options
  /** Element to hand focus back to on close (the trigger, usually). */
  let previouslyFocused: HTMLElement | null = null

  function getFocusables(): HTMLElement[] {
    const root = containerRef.value
    if (!root) return []
    return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
  }

  /** First focusable, falling back to the container itself. */
  function focusInside(): void {
    void nextTick(() => {
      const root = containerRef.value
      if (!root || !isActive.value) return
      const target = getFocusables()[0] ?? root
      target.focus()
    })
  }

  function handleKeydown(event: KeyboardEvent): void {
    const root = containerRef.value
    if (!root || !isActive.value) return
    if (event.key !== 'Tab') return

    const focusables = getFocusables()
    if (focusables.length === 0) {
      event.preventDefault()
      root.focus()
      return
    }
    const first = focusables[0]
    const last = focusables[focusables.length - 1]
    const active = document.activeElement
    const inside = root.contains(active)
    // `!inside` covers focus that escaped the container by any means: the very
    // next Tab snaps it back to the first stop instead of moving into the page.
    if (event.shiftKey && (!inside || active === first)) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && (!inside || active === last)) {
      event.preventDefault()
      first.focus()
    }
  }

  function restore(): void {
    if (!restoreFocus) return
    const target = previouslyFocused
    previouslyFocused = null
    target?.focus()
  }

  watch(
    isActive,
    (active) => {
      if (active) {
        const current = document.activeElement
        previouslyFocused = current instanceof HTMLElement ? current : null
        hideAppBackground()
        focusInside()
        return
      }
      // Background must be visible again before focus returns to a trigger
      // that lives inside it, or assistive tech would not announce it.
      showAppBackground()
      restore()
    },
    { immediate: true },
  )

  // Tab trap: the container may render a tick after the watch above fires
  // (the overlay v-if is bound to the same state), so watch both. Events from
  // inside the container bubble up to this listener.
  watch(
    [isActive, containerRef],
    ([active, root]) => {
      if (active && root) {
        root.addEventListener('keydown', handleKeydown)
      } else if (root) {
        root.removeEventListener('keydown', handleKeydown)
      }
    },
    { immediate: true },
  )

  onBeforeUnmount(() => {
    containerRef.value?.removeEventListener('keydown', handleKeydown)
    if (isActive.value) {
      showAppBackground()
      restore()
    }
  })
}
