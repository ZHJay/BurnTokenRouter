import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick, ref } from 'vue'

import DateRangePicker from '../DateRangePicker.vue'

const messages: Record<string, string> = {
  'dates.today': 'Today',
  'dates.yesterday': 'Yesterday',
  'dates.last24Hours': 'Last 24 Hours',
  'dates.last7Days': 'Last 7 Days',
  'dates.last14Days': 'Last 14 Days',
  'dates.last30Days': 'Last 30 Days',
  'dates.thisMonth': 'This Month',
  'dates.lastMonth': 'Last Month',
  'dates.startDate': 'Start Date',
  'dates.endDate': 'End Date',
  'dates.apply': 'Apply',
  'dates.selectDateRange': 'Select date range'
}

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => messages[key] ?? key,
    locale: ref('en')
  })
}))

const formatLocalDate = (date: Date): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

describe('DateRangePicker', () => {
  it('uses last 24 hours as the default recognized preset', () => {
    const now = new Date()
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    const wrapper = mount(DateRangePicker, {
      props: {
        startDate: formatLocalDate(yesterday),
        endDate: formatLocalDate(now)
      },
      global: {
        stubs: {
          Icon: true
        }
      }
    })

    expect(wrapper.text()).toContain('Last 24 Hours')
  })

  it('emits range updates with last24Hours preset when applied', async () => {
    const now = new Date()
    const today = formatLocalDate(now)

    const wrapper = mount(DateRangePicker, {
      props: {
        startDate: today,
        endDate: today
      },
      global: {
        stubs: {
          Icon: true
        }
      }
    })

    await wrapper.find('.date-picker-trigger').trigger('click')
    const presetButton = wrapper.findAll('.date-picker-preset').find((node) =>
      node.text().includes('Last 24 Hours')
    )
    expect(presetButton).toBeDefined()

    await presetButton!.trigger('click')
    await wrapper.find('.date-picker-apply').trigger('click')

    const nowAfterClick = new Date()
    const yesterdayAfterClick = new Date(nowAfterClick.getTime() - 24 * 60 * 60 * 1000)
    const expectedStart = formatLocalDate(yesterdayAfterClick)
    const expectedEnd = formatLocalDate(nowAfterClick)

    expect(wrapper.emitted('update:startDate')?.[0]).toEqual([expectedStart])
    expect(wrapper.emitted('update:endDate')?.[0]).toEqual([expectedEnd])
    expect(wrapper.emitted('change')?.[0]).toEqual([
      {
        startDate: expectedStart,
        endDate: expectedEnd,
        preset: 'last24Hours'
      }
    ])
  })
})

/* ------------------------------------------- keyboard & ARIA (fix_cmdk D) */

