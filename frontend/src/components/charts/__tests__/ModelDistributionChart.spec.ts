import { describe, expect, it, vi } from 'vitest'
import { mount, type DOMWrapper } from '@vue/test-utils'

import ModelDistributionChart from '../ModelDistributionChart.vue'

const messages: Record<string, string> = {
  'admin.dashboard.modelDistribution': 'Model Distribution',
  'admin.dashboard.spendingRankingTitle': 'User Spending Ranking',
  'admin.dashboard.viewModelDistribution': 'Model Distribution',
  'admin.dashboard.viewSpendingRanking': 'User Spending Ranking',
  'admin.dashboard.spendingRankingUser': 'User',
  'admin.dashboard.spendingRankingRequests': 'Requests',
  'admin.dashboard.spendingRankingTokens': 'Tokens',
  'admin.dashboard.spendingRankingSpend': 'Spend',
  'admin.dashboard.spendingRankingOther': 'Others',
  'admin.dashboard.model': 'Model',
  'admin.dashboard.requests': 'Requests',
  'admin.dashboard.tokens': 'Tokens',
  'admin.dashboard.actual': 'Actual',
  'admin.dashboard.accountCost': 'Account Cost',
  'admin.dashboard.standard': 'Standard',
  'admin.dashboard.metricTokens': 'By Tokens',
  'admin.dashboard.metricActualCost': 'By Actual Cost',
  'admin.dashboard.noDataAvailable': 'No data available',
  'admin.redeem.userPrefix': 'User #{id}',
  'admin.dashboard.viewSelector': 'View',
  'usage.requestedModel': 'Requested',
  'usage.upstreamModel': 'Upstream',
  'usage.mapping': 'Mapping',
  'usage.chartDataSource': 'Data source',
  'usage.chartMetric': 'Metric',
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
    props: ['data'],
    template: '<div class="chart-data">{{ JSON.stringify(data) }}</div>',
  },
}))

describe('ModelDistributionChart', () => {
  const modelStats = [
    {
      model: 'model-a',
      requests: 8,
      input_tokens: 100,
      output_tokens: 50,
      cache_creation_tokens: 0,
      cache_read_tokens: 0,
      total_tokens: 1000,
      cost: 1.5,
      actual_cost: 0.2,
    },
    {
      model: 'model-b',
      requests: 3,
      input_tokens: 40,
      output_tokens: 20,
      cache_creation_tokens: 0,
      cache_read_tokens: 0,
      total_tokens: 500,
      cost: 0.5,
      actual_cost: 1.4,
    },
  ]

  it('uses total_tokens and token ordering by default', () => {
    const wrapper = mount(ModelDistributionChart, {
      props: {
        modelStats,
      },
      global: {
        stubs: {
          LoadingSpinner: true,
        },
      },
    })

    const chartData = JSON.parse(wrapper.find('.chart-data').text())
    expect(chartData.labels).toEqual(['model-a', 'model-b'])
    expect(chartData.datasets[0].data).toEqual([1000, 500])

    const rows = wrapper.findAll('tbody tr')
    expect(rows[0].text()).toContain('model-a')
    expect(rows[1].text()).toContain('model-b')

    const options = (wrapper.vm as any).$?.setupState.doughnutOptions
    const label = options.plugins.tooltip.callbacks.label({
      label: 'model-a',
      raw: 1000,
      dataset: { data: [1000, 500] },
    })
    expect(label).toBe('model-a: 1.00K (66.7%)')
  })

  it('uses actual_cost and reorders rows in actual cost mode', () => {
    const wrapper = mount(ModelDistributionChart, {
      props: {
        modelStats,
        metric: 'actual_cost',
      },
      global: {
        stubs: {
          LoadingSpinner: true,
        },
      },
    })

    const chartData = JSON.parse(wrapper.find('.chart-data').text())
    expect(chartData.labels).toEqual(['model-b', 'model-a'])
    expect(chartData.datasets[0].data).toEqual([1.4, 0.2])

    const rows = wrapper.findAll('tbody tr')
    expect(rows[0].text()).toContain('model-b')
    expect(rows[1].text()).toContain('model-a')

    const options = (wrapper.vm as any).$?.setupState.doughnutOptions
    const label = options.plugins.tooltip.callbacks.label({
      label: 'model-b',
      raw: 1.4,
      dataset: { data: [1.4, 0.2] },
    })
    expect(label).toBe('model-b: $1.40 (87.5%)')
  })

  it('can hide account cost for user usage stats without account_cost', () => {
    const wrapper = mount(ModelDistributionChart, {
      props: {
        modelStats,
        showAccountCost: false,
      },
      global: {
        stubs: {
          LoadingSpinner: true,
        },
      },
    })

    expect(wrapper.text()).not.toContain('Account Cost')
    expect(wrapper.findAll('thead th')).toHaveLength(5)
    expect(wrapper.findAll('tbody tr')[0].findAll('td')).toHaveLength(5)
  })

  it('renders Others in the spending ranking table and uses a dedicated chart color', async () => {
    const wrapper = mount(ModelDistributionChart, {
      props: {
        modelStats: [],
        enableRankingView: true,
        rankingItems: [
          { user_id: 1, email: 'alpha@example.com', actual_cost: 12, requests: 10, tokens: 1000 },
          { user_id: 2, email: 'beta@example.com', actual_cost: 8, requests: 6, tokens: 600 },
        ],
        rankingTotalActualCost: 30,
        rankingTotalRequests: 20,
        rankingTotalTokens: 2000,
      },
      global: {
        stubs: {
          LoadingSpinner: true,
        },
      },
    })

    const rankingButton = wrapper.findAll('button').find((button) => button.text() === 'User Spending Ranking')
    expect(rankingButton).toBeTruthy()
    await rankingButton!.trigger('click')

    const chartData = JSON.parse(wrapper.find('.chart-data').text())
    expect(chartData.labels).toEqual([
      '#1 alpha@example.com',
      '#2 beta@example.com',
      'Others',
    ])
    expect(chartData.datasets[0].data).toEqual([12, 8, 10])
    // Apple 系统色，浅色档（jsdom 下 <html> 无 .dark）：首个类目取 --sys-blue，
    // 「其他」取中性灰，与真实类目区分。
    expect(chartData.datasets[0].backgroundColor[0]).toBe('#007aff')
    expect(chartData.datasets[0].backgroundColor[2]).toBe('#8e8e93')
    expect(chartData.datasets[0].backgroundColor[2]).not.toBe(chartData.datasets[0].backgroundColor[0])

    const rows = wrapper.findAll('tbody tr')
    expect(rows).toHaveLength(3)
    expect(rows[2].text()).toContain('Others')
    expect(rows[2].text()).toContain('4')
    expect(rows[2].text()).toContain('400')
    expect(rows[2].text()).toContain('$10.00')
  })
})

