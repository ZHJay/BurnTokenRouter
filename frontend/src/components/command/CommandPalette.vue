<template>
  <!--
    Root keeps the `.gn-search-bar` class on purpose.

    That class is the top bar's "panel hanging below the 48px bar" contract and
    it is referenced by name in two places outside this component:
      - phase-b-qa/verify.py exempts `.gn-search-bar` from the nav-containment
        assertion (children of the bar must not spill out of 48px, but this
        panel is *supposed* to hang below it);
      - phase-b-qa/sweep.py asserts the panel opens full-width and is opaque.
    Renaming it would silently drop both checks rather than fail them.

    `.gn-cmdk` carries everything specific to the palette.
  -->
  <div
    ref="rootRef"
    class="gn-search-bar gn-cmdk"
    :class="{ open: isOpen }"
    role="dialog"
    aria-modal="true"
    :aria-label="t('nav.commandPalette')"
    @keydown="handleFocusTrap"
  >
    <!--
      Contents are mounted only while open: a closed palette must not leave
      focusable links in the tab order, and `visibility: hidden` alone would
      still expose them to some assistive tech.
    -->
    <div v-if="isOpen" class="gn-search-inner gn-cmdk-inner">
      <div class="gn-search-input gn-cmdk-field">
        <Icon name="search" />
        <!--
          Combobox rather than a plain input: focus stays in the field while
          ↑/↓ move a virtual selection, announced through aria-activedescendant.
        -->
        <input
          ref="inputRef"
          v-model="query"
          type="text"
          role="combobox"
          autocomplete="off"
          spellcheck="false"
          aria-autocomplete="list"
          :aria-expanded="resultCount > 0"
          :aria-controls="listboxId"
          :aria-activedescendant="activeItem ? optionId(activeItem.index) : undefined"
          :aria-label="t('nav.search')"
          :placeholder="t('nav.searchPlaceholder')"
          @keydown="handleInputKeydown"
        />
        <kbd class="gn-cmdk-kbd">{{ shortcutLabel }}</kbd>
        <button
          type="button"
          class="gn-cmdk-close"
          :aria-label="t('common.close')"
          @click="close"
        >
          <Icon name="x" />
        </button>
      </div>

      <div
        :id="listboxId"
        class="gn-cmdk-results"
        role="listbox"
        :aria-label="t('nav.searchResults')"
      >
        <div
          v-for="group in groups"
          :key="group.key"
          class="gn-cmdk-group"
          role="group"
          :aria-labelledby="`${listboxId}-${group.key}`"
        >
          <div :id="`${listboxId}-${group.key}`" class="gn-cmdk-group-title">
            {{ t(group.labelKey) }}
          </div>
          <a
            v-for="item in group.items"
            :id="optionId(item.index)"
            :key="item.entry.path"
            class="gn-cmdk-option"
            :class="{ active: item.index === activeIndex }"
            role="option"
            :aria-selected="item.index === activeIndex"
            :href="item.entry.path"
            tabindex="-1"
            @click.prevent="selectEntry(item.entry)"
            @mousemove="setActiveIndex(item.index)"
          >
            <span class="gn-cmdk-label">
              <span
                v-for="(segment, i) in item.labelSegments"
                :key="i"
                :class="{ hit: segment.hit }"
                >{{ segment.text }}</span
              >
            </span>
            <span class="gn-cmdk-path">
              <span
                v-for="(segment, i) in item.pathSegments"
                :key="i"
                :class="{ hit: segment.hit }"
                >{{ segment.text }}</span
              >
            </span>
          </a>
        </div>
        <div v-if="resultCount === 0" class="gn-cmdk-empty">{{ t('nav.searchNoResults') }}</div>
      </div>

      <div class="gn-cmdk-foot">
        <span class="gn-cmdk-hint">
          <kbd>↑</kbd><kbd>↓</kbd>{{ t('nav.commandHintSelect') }}
        </span>
        <span class="gn-cmdk-hint"><kbd>↵</kbd>{{ t('nav.commandHintOpen') }}</span>
        <span class="gn-cmdk-hint"><kbd>esc</kbd>{{ t('nav.commandHintClose') }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Global command palette (⌘K / Ctrl+K) — Phase C.
 *
 * Presentation only. Filtering, ranking, keyboard selection, the global
 * shortcut, scroll locking and focus restoration all live in
 * `useCommandPalette`. Command entries arrive pre-filtered from GlobalNav
 * (feature flags + simple mode already applied) — this component must never
 * derive its own nav list, or disabled features would become searchable.
 */
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Icon from '@/components/icons/Icon.vue'
import { useCommandPalette } from '@/composables/useCommandPalette'
import type { CommandEntry } from '@/components/layout/navItems'

const props = defineProps<{
  /** Open state, owned by the parent (it also drives the curtain + aria-expanded). */
  open: boolean
  /** Already-filtered command entries. */
  entries: CommandEntry[]
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  select: [entry: CommandEntry]
}>()

const { t } = useI18n()

const listboxId = 'gn-cmdk-listbox'
const rootRef = ref<HTMLElement | null>(null)
const inputRef = ref<HTMLInputElement | null>(null)

const isOpen = computed({
  get: () => props.open,
  set: (value: boolean) => emit('update:open', value),
})

const entries = computed(() => props.entries)

const {
  query,
  activeIndex,
  groups,
  resultCount,
  activeItem,
  shortcutLabel,
  optionId,
  close,
  setActiveIndex,
  selectEntry,
  handleInputKeydown,
} = useCommandPalette({
  entries,
  isOpen,
  onSelect: (entry) => emit('select', entry),
})

/**
 * Move focus into the field on open (the panel mounts in the same tick).
 * `immediate` covers the mounted-already-open case.
 */
watch(
  isOpen,
  (open) => {
    if (!open) return
    void nextTick(() => inputRef.value?.focus())
  },
  { immediate: true },
)

/** Keep the keyboard-selected row visible when the list scrolls. */
watch(activeIndex, (index) => {
  void nextTick(() => {
    const row = rootRef.value?.querySelector<HTMLElement>(`#${optionId(index)}`)
    // jsdom does not implement scrollIntoView.
    if (row && typeof row.scrollIntoView === 'function') {
      row.scrollIntoView({ block: 'nearest' })
    }
  })
})

/**
 * Focus trap. Result rows are `tabindex="-1"` (standard combobox practice —
 * they are reached with ↑/↓, not Tab), so the cycle is field ↔ close button.
 */
function handleFocusTrap(event: KeyboardEvent): void {
  if (event.key !== 'Tab' || !isOpen.value) return
  const focusables = Array.from(
    rootRef.value?.querySelectorAll<HTMLElement>(
      'input, button:not([tabindex="-1"]), a[href]:not([tabindex="-1"])',
    ) ?? [],
  )
  if (focusables.length === 0) return
  const first = focusables[0]
  const last = focusables[focusables.length - 1]
  const active = document.activeElement
  if (event.shiftKey && (active === first || !rootRef.value?.contains(active))) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && active === last) {
    event.preventDefault()
    first.focus()
  }
}
</script>
