/**
 * Command palette (⌘K) spec — Phase C.
 *
 * Two layers:
 *  - the fuzzy matcher as a pure function (subsequence semantics, CJK, ranges);
 *  - the component driven through real DOM events, mounted into document.body
 *    so focus assertions are meaningful in jsdom.
 *
 * Feature-flag / simple-mode filtering is asserted in GlobalNav.spec.ts, where
 * the real store-driven nav lists exist — that is the functional contract
 * (a disabled feature must not become findable through search).
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, nextTick, ref } from 'vue'
import { fuzzyMatch, splitHighlight } from '@/components/command/fuzzy'
import CommandPalette from '@/components/command/CommandPalette.vue'
import {
  commandShortcutLabel,
  isCommandPaletteShortcut,
  resetBodyScrollLock,
} from '@/composables/useCommandPalette'
import type { CommandEntry } from '@/components/layout/navItems'

// The app pins vue-i18n to the runtime build (no message compiler), so resolve
// keys against the real zh locale instead of stubbing t() as identity.
vi.mock('vue-i18n', async () => {
  const zhMessages = (await import('@/i18n/locales/zh')).default
  const t = (key: string): string => {
    const parts = key.split('.')
    let node: unknown = zhMessages
    for (const part of parts) {
      if (node && typeof node === 'object' && part in (node as Record<string, unknown>)) {
        node = (node as Record<string, unknown>)[part]
      } else {
        return key
      }
    }
    return typeof node === 'string' ? node : key
  }
  return { useI18n: () => ({ t }) }
})

/* ------------------------------------------------------------------ fixtures */

function entry(path: string, label: string, group = 'pages'): CommandEntry {
  return {
    path,
    label,
    groupKey: group,
    groupLabelKey: group === 'pages' ? 'nav.commandGroupPages' : 'nav.commandGroupAccount',
  }
}

const ENTRIES: CommandEntry[] = [
  entry('/admin/dashboard', '仪表盘'),
  entry('/admin/users', '用户管理'),
  entry('/admin/usage', '使用记录'),
  entry('/admin/channels/monitor', 'Channel Monitor'),
  entry('/keys', 'API 密钥', 'account'),
  entry('/profile', '个人资料', 'account'),
]

/**
 * Harness that owns `open` (as GlobalNav does) and provides an external button
 * to hold focus before the palette opens, so focus-restore can be asserted.
 */
const Harness = defineComponent({
  name: 'PaletteHarness',
  components: { CommandPalette },
  props: {
    entries: { type: Array as () => CommandEntry[], default: () => ENTRIES },
    startOpen: { type: Boolean, default: false },
  },
  setup(props) {
    const open = ref(props.startOpen)
    const selected = ref<CommandEntry[]>([])
    return { open, selected }
  },
  template: `
    <div>
      <button class="outside-trigger" @click="open = true">open</button>
      <CommandPalette
        v-model:open="open"
        :entries="entries"
        @select="selected.push($event)"
      />
    </div>
  `,
})

function mountPalette(props: Record<string, unknown> = {}) {
  return mount(Harness, { props, attachTo: document.body })
}

const options = (wrapper: VueWrapper) => wrapper.findAll('.gn-cmdk-option')
const activeOption = (wrapper: VueWrapper) => wrapper.find('.gn-cmdk-option.active')
const input = (wrapper: VueWrapper) => wrapper.find('input[role="combobox"]')

async function openPalette(wrapper: VueWrapper) {
  await wrapper.find('.outside-trigger').trigger('click')
  await nextTick()
}

let mounted: VueWrapper[] = []

beforeEach(() => {
  resetBodyScrollLock()
  mounted = []
})

afterEach(() => {
  for (const wrapper of mounted) wrapper.unmount()
  resetBodyScrollLock()
})

function track(wrapper: VueWrapper): VueWrapper {
  mounted.push(wrapper)
  return wrapper
}

/* ------------------------------------------------------------ fuzzy matcher */