/**
 * 无障碍语义：
 * - 数据源 / 指标是「选值」控件 → radiogroup，且两组名称必须可区分；
 * - activeView 是真正的面板切换 → 保留 tablist，并补齐 name 与 tab ↔ tabpanel 关联。
 */
describe('ModelDistributionChart accessibility semantics', () => {
  const modelStats = [
    {
      model: 'model-a',
      requests: 8,
      input_tokens: 100,
      output_tokens: 50,
      cache_creation_tokens: 0,
      cache_read_tokens: 0,
      total_tokens: 1000,
      cost: 1.5,
      actual_cost: 0.2,
    },
  ]

  function mountChart(props: Record<string, unknown> = {}) {
    return mount(ModelDistributionChart, {
      props: { modelStats, ...props },
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

  it('names the source and metric radiogroups distinguishably', () => {
    const wrapper = mountChart({ showSourceToggle: true, showMetricToggle: true })

    const groups = wrapper.findAll('[role="radiogroup"]')
    expect(groups).toHaveLength(2)

    const sourceName = accessibleName(wrapper, groups[0])
    const metricName = accessibleName(wrapper, groups[1])

    // 回归点：此前两组都指向同一个 <h3>，名称完全相同，读屏用户无法区分。
    expect(sourceName).not.toBe(metricName)
    expect(sourceName).toContain('Model Distribution')
    expect(sourceName).toContain('Data source')
    expect(metricName).toContain('Model Distribution')
    expect(metricName).toContain('Metric')

    wrapper.unmount()
  })

  it('uses radio semantics, not tab semantics, for the value pickers', () => {
    const wrapper = mountChart({ showSourceToggle: true, showMetricToggle: true, source: 'requested' })

    const radios = wrapper.findAll('[role="radiogroup"] [role="radio"]')
    expect(radios).toHaveLength(5)
    expect(radios[0].attributes('aria-checked')).toBe('true')
    expect(radios[1].attributes('aria-checked')).toBe('false')
    expect(radios[0].attributes('aria-selected')).toBeUndefined()
    expect(radios[0].attributes('role')).toBe('radio')

    wrapper.unmount()
  })

  it('keeps the segmented styling classes on the radiogroups', () => {
    const wrapper = mountChart({ showSourceToggle: true, showMetricToggle: true, source: 'requested' })

    const groups = wrapper.findAll('[role="radiogroup"]')
    expect(groups[0].classes()).toContain('tabs')
    expect(groups[1].classes()).toContain('tabs')

    const radios = wrapper.findAll('[role="radiogroup"] [role="radio"]')
    expect(radios[0].classes()).toContain('tab')
    expect(radios[0].classes()).toContain('tab-active')
    expect(radios[1].classes()).not.toContain('tab-active')

    wrapper.unmount()
  })

  it('arrow keys emit through the same handler as a click', async () => {
    const wrapper = mountChart({ showSourceToggle: true, source: 'requested' })
    const radios = wrapper.findAll('[role="radiogroup"] [role="radio"]')

    await radios[0].trigger('keydown', { key: 'ArrowRight' })
    expect(wrapper.emitted('update:source')).toEqual([['upstream']])

    await radios[0].trigger('keydown', { key: 'ArrowLeft' })
    expect(wrapper.emitted('update:source')).toEqual([['upstream'], ['mapping']])

    wrapper.unmount()
  })

  it('completes the activeView tablist with a name and tab/tabpanel wiring', async () => {
    const wrapper = mountChart({ enableRankingView: true })

    const tablist = wrapper.get('[role="tablist"]')
    expect(accessibleName(wrapper, tablist)).toContain('View')

    const tabs = wrapper.findAll('[role="tab"]')
    expect(tabs).toHaveLength(2)
    expect(tabs[0].attributes('aria-selected')).toBe('true')

    const panel = wrapper.get('[role="tabpanel"]')
    // 选中的 tab 通过 aria-controls 指向面板，面板再通过 aria-labelledby 指回该 tab。
    expect(tabs[0].attributes('aria-controls')).toBe(panel.attributes('id'))
    expect(panel.attributes('aria-labelledby')).toBe(tabs[0].attributes('id'))
    // 未选中的 tab 不指向未渲染的面板，避免 aria-controls 悬空。
    expect(tabs[1].attributes('aria-controls')).toBeUndefined()

    await tabs[1].trigger('click')

    const rankingPanel = wrapper.get('[role="tabpanel"]')
    expect(wrapper.findAll('[role="tab"]')[1].attributes('aria-controls')).toBe(rankingPanel.attributes('id'))
    expect(rankingPanel.attributes('aria-labelledby')).toBe(tabs[1].attributes('id'))
    expect(rankingPanel.attributes('id')).not.toBe(panel.attributes('id'))

    wrapper.unmount()
  })

  it('omits tab/tabpanel semantics entirely when the ranking view is disabled', () => {
    const wrapper = mountChart({ showMetricToggle: true })

    expect(wrapper.find('[role="tablist"]').exists()).toBe(false)
    expect(wrapper.find('[role="tab"]').exists()).toBe(false)
    // 没有 tablist 时不能留下 tabpanel，否则 aria-labelledby 指向不存在的 tab。
    expect(wrapper.find('[role="tabpanel"]').exists()).toBe(false)

    wrapper.unmount()
  })

  it('generates unique ids so two charts in one app do not collide', () => {
    // 管理端 UsageView / AccountStatsModal 会在同一个 app 内渲染多份图表，
    // 因此 id 必须来自 useId() 而不是硬编码。useId() 按 app 实例计数，
    // 所以这里必须把两份图表挂在同一个父组件里才测得到真实场景。
    const Host = {
      components: { ModelDistributionChart },
      template: `
        <div>
          <ModelDistributionChart :model-stats="stats" :show-metric-toggle="true" :enable-ranking-view="true" />
          <ModelDistributionChart :model-stats="stats" :show-metric-toggle="true" :enable-ranking-view="true" />
        </div>
      `,
      data: () => ({ stats: modelStats }),
    }

    const wrapper = mount(Host, {
      global: { stubs: { LoadingSpinner: true } },
      attachTo: document.body,
    })

    const panelIds = wrapper.findAll('[role="tabpanel"]').map((p) => p.attributes('id'))
    expect(panelIds).toHaveLength(2)
    expect(panelIds[0]).toBeTruthy()
    expect(new Set(panelIds).size).toBe(2)

    const groupNames = wrapper
      .findAll('[role="radiogroup"]')
      .map((g) => g.attributes('aria-labelledby'))
    expect(groupNames).toHaveLength(2)
    expect(new Set(groupNames).size).toBe(2)

    const tabIds = wrapper.findAll('[role="tab"]').map((tabEl) => tabEl.attributes('id'))
    expect(new Set(tabIds).size).toBe(tabIds.length)

    wrapper.unmount()
  })
})
