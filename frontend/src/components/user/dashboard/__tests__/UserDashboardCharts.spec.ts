import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, ref } from 'vue'

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

/**
 * Host that binds `granularity` with `v-model`, the way DashboardView does.
 *
 * The picker is a controlled component: it renders the prop and never holds its
 * own copy. `mountCharts` pins the prop, so any interaction that would move the
 * selection leaves the rendered state where it was — fine for a single step, but
 * it cannot express a round trip (pick B, then pick A again). This host lets the
 * value actually change, which is the only way to test traversal the way a user
 * experiences it.
 */
const GranularityHost = defineComponent({
  components: { UserDashboardCharts },
  setup() {
    const granularity = ref('day')
    const changes = ref(0)
    return { granularity, changes }
  },
  template: `
    <UserDashboardCharts
      v-model:granularity="granularity"
      :loading="false"
      start-date="2026-05-01"
      end-date="2026-05-08"
      :trend="[]"
      :models="[]"
      @granularityChange="changes += 1"
    />
  `,
})

function mountHost() {
  return mount(GranularityHost, {
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

  it('does not re-emit on a redundant click of the already-selected option', async () => {
    const wrapper = mountCharts('day')

    await granularityRadios(wrapper)[0].trigger('click')

    // Picking the value that is already selected is not a change, and
    // `granularityChange` re-runs `loadCharts()` in DashboardView — so emitting
    // here would cost a duplicate request per redundant tap. This reverses the
    // pre-Segmented behaviour, which fired unconditionally from the click
    // handler; see Segmented.spec.ts 'does not emit when the already-selected
    // segment is chosen again'.
    expect(wrapper.emitted('update:granularity')).toBeUndefined()
    expect(wrapper.emitted('granularityChange')).toBeUndefined()

    wrapper.unmount()
  })

  it('arrow keys select through the same path as a click, in both directions', async () => {
    const wrapper = mountHost()
    const charts = wrapper.getComponent(UserDashboardCharts)
    const radios = wrapper.findAll('[role="radiogroup"] [role="radio"]')

    await radios[0].trigger('keydown', { key: 'ArrowRight' })
    expect(charts.emitted('update:granularity')).toEqual([['hour']])
    expect(charts.emitted('granularityChange')).toEqual([[]])
    // v-model round trip: the host owns the value, so the DOM follows.
    expect(radios[1].attributes('aria-checked')).toBe('true')

    await radios[1].trigger('keydown', { key: 'ArrowLeft' })
    expect(charts.emitted('update:granularity')).toEqual([['hour'], ['day']])
    expect(charts.emitted('granularityChange')).toEqual([[], []])
    expect(radios[0].attributes('aria-checked')).toBe('true')

    wrapper.unmount()
  })

  it('supports Up/Down as well as Left/Right and wraps around', async () => {
    const wrapper = mountHost()
    const charts = wrapper.getComponent(UserDashboardCharts)
    const radios = wrapper.findAll('[role="radiogroup"] [role="radio"]')

    await radios[0].trigger('keydown', { key: 'ArrowDown' })
    expect(charts.emitted('update:granularity')).toEqual([['hour']])

    // Wrap: with two options, moving past either end lands on the other one.
    await radios[1].trigger('keydown', { key: 'ArrowUp' })
    expect(charts.emitted('update:granularity')).toEqual([['hour'], ['day']])

    wrapper.unmount()
  })
})