describe('fuzzy matcher', () => {
  it('matches non-adjacent subsequences and reports hit ranges', () => {
    const hit = fuzzyMatch('Channel Monitor', 'chmon')
    expect(hit).not.toBeNull()
    // "ch" from Channel, "mon" from Monitor
    expect(hit!.ranges).toEqual([
      [0, 2],
      [8, 11],
    ])
  })

  it('is case-insensitive and ignores whitespace in the query', () => {
    expect(fuzzyMatch('Channel Monitor', 'CHANNEL')).not.toBeNull()
    expect(fuzzyMatch('Channel Monitor', 'channel mon')).not.toBeNull()
    expect(fuzzyMatch('渠道监控', '渠道 监控')).not.toBeNull()
  })

  it('matches CJK by character subsequence without word segmentation', () => {
    expect(fuzzyMatch('渠道监控', '监控')).not.toBeNull()
    expect(fuzzyMatch('渠道监控', '渠监')).not.toBeNull()
    // order matters — a reversed subsequence is not a match
    expect(fuzzyMatch('渠道监控', '控监')).toBeNull()
  })

  it('returns null when a character is missing, never an empty result', () => {
    expect(fuzzyMatch('用户管理', 'xyz')).toBeNull()
    expect(fuzzyMatch('', 'a')).toBeNull()
  })

  it('treats an empty query as "match everything" with no ranges', () => {
    const hit = fuzzyMatch('anything', '   ')
    expect(hit).toEqual({ score: 0, ranges: [] })
  })

  it('ranks consecutive and prefix matches above scattered ones', () => {
    const prefix = fuzzyMatch('用户管理', '用户')!.score
    const scattered = fuzzyMatch('使用记录用户', '用户')!.score
    expect(prefix).toBeGreaterThan(scattered)
  })

  it('splitHighlight alternates plain and matched segments', () => {
    expect(splitHighlight('Channel', [[0, 2]])).toEqual([
      { text: 'Ch', hit: true },
      { text: 'annel', hit: false },
    ])
    expect(splitHighlight('Channel', [])).toEqual([{ text: 'Channel', hit: false }])
  })
})

describe('shortcut detection', () => {
  it('accepts Meta+K and Ctrl+K, rejects everything else', () => {
    const ev = (init: KeyboardEventInit) => new KeyboardEvent('keydown', init)
    expect(isCommandPaletteShortcut(ev({ key: 'k', metaKey: true }))).toBe(true)
    expect(isCommandPaletteShortcut(ev({ key: 'k', ctrlKey: true }))).toBe(true)
    expect(isCommandPaletteShortcut(ev({ key: 'K', metaKey: true }))).toBe(true)
    expect(isCommandPaletteShortcut(ev({ key: 'k' }))).toBe(false)
    expect(isCommandPaletteShortcut(ev({ key: 'j', metaKey: true }))).toBe(false)
    // Alt+Cmd+K is a different chord — do not steal it
    expect(isCommandPaletteShortcut(ev({ key: 'k', metaKey: true, altKey: true }))).toBe(false)
  })

  it('exposes a platform-appropriate shortcut label', () => {
    expect(['⌘K', 'Ctrl K']).toContain(commandShortcutLabel())
  })
})

/* ------------------------------------------------------------- rendering */

