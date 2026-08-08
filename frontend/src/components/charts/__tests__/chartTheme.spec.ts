import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'

import { setTheme } from '@/composables/useTheme'
import { useChartTheme, withAlpha } from '../chartTheme'
import GroupDistributionChart from '../GroupDistributionChart.vue'

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return {
    ...actual,
    useI18n: () => ({
      t: (key: string) => key,
    }),
  }
})

vi.mock('vue-chartjs', () => ({
  Doughnut: {
    props: ['data', 'options'],
    template: '<div class="chart-data">{{ JSON.stringify(data) }}</div>',
  },
}))

afterEach(() => {
  // 恢复亮色，避免污染同文件后续用例（模块级共享状态）
  setTheme('light')
})

describe('chartTheme', () => {
  it('withAlpha 生成 #rrggbbaa', () => {
    expect(withAlpha('#0071e3', 0.14)).toBe('#0071e324') // 0.14 * 255 ≈ 36 = 0x24
    expect(withAlpha('#0071e3', 0)).toBe('#0071e300')
    expect(withAlpha('#fff', 1)).toBe('#ffffff' + 'ff')
  })

  it('useChartTheme 跟随 setTheme 切换亮/暗（轴色、分类色板、工具提示）', () => {
    const theme = useChartTheme()
    expect(theme.value.isDark).toBe(false)
    expect(theme.value.categorical[0]).toBe('#0071e3')
    expect(theme.value.axisText).toBe('#6e6e73')
    expect(theme.value.tooltip.backgroundColor).toBe('#ffffff')

    setTheme('dark')
    expect(theme.value.isDark).toBe(true)
    expect(theme.value.categorical[0]).toBe('#0a84ff')
    expect(theme.value.axisText).toBe('#aeaeb2')
    expect(theme.value.tooltip.backgroundColor).toBe('#1c1c1e')
  })

  it('切主题后环形图数据集的扇区色随之更新（vue-chartjs 收到新 data 即重绘）', async () => {
    const wrapper = mount(GroupDistributionChart, {
      props: {
        groupStats: [
          { group_id: 1, group_name: 'a', requests: 5, total_tokens: 100, cost: 1, actual_cost: 0.5 },
          { group_id: 2, group_name: 'b', requests: 3, total_tokens: 50, cost: 0.5, actual_cost: 0.2 },
        ],
      },
      global: {
        stubs: { LoadingSpinner: true },
      },
    })

    const readColors = () => {
      const chartData = JSON.parse(wrapper.find('.chart-data').text())
      return chartData.datasets[0].backgroundColor
    }

    expect(readColors()).toEqual(['#0071e3', '#34c759'])

    setTheme('dark')
    await wrapper.vm.$nextTick()
    expect(readColors()).toEqual(['#0a84ff', '#30d158'])
    expect(JSON.parse(wrapper.find('.chart-data').text()).datasets[0].borderColor).toBe('#1c1c1e')
  })
})