describe('DateRangePicker — keyboard & ARIA', () => {
  const now = new Date()
  const today = formatLocalDate(now)

  let mountedWrappers: ReturnType<typeof mount>[] = []

  afterEach(() => {
    for (const wrapper of mountedWrappers) wrapper.unmount()
    mountedWrappers = []
  })

  function mountPicker(attachToBody = false) {
    const wrapper = mount(DateRangePicker, {
      props: { startDate: today, endDate: today },
      global: { stubs: { Icon: true } },
      attachTo: attachToBody ? document.body : undefined,
    })
    mountedWrappers.push(wrapper)
    return wrapper
  }

  it('trigger exposes combobox ARIA (expanded/haspopup/controls)', async () => {
    const wrapper = mountPicker()
    const trigger = wrapper.find('.date-picker-trigger')

    expect(trigger.attributes('aria-expanded')).toBe('false')
    expect(trigger.attributes('aria-haspopup')).toBe('dialog')
    expect(trigger.attributes('aria-controls')).toBeUndefined()

    await trigger.trigger('click')
    expect(trigger.attributes('aria-expanded')).toBe('true')
    expect(trigger.attributes('aria-controls')).toBe('date-range-dropdown')

    const dropdown = wrapper.find('.date-picker-dropdown')
    expect(dropdown.attributes('id')).toBe('date-range-dropdown')
    expect(dropdown.attributes('role')).toBe('dialog')
    expect(dropdown.attributes('aria-modal')).toBe('false')
    expect(dropdown.attributes('aria-label')).toBe('Select date range')
  })

  it('presets expose aria-pressed and a single roving tabindex stop', async () => {
    const wrapper = mountPicker()
    await wrapper.find('.date-picker-trigger').trigger('click')

    const presets = wrapper.findAll('.date-picker-preset')
    expect(presets.length).toBeGreaterThan(0)
    const activeIndex = presets.findIndex((node) =>
      node.classes().includes('date-picker-preset-active'),
    )
    expect(activeIndex).toBeGreaterThanOrEqual(0)

    presets.forEach((preset, index) => {
      expect(preset.attributes('tabindex')).toBe(index === activeIndex ? '0' : '-1')
      expect(preset.attributes('aria-pressed')).toBe(index === activeIndex ? 'true' : 'false')
    })
  })

  it('ArrowDown on the closed trigger opens the popup', async () => {
    const wrapper = mountPicker()
    expect(wrapper.find('.date-picker-dropdown').exists()).toBe(false)

    await wrapper.find('.date-picker-trigger').trigger('keydown', { key: 'ArrowDown' })
    await nextTick()

    expect(wrapper.find('.date-picker-dropdown').exists()).toBe(true)
  })

  it('arrow keys navigate the 2-column preset grid (rows and edges)', async () => {
    const wrapper = mountPicker(true)
    const trigger = wrapper.find('.date-picker-trigger')
    await trigger.trigger('keydown', { key: 'ArrowDown' })
    await nextTick()

    const presets = wrapper.findAll('.date-picker-preset')
    // The roving start is the active preset (today/today props match the
    // "today" preset after the mount-time sync).
    const activeIndex = presets.findIndex((node) =>
      node.classes().includes('date-picker-preset-active'),
    )
    expect(activeIndex).toBeGreaterThanOrEqual(0)

    // Second ArrowDown moves focus from the trigger into the grid.
    await trigger.trigger('keydown', { key: 'ArrowDown' })
    await nextTick()
    expect(document.activeElement).toBe(presets[activeIndex].element)

    // ArrowDown: next row (index + 2 in the 2-column grid), clamped at the end.
    const down = Math.min(activeIndex + 2, presets.length - 1)
    await wrapper.find('.date-picker-presets').trigger('keydown', { key: 'ArrowDown' })
    await nextTick()
    expect(document.activeElement).toBe(presets[down].element)
    expect(presets[down].attributes('tabindex')).toBe('0')
    expect(presets[activeIndex].attributes('tabindex')).toBe('-1')

    // ArrowLeft moves one column back.
    await wrapper.find('.date-picker-presets').trigger('keydown', { key: 'ArrowLeft' })
    await nextTick()
    expect(document.activeElement).toBe(presets[down - 1].element)

    // ArrowUp goes back to the previous row.
    await wrapper.find('.date-picker-presets').trigger('keydown', { key: 'ArrowUp' })
    await nextTick()
    expect(document.activeElement).toBe(presets[Math.max(down - 3, 0)].element)

    // Home clamps to the first preset; ArrowLeft at the edge stays put.
    await wrapper.find('.date-picker-presets').trigger('keydown', { key: 'Home' })
    await nextTick()
    expect(document.activeElement).toBe(presets[0].element)
    await wrapper.find('.date-picker-presets').trigger('keydown', { key: 'ArrowLeft' })
    await nextTick()
    expect(document.activeElement).toBe(presets[0].element)

    // End jumps to the last preset.
    await wrapper.find('.date-picker-presets').trigger('keydown', { key: 'End' })
    await nextTick()
    expect(document.activeElement).toBe(presets[presets.length - 1].element)
  })

  it('Escape closes the popup and returns focus to the trigger', async () => {
    const wrapper = mountPicker(true)
    const trigger = wrapper.find('.date-picker-trigger')
    const triggerEl = trigger.element as HTMLButtonElement
    triggerEl.focus()

    await trigger.trigger('keydown', { key: 'ArrowDown' })
    await nextTick()
    const presets = wrapper.findAll('.date-picker-preset')
    const activeIndex = presets.findIndex((node) =>
      node.classes().includes('date-picker-preset-active'),
    )
    ;(presets[activeIndex].element as HTMLButtonElement).focus()
    await wrapper.find('.date-picker-presets').trigger('keydown', { key: 'ArrowDown' })
    await nextTick()
    expect(document.activeElement).not.toBe(triggerEl)

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))

    // The leave runs through Vue's <Transition>, which in jsdom resolves on a
    // rAF tick rather than a microtask — wait for the actual unmount.
    await vi.waitFor(() => {
      expect(wrapper.find('.date-picker-dropdown').exists()).toBe(false)
    })
    expect(document.activeElement).toBe(triggerEl)
  })
})