describe('CommandPalette — rendering', () => {
  it('renders nothing focusable while closed', () => {
    const wrapper = track(mountPalette())
    expect(wrapper.find('.gn-cmdk').classes()).not.toContain('open')
    expect(wrapper.find('.gn-cmdk-inner').exists()).toBe(false)
    expect(input(wrapper).exists()).toBe(false)
  })

  it('shows the full command list grouped, in source order, when opened empty', async () => {
    const wrapper = track(mountPalette())
    await openPalette(wrapper)

    expect(wrapper.find('.gn-cmdk').classes()).toContain('open')
    expect(options(wrapper)).toHaveLength(ENTRIES.length)

    const groups = wrapper.findAll('.gn-cmdk-group')
    expect(groups).toHaveLength(2)
    expect(groups[0].find('.gn-cmdk-group-title').text()).toBe('页面')
    expect(groups[1].find('.gn-cmdk-group-title').text()).toBe('我的账户')
    expect(groups[1].findAll('.gn-cmdk-option')).toHaveLength(2)
  })

  it('filters fuzzily and highlights the matched characters', async () => {
    const wrapper = track(mountPalette())
    await openPalette(wrapper)
    await input(wrapper).setValue('用户')

    const rows = options(wrapper)
    expect(rows).toHaveLength(1)
    expect(rows[0].attributes('href')).toBe('/admin/users')
    expect(rows[0].find('.gn-cmdk-label .hit').text()).toBe('用户')
  })

  it('matches paths as well as labels', async () => {
    const wrapper = track(mountPalette())
    await openPalette(wrapper)
    await input(wrapper).setValue('/profile')

    const rows = options(wrapper)
    expect(rows).toHaveLength(1)
    expect(rows[0].attributes('href')).toBe('/profile')
  })

  it('shows the empty state when nothing matches', async () => {
    const wrapper = track(mountPalette())
    await openPalette(wrapper)
    await input(wrapper).setValue('zzzzz')

    expect(options(wrapper)).toHaveLength(0)
    expect(wrapper.find('.gn-cmdk-empty').text()).toBe('未找到匹配的页面')
  })
})

/* -------------------------------------------------------------- keyboard */

describe('CommandPalette — keyboard navigation', () => {
  it('selects the first row by default', async () => {
    const wrapper = track(mountPalette())
    await openPalette(wrapper)
    expect(activeOption(wrapper).attributes('href')).toBe('/admin/dashboard')
  })

  it('ArrowDown / ArrowUp move the selection and wrap at both ends', async () => {
    const wrapper = track(mountPalette())
    await openPalette(wrapper)
    const field = input(wrapper)

    await field.trigger('keydown', { key: 'ArrowDown' })
    expect(activeOption(wrapper).attributes('href')).toBe('/admin/users')

    await field.trigger('keydown', { key: 'ArrowUp' })
    expect(activeOption(wrapper).attributes('href')).toBe('/admin/dashboard')

    // wrap backwards from the first row to the last
    await field.trigger('keydown', { key: 'ArrowUp' })
    expect(activeOption(wrapper).attributes('href')).toBe('/profile')

    // and forwards from the last row back to the first
    await field.trigger('keydown', { key: 'ArrowDown' })
    expect(activeOption(wrapper).attributes('href')).toBe('/admin/dashboard')
  })

  it('selection order follows the rendered order across groups', async () => {
    const wrapper = track(mountPalette())
    await openPalette(wrapper)
    const field = input(wrapper)

    // 4 downs from row 0 lands on the first row of the second group
    for (let i = 0; i < 4; i += 1) await field.trigger('keydown', { key: 'ArrowDown' })
    expect(activeOption(wrapper).attributes('href')).toBe('/keys')
  })

  it('Enter emits the active entry and closes the palette', async () => {
    const wrapper = track(mountPalette())
    await openPalette(wrapper)
    const field = input(wrapper)

    await field.trigger('keydown', { key: 'ArrowDown' })
    await field.trigger('keydown', { key: 'Enter' })

    expect((wrapper.vm as unknown as { selected: CommandEntry[] }).selected).toHaveLength(1)
    expect((wrapper.vm as unknown as { selected: CommandEntry[] }).selected[0].path).toBe(
      '/admin/users',
    )
    expect((wrapper.vm as unknown as { open: boolean }).open).toBe(false)
  })

  it('Enter on an empty result set does nothing', async () => {
    const wrapper = track(mountPalette())
    await openPalette(wrapper)
    await input(wrapper).setValue('zzzzz')
    await input(wrapper).trigger('keydown', { key: 'Enter' })

    expect((wrapper.vm as unknown as { selected: CommandEntry[] }).selected).toHaveLength(0)
    expect((wrapper.vm as unknown as { open: boolean }).open).toBe(true)
  })

  it('clicking a row emits it', async () => {
    const wrapper = track(mountPalette())
    await openPalette(wrapper)
    await options(wrapper)[2].trigger('click')

    expect((wrapper.vm as unknown as { selected: CommandEntry[] }).selected[0].path).toBe(
      '/admin/usage',
    )
  })

  it('typing resets the selection to the top of the new result set', async () => {
    const wrapper = track(mountPalette())
    await openPalette(wrapper)
    await input(wrapper).trigger('keydown', { key: 'ArrowDown' })
    await input(wrapper).trigger('keydown', { key: 'ArrowDown' })
    expect(activeOption(wrapper).attributes('href')).toBe('/admin/usage')

    await input(wrapper).setValue('a')
    expect(activeOption(wrapper).attributes('href')).toBe(options(wrapper)[0].attributes('href'))
  })

  it('mousemove over a row makes it the active row (one selection model)', async () => {
    const wrapper = track(mountPalette())
    await openPalette(wrapper)
    await options(wrapper)[3].trigger('mousemove')

    expect(wrapper.findAll('.gn-cmdk-option.active')).toHaveLength(1)
    expect(activeOption(wrapper).attributes('href')).toBe('/admin/channels/monitor')
  })
})

