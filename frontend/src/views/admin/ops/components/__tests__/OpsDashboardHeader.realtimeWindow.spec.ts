/**
 * Characterization spec for the realtime-window radiogroup
 * (OpsDashboardHeader ~1131), written BEFORE it was migrated onto the shared
 * `Segmented` component and required to pass identically after.
 *
 * This control had no coverage, and its observable effect is a network call:
 * picking a window re-queries `getRealtimeTrafficSummary` with that window. So
 * the assertion surface is the API argument, not a class name — and it is also
 * how a double-activation would show up, since `Segmented` listens on both
 * pointerdown and click while the suite only dispatches click.
 *
 * It was already wired to `handleRadioGroupKeydown` (~1141), so the arrow-key
 * traversal is part of the contract that has to survive: after migration the
 * component owns that behaviour internally rather than through the shared util.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

const { getRealtimeTrafficSummary } = vi.hoisted(() => ({
  getRealtimeTrafficSummary: vi.fn(),
}))

vi.mock('@/api/admin/ops', () => ({
  opsAPI: {
    getRealtimeTrafficSummary,
    getDashboardOverview: vi.fn(),
  },
}))

vi.mock('@/api', () => ({
  adminAPI: {
    groups: { getAll: vi.fn().mockResolvedValue([]) },
  },
}))

vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>()
  return {
    ...actual,
    useI18n: () => ({ t: (key: string) => key }),
  }
})

import OpsDashboardHeader from '../OpsDashboardHeader.vue'

/** Minimal overview: the realtime panel lives inside `v-if="overview"`. */
function overviewFixture() {
  return {
    start_time: '2026-01-01T00:00:00Z',
    end_time: '2026-01-01T01:00:00Z',
    platform: 'all',
    group_id: null,
    health_score: 99,
    system_metrics: null,
    job_heartbeats: null,
    success_count: 10,
    error_count_total: 0,
    business_limited_count: 0,
    error_count_sla: 0,
    request_count_total: 10,
    request_count_sla: 10,
    token_consumed: 100,
    sla: 100,
    error_rate: 0,
    upstream_error_rate: 0,
    upstream_error_count_excl_429_529: 0,
    upstream_429_count: 0,
    upstream_529_count: 0,
    qps: { current: 1, peak: 2, avg: 1 },
    tps: { current: 1, peak: 2, avg: 1 },
    duration: {},
    ttft: {},
  }
}

function mountHeader() {
  return mount(OpsDashboardHeader, {
    props: {
      overview: overviewFixture(),
      platform: 'all',
      groupId: null,
      // '1h' keeps all four windows available: availableRealtimeWindows filters
      // to those no longer than the toolbar range.
      timeRange: '1h',
      queryMode: 'realtime',
      loading: false,
      lastUpdated: null,
    },
    global: {
      stubs: {
        Select: true,
        HelpTooltip: true,
        BaseDialog: true,
        Icon: true,
      },
    },
    attachTo: document.body,
  })
}

function windowRadios(wrapper: ReturnType<typeof mountHeader>) {
  const group = wrapper
    .findAll('[role="radiogroup"]')
    .find((candidate) => candidate.findAll('[role="radio"]').length === 4)
  expect(group).toBeDefined()
  return group!.findAll('[role="radio"]')
}

/** Window argument of the most recent realtime-summary request. */
function lastRequestedWindow(): unknown {
  return getRealtimeTrafficSummary.mock.calls.at(-1)?.[0]
}

describe('OpsDashboardHeader realtime window picker', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    getRealtimeTrafficSummary.mockReset().mockResolvedValue({ enabled: true, summary: null })
  })

  it('exposes the four windows as a named radiogroup with 1min checked', async () => {
    const wrapper = mountHeader()
    await flushPromises()

    const radios = windowRadios(wrapper)
    expect(radios.map((radio) => radio.text())).toEqual(['1min', '5min', '30min', '1h'])
    expect(radios[0].attributes('aria-checked')).toBe('true')
    expect(radios.slice(1).every((radio) => radio.attributes('aria-checked') === 'false')).toBe(true)
    // Value picking, not panel switching: aria-selected here would be a lie.
    expect(radios.every((radio) => radio.attributes('aria-selected') === undefined)).toBe(true)

    // The accessible name comes from the visible "Realtime" heading.
    const group = wrapper
      .findAll('[role="radiogroup"]')
      .find((candidate) => candidate.findAll('[role="radio"]').length === 4)!
    const labelId = group.attributes('aria-labelledby')
    expect(labelId).toBeTruthy()
    expect(wrapper.get(`#${labelId}`).text()).toContain('admin.ops.realtime.title')

    wrapper.unmount()
  })

  it('re-queries the realtime summary with the picked window on a single click', async () => {
    const wrapper = mountHeader()
    await flushPromises()
    expect(lastRequestedWindow()).toBe('1min')

    const callsBefore = getRealtimeTrafficSummary.mock.calls.length
    await windowRadios(wrapper)[2].trigger('click')
    await flushPromises()

    expect(lastRequestedWindow()).toBe('30min')
    expect(windowRadios(wrapper)[2].attributes('aria-checked')).toBe('true')
    expect(windowRadios(wrapper)[0].attributes('aria-checked')).toBe('false')
    // Exactly one extra request: a control that fired on pointerdown AND click
    // would double every interaction.
    expect(getRealtimeTrafficSummary.mock.calls.length).toBe(callsBefore + 1)

    wrapper.unmount()
  })

  it('arrow keys move the selection and re-query, wrapping at the ends', async () => {
    const wrapper = mountHeader()
    await flushPromises()

    await windowRadios(wrapper)[0].trigger('keydown', { key: 'ArrowRight' })
    await flushPromises()
    expect(lastRequestedWindow()).toBe('5min')
    expect(windowRadios(wrapper)[1].attributes('aria-checked')).toBe('true')

    await windowRadios(wrapper)[1].trigger('keydown', { key: 'ArrowLeft' })
    await flushPromises()
    expect(lastRequestedWindow()).toBe('1min')

    // Wrapping backwards off the first segment lands on the last.
    await windowRadios(wrapper)[0].trigger('keydown', { key: 'ArrowLeft' })
    await flushPromises()
    expect(lastRequestedWindow()).toBe('1h')
    expect(windowRadios(wrapper)[3].attributes('aria-checked')).toBe('true')

    wrapper.unmount()
  })

  it('re-picking the current window issues no further request', async () => {
    const wrapper = mountHeader()
    await flushPromises()

    const callsBefore = getRealtimeTrafficSummary.mock.calls.length
    await windowRadios(wrapper)[0].trigger('click')
    await flushPromises()

    expect(getRealtimeTrafficSummary.mock.calls.length).toBe(callsBefore)
    expect(windowRadios(wrapper)[0].attributes('aria-checked')).toBe('true')

    wrapper.unmount()
  })

  it('drops windows longer than the toolbar range', async () => {
    const wrapper = mountHeader()
    await flushPromises()

    await wrapper.setProps({ timeRange: '5m' })
    await flushPromises()

    const group = wrapper
      .findAll('[role="radiogroup"]')
      .find((candidate) => candidate.findAll('[role="radio"]').some((r) => r.text() === '1min'))!
    expect(group.findAll('[role="radio"]').map((radio) => radio.text())).toEqual(['1min', '5min'])

    wrapper.unmount()
  })
})
