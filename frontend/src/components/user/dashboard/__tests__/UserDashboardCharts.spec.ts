import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'

import UserDashboardCharts from '../UserDashboardCharts.vue'

const messages: Record<string, string> = {
  'dashboard.timeRange': 'Time Range',
  'dashboard.granularity': 'Granularity',
  'dashboard.day': 'Day',
  'dashboard.hour': 'Hour',
  'dashboard.modelDistribution': 'Model Distribution',
  'dashboard.noDataAvailable': 'No data available',
}

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return {
    ...actual,
    useI18n: () => ({
      t: (key: string) => messages[key] ?? key,
    }),
  }
})

vi.mock('vue-chartjs', () => ({
  Doughnut: {
    props: ['data', 'options'],
    template: '<div class="chart-data">{{ JSON.stringify(data) }}</div>',
  },
}))

function mountCharts(granularity = 'day') {
  return mount(UserDashboardCharts, {
    props: {
      loading: false,
      startDate: '2026-05-01',
      endDate: '2026-05-08',
      granularity,
      trend: [],
      models: [],
    },
    global: {
      stubs: {
        LoadingSpinner: true,
        DateRangePicker: true,
        TokenUsageTrend: true,
      },
    },
    attachTo: document.body,
  })
}

function granularityRadios(wrapper: ReturnType<typeof mountCharts>) {
  return wrapper.findAll('[role="radiogroup"] [role="radio"]')
}

describe('UserDashboardCharts granularity picker', () => {
  it('exposes the granularity segmented control as a named radiogroup', () => {
    const wrapper = mountCharts('day')

    const group = wrapper.get('[role="radiogroup"]')
    // Not a tablist: it selects a value and controls no tab panel.
    expect(wrapper.find('[role="tablist"]').exists()).toBe(false)

    const labelId = group.attributes('aria-labelledby')
    expect(labelId).toBeTruthy()
    expect(wrapper.get(`#${labelId}`).text()).toContain('Granularity')

    const radios = granularityRadios(wrapper)
    expect(radios).toHaveLength(2)
    expect(radios[0].attributes('aria-checked')).toBe('true')
    expect(radios[1].attributes('aria-checked')).toBe('false')
    expect(radios[0].attributes('aria-selected')).toBeUndefined()

    wrapper.unmount()
  })

  it('emits update:granularity before granularityChange on click', async () => {
    const wrapper = mountCharts('day')

    await granularityRadios(wrapper)[1].trigger('click')

    expect(wrapper.emitted('update:granularity')).toEqual([['hour']])
    expect(wrapper.emitted('granularityChange')).toEqual([[]])
    // Emit order is part of the contract: update first, then change.
    const order = Object.keys(wrapper.emitted())
    expect(order.indexOf('update:granularity')).toBeLessThan(order.indexOf('granularityChange'))

    wrapper.unmount()
  })

  it('re-emits on a redundant click of the already-selected option', async () => {
    const wrapper = mountCharts('day')

    await granularityRadios(wrapper)[0].trigger('click')

    expect(wrapper.emitted('update:granularity')).toEqual([['day']])
    expect(wrapper.emitted('granularityChange')).toEqual([[]])

    wrapper.unmount()
  })

  it('arrow keys select through the same handler as a click', async () => {
    const wrapper = mountCharts('day')
    const radios = granularityRadios(wrapper)

    await radios[0].trigger('keydown', { key: 'ArrowRight' })
    expect(wrapper.emitted('update:granularity')).toEqual([['hour']])
    expect(wrapper.emitted('granularityChange')).toEqual([[]])

    await radios[1].trigger('keydown', { key: 'ArrowLeft' })
    expect(wrapper.emitted('update:granularity')).toEqual([['hour'], ['day']])
    expect(wrapper.emitted('granularityChange')).toEqual([[], []])

    wrapper.unmount()
  })

  it('supports Up/Down as well as Left/Right and wraps around', async () => {
    const wrapper = mountCharts('day')
    const radios = granularityRadios(wrapper)

    await radios[0].trigger('keydown', { key: 'ArrowDown' })
    expect(wrapper.emitted('update:granularity')).toEqual([['hour']])

    // Wrap: moving back past the first option lands on the last.
    await radios[0].trigger('keydown', { key: 'ArrowUp' })
    expect(wrapper.emitted('update:granularity')).toEqual([['hour'], ['hour']])

    wrapper.unmount()
  })

  it('keeps the segmented styling classes untouched', () => {
    const wrapper = mountCharts('day')

    expect(wrapper.get('[role="radiogroup"]').classes()).toContain('tabs')
    const radios = granularityRadios(wrapper)
    expect(radios[0].classes()).toContain('tab')
    expect(radios[0].classes()).toContain('tab-active')
    expect(radios[1].classes()).not.toContain('tab-active')

    wrapper.unmount()
  })
})