/* -------------------------------------------------------------- shortcut */

describe('CommandPalette — global shortcut', () => {
  const press = (init: KeyboardEventInit) =>
    document.dispatchEvent(new KeyboardEvent('keydown', { ...init, cancelable: true }))

  it('⌘K opens the palette and ⌘K again closes it', async () => {
    const wrapper = track(mountPalette())
    expect((wrapper.vm as unknown as { open: boolean }).open).toBe(false)

    press({ key: 'k', metaKey: true })
    await nextTick()
    expect((wrapper.vm as unknown as { open: boolean }).open).toBe(true)

    press({ key: 'k', metaKey: true })
    await nextTick()
    expect((wrapper.vm as unknown as { open: boolean }).open).toBe(false)
  })

  it('Ctrl+K works too (Windows / Linux)', async () => {
    const wrapper = track(mountPalette())
    press({ key: 'k', ctrlKey: true })
    await nextTick()
    expect((wrapper.vm as unknown as { open: boolean }).open).toBe(true)
  })

  it('preventDefault stops the browser stealing the chord', () => {
    track(mountPalette())
    const event = new KeyboardEvent('keydown', { key: 'k', metaKey: true, cancelable: true })
    document.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
  })

  it('Escape closes the palette from the document listener', async () => {
    const wrapper = track(mountPalette({ startOpen: true }))
    await nextTick()
    press({ key: 'Escape' })
    await nextTick()
    expect((wrapper.vm as unknown as { open: boolean }).open).toBe(false)
  })

  it('Escape in the input closes the palette', async () => {
    const wrapper = track(mountPalette())
    await openPalette(wrapper)
    await input(wrapper).trigger('keydown', { key: 'Escape' })
    expect((wrapper.vm as unknown as { open: boolean }).open).toBe(false)
  })

  it('the listener is removed on unmount', async () => {
    const wrapper = mountPalette()
    wrapper.unmount()
    // No component is listening any more, so the chord must not be swallowed.
    const event = new KeyboardEvent('keydown', { key: 'k', metaKey: true, cancelable: true })
    document.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(false)
  })
})

/* --------------------------------------------------- a11y, focus, scroll */

