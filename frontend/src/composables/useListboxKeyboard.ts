import type { Ref } from 'vue'

/*
 * Shared keyboard contract for the WAI-ARIA listbox/combobox pattern.
 *
 * Root cause this exists for: the old Select implementation attached the
 * open-state keydown handler to the dropdown *panel*, but in the non-searchable
 * branch (<= 5 options) focus never moves into the panel - it stays on the
 * trigger. ArrowDown/Up only opened the popup, Enter toggled it closed via the
 * native button click, and Escape never reached the panel handler.
 *
 * The fix is a single implementation attached to the element that actually
 * holds keyboard focus in each state:
 *   - closed                -> the trigger (ArrowDown/ArrowUp/Enter/Space open)
 *   - open, select-only     -> the trigger keeps focus and becomes the
 *                              combobox host (roving highlight announced via
 *                              aria-activedescendant)
 *   - open, searchable      -> the search input (editable combobox)
 */

export interface UseListboxKeyboardOptions {
  /** Popup open state, owned by the calling component. */
  isOpen: Ref<boolean>
  /** Index of the currently highlighted option (-1 = none). */
  focusedIndex: Ref<number>
  /** Called when a trigger key (↓/↑/Enter/Space) is pressed while closed. */
  open: () => void
  /** Called when the popup must close (Escape/Tab, without focus changes). */
  close: () => void
  /** Called on Escape so focus returns to the trigger. */
  restoreFocus: () => void
  /** Whether the option at `index` can receive the roving highlight. */
  isOptionNavigable: (index: number) => boolean
  /** Number of options currently rendered (filtered). */
  optionCount: () => number
  /** Select the highlighted option and tear the popup down. */
  selectIndex: (index: number) => void
  /** Scroll the highlighted option into the visible viewport of the list. */
  scrollToFocused: () => void
  /**
   * Space selects the highlighted option (select-only combobox trigger).
   * Pass `false` on a search input, where Space must type a character.
   * @default true
   */
  spaceSelects?: boolean
}

const TRIGGER_KEYS = new Set(['ArrowDown', 'ArrowUp', 'Enter', ' ', 'Spacebar'])

export function useListboxKeyboard(options: UseListboxKeyboardOptions) {
  const { isOpen, focusedIndex } = options

  /** Move the highlight by `delta`, wrapping around; skips non-navigable options. */
  function moveFocus(delta: number): void {
    const count = options.optionCount()
    if (count === 0) return
    // From "nothing focused", ArrowDown starts at the first option and
    // ArrowUp at the last; otherwise wrap around the list.
    let next = focusedIndex.value < 0 ? (delta > 0 ? -1 : 0) : focusedIndex.value
    for (let i = 0; i < count; i++) {
      next = (next + delta + count) % count
      if (options.isOptionNavigable(next)) {
        focusedIndex.value = next
        options.scrollToFocused()
        return
      }
    }
  }

  /** Jump to the first / last navigable option. */
  function moveToBoundary(boundary: 'first' | 'last'): void {
    const count = options.optionCount()
    if (count === 0) return
    if (boundary === 'first') {
      for (let i = 0; i < count; i++) {
        if (options.isOptionNavigable(i)) {
          focusedIndex.value = i
          options.scrollToFocused()
          return
        }
      }
    } else {
      for (let i = count - 1; i >= 0; i--) {
        if (options.isOptionNavigable(i)) {
          focusedIndex.value = i
          options.scrollToFocused()
          return
        }
      }
    }
  }

  /** Select the highlighted option (no-op when nothing is highlighted). */
  function selectFocused(): void {
    const index = focusedIndex.value
    if (index < 0 || index >= options.optionCount()) return
    if (!options.isOptionNavigable(index)) return
    options.selectIndex(index)
  }

  /**
   * Single keydown entry point. Attach it to the trigger and, when the popup
   * has a search input, to that input as well - never to the panel itself.
   */
  function handleKeydown(event: KeyboardEvent): void {
    if (!isOpen.value) {
      if (event.repeat) return
      if (TRIGGER_KEYS.has(event.key)) {
        event.preventDefault()
        options.open()
      }
      return
    }

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        moveFocus(1)
        break
      case 'ArrowUp':
        event.preventDefault()
        moveFocus(-1)
        break
      case 'Home':
        event.preventDefault()
        moveToBoundary('first')
        break
      case 'End':
        event.preventDefault()
        moveToBoundary('last')
        break
      case 'Enter':
        event.preventDefault()
        selectFocused()
        break
      case ' ':
      case 'Spacebar':
        if (!options.spaceSelects) break
        event.preventDefault()
        selectFocused()
        break
      case 'Escape':
        event.preventDefault()
        // Stop the event here so an enclosing dialog / command palette does
        // not also react to the same Escape press.
        event.stopPropagation()
        options.close()
        options.restoreFocus()
        break
      case 'Tab':
        // Let the browser move focus; just tear the popup down.
        options.close()
        break
      default:
        break
    }
  }

  return { handleKeydown, moveFocus, moveToBoundary, selectFocused }
}
