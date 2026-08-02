import { describe, expect, it, vi } from 'vitest'
import { mount, type DOMWrapper } from '@vue/test-utils'

import EndpointDistributionChart from '../EndpointDistributionChart.vue'

const messages: Record<string, string> = {
  'usage.endpointDistribution': 'Endpoint Distribution',
  'usage.inbound': 'Inbound',
  'usage.upstream': 'Upstream',
  'usage.path': 'Path',
  'usage.chartDataSource': 'Data source',
  'usage.chartMetric': 'Metric',
  'admin.dashboard.metricTokens': 'By Tokens',
  'admin.dashboard.metricActualCost': 'By Actual Cost',
  'admin.dashboard.noDataAvailable': 'No data available',
  'admin.dashboard.endpoint': 'Endpoint',
  'admin.dashboard.requests': 'Requests',
  'admin.dashboard.tokens': 'Tokens',
  'admin.dashboard.actual': 'Actual',
  'admin.dashboard.standard': 'Standard',
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

const endpointStats = [
  {
    endpoint: '/v1/messages',
    requests: 10,
    total_tokens: 1000,
    cost: 1,
    actual_cost: 0.5,
  },
]

function mountChart(props: Record<string, unknown> = {}) {
  return mount(EndpointDistributionChart, {
    props: { endpointStats, ...props },
    global: { stubs: { LoadingSpinner: true } },
    attachTo: document.body,
  })
}

/** 解析 aria-labelledby（可能是多个 id）为拼接后的可访问名称。 */
function accessibleName(
  wrapper: ReturnType<typeof mountChart>,
  el: DOMWrapper<Element>,
): string {
  const ids = String(el.attributes('aria-labelledby') ?? '').split(/\s+/).filter(Boolean)
  expect(ids.length).toBeGreaterThan(0)
  return ids.map((id) => wrapper.get(`#${id}`).text()).join(' ')
}

/**
 * 数据源 / 指标两组分段控件都是「选值」而非切面板：应为 radiogroup，
 * 且两组的可访问名称必须能区分（此前都指向同一个 <h3>，名称完全相同）。
 */
describe('EndpointDistributionChart accessibility semantics', () => {
  it('names the source and metric radiogroups distinguishably', () => {
    const wrapper = mountChart({ showSourceToggle: true, showMetricToggle: true })

    const groups = wrapper.findAll('[role="radiogroup"]')
    expect(groups).toHaveLength(2)

    const sourceName = accessibleName(wrapper, groups[0])
    const metricName = accessibleName(wrapper, groups[1])

    expect(sourceName).not.toBe(metricName)
    expect(sourceName).toContain('Endpoint Distribution')
    expect(sourceName).toContain('Data source')
    expect(metricName).toContain('Endpoint Distribution')
    expect(metricName).toContain('Metric')

    wrapper.unmount()
  })

  it('uses radio semantics and never tab semantics', () => {
    const wrapper = mountChart({ showSourceToggle: true, showMetricToggle: true, source: 'inbound' })

    // 这张图表没有任何面板切换控件，因此不应出现 tablist。
    expect(wrapper.find('[role="tablist"]').exists()).toBe(false)
    expect(wrapper.find('[role="tab"]').exists()).toBe(false)

    const radios = wrapper.findAll('[role="radiogroup"] [role="radio"]')
    expect(radios).toHaveLength(5)
    expect(radios[0].attributes('aria-checked')).toBe('true')
    expect(radios[1].attributes('aria-checked')).toBe('false')
    expect(radios[0].attributes('aria-selected')).toBeUndefined()

    wrapper.unmount()
  })

  it('keeps the segmented styling classes on the radiogroups', () => {
    const wrapper = mountChart({ showSourceToggle: true, showMetricToggle: true, source: 'inbound' })

    const groups = wrapper.findAll('[role="radiogroup"]')
    expect(groups[0].classes()).toContain('tabs')
    expect(groups[1].classes()).toContain('tabs')

    const radios = wrapper.findAll('[role="radiogroup"] [role="radio"]')
    expect(radios[0].classes()).toContain('tab')
    expect(radios[0].classes()).toContain('tab-active')
    expect(radios[1].classes()).not.toContain('tab-active')

    wrapper.unmount()
  })

  it('emits update:source through the same handler for click and arrow keys', async () => {
    const wrapper = mountChart({ showSourceToggle: true, source: 'inbound' })
    const radios = wrapper.findAll('[role="radiogroup"] [role="radio"]')

    await radios[1].trigger('click')
    expect(wrapper.emitted('update:source')).toEqual([['upstream']])

    await radios[0].trigger('keydown', { key: 'ArrowRight' })
    expect(wrapper.emitted('update:source')).toEqual([['upstream'], ['upstream']])

    await radios[0].trigger('keydown', { key: 'ArrowLeft' })
    expect(wrapper.emitted('update:source')).toEqual([['upstream'], ['upstream'], ['path']])

    wrapper.unmount()
  })

  it('emits update:metric from the metric radiogroup', async () => {
    const wrapper = mountChart({ showMetricToggle: true, metric: 'tokens' })
    const radios = wrapper.findAll('[role="radiogroup"] [role="radio"]')

    await radios[1].trigger('click')
    expect(wrapper.emitted('update:metric')).toEqual([['actual_cost']])

    wrapper.unmount()
  })

  it('does not leave an orphan hidden label when a picker is hidden', () => {
    // 用户端 UsageView 传 show-source-toggle="false"：此时若仍渲染「数据来源」隐藏标签，
    // 读屏会念出一个没有对应控件的名称。
    const wrapper = mountChart({ showSourceToggle: false, showMetricToggle: true })

    expect(wrapper.findAll('[role="radiogroup"]')).toHaveLength(1)
    expect(wrapper.text()).not.toContain('Data source')
    expect(wrapper.text()).toContain('Metric')

    const onlyGroup = wrapper.get('[role="radiogroup"]')
    expect(accessibleName(wrapper, onlyGroup)).toContain('Metric')

    wrapper.unmount()
  })

  it('gives each instance distinct label ids within one app', () => {
    const Host = {
      components: { EndpointDistributionChart },
      template: `
        <div>
          <EndpointDistributionChart :endpoint-stats="stats" :show-source-toggle="true" :show-metric-toggle="true" />
          <EndpointDistributionChart :endpoint-stats="stats" :show-source-toggle="true" :show-metric-toggle="true" />
        </div>
      `,
      data: () => ({ stats: endpointStats }),
    }

    const wrapper = mount(Host, {
      global: { stubs: { LoadingSpinner: true } },
      attachTo: document.body,
    })

    const names = wrapper.findAll('[role="radiogroup"]').map((g) => g.attributes('aria-labelledby'))
    expect(names).toHaveLength(4)
    expect(new Set(names).size).toBe(4)

    wrapper.unmount()
  })
})