describe('CommandPalette — accessibility and focus', () => {
  it('is a labelled modal dialog', async () => {
    const wrapper = track(mountPalette())
    await openPalette(wrapper)
    const dialog = wrapper.find('.gn-cmdk')
    expect(dialog.attributes('role')).toBe('dialog')
    expect(dialog.attributes('aria-modal')).toBe('true')
    expect(dialog.attributes('aria-label')).toBe('命令面板')
  })

  it('wires the combobox to the listbox and the active option', async () => {
    const wrapper = track(mountPalette())
    await openPalette(wrapper)
    const field = input(wrapper)

    expect(field.attributes('aria-controls')).toBe('gn-cmdk-listbox')
    expect(field.attributes('aria-expanded')).toBe('true')
    expect(wrapper.find('[role="listbox"]').exists()).toBe(true)

    const firstId = activeOption(wrapper).attributes('id')
    expect(field.attributes('aria-activedescendant')).toBe(firstId)
    expect(activeOption(wrapper).attributes('aria-selected')).toBe('true')

    await field.trigger('keydown', { key: 'ArrowDown' })
    expect(field.attributes('aria-activedescendant')).toBe(
      activeOption(wrapper).attributes('id'),
    )
    expect(field.attributes('aria-activedescendant')).not.toBe(firstId)
  })

  it('moves focus into the input on open', async () => {
    const wrapper = track(mountPalette())
    await openPalette(wrapper)
    await nextTick()
    expect(document.activeElement).toBe(input(wrapper).element)
  })

  it('traps Tab between the input and the close button', async () => {
    const wrapper = track(mountPalette())
    await openPalette(wrapper)
    await nextTick()

    const field = input(wrapper).element as HTMLInputElement
    const closeBtn = wrapper.find('.gn-cmdk-close').element as HTMLButtonElement

    // Forward from the last stop wraps to the first.
    closeBtn.focus()
    expect(document.activeElement).toBe(closeBtn)
    await wrapper.find('.gn-cmdk').trigger('keydown', { key: 'Tab' })
    expect(document.activeElement).toBe(field)

    // Backward from the first stop wraps to the last.
    await wrapper.find('.gn-cmdk').trigger('keydown', { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(closeBtn)
  })

  it('result rows stay out of the Tab order (they are reached with arrows)', async () => {
    const wrapper = track(mountPalette())
    await openPalette(wrapper)
    for (const row of options(wrapper)) {
      expect(row.attributes('tabindex')).toBe('-1')
    }
  })

  it('the close button closes the palette', async () => {
    const wrapper = track(mountPalette())
    await openPalette(wrapper)
    await wrapper.find('.gn-cmdk-close').trigger('click')
    expect((wrapper.vm as unknown as { open: boolean }).open).toBe(false)
  })

  it('returns focus to the element that opened it', async () => {
    const wrapper = track(mountPalette())
    const trigger = wrapper.find('.outside-trigger').element as HTMLButtonElement
    trigger.focus()
    expect(document.activeElement).toBe(trigger)

    await openPalette(wrapper)
    await nextTick()
    expect(document.activeElement).toBe(input(wrapper).element)

    await input(wrapper).trigger('keydown', { key: 'Escape' })
    await nextTick()
    expect(document.activeElement).toBe(trigger)
  })

  it('locks body scroll while open and restores it on close', async () => {
    const wrapper = track(mountPalette())
    expect(document.body.style.overflow).toBe('')

    await openPalette(wrapper)
    expect(document.body.style.overflow).toBe('hidden')

    await input(wrapper).trigger('keydown', { key: 'Escape' })
    await nextTick()
    expect(document.body.style.overflow).toBe('')
  })

  it('releases the scroll lock if unmounted while open', async () => {
    const wrapper = mountPalette({ startOpen: true })
    await nextTick()
    expect(document.body.style.overflow).toBe('hidden')

    wrapper.unmount()
    expect(document.body.style.overflow).toBe('')
  })

  it('clears the query between openings', async () => {
    const wrapper = track(mountPalette())
    await openPalette(wrapper)
    await input(wrapper).setValue('用户')
    expect(options(wrapper)).toHaveLength(1)

    await input(wrapper).trigger('keydown', { key: 'Escape' })
    await nextTick()
    await openPalette(wrapper)

    expect((input(wrapper).element as HTMLInputElement).value).toBe('')
    expect(options(wrapper)).toHaveLength(ENTRIES.length)
  })
})
