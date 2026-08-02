import { describe, expect, it } from 'vitest'

import en from '../locales/en'
import zh from '../locales/zh'

/**
 * 图表卡片里「数据来源 / 统计指标」两组分段控件共处一张卡片，若都指向同一个 <h3>
 * 会得到相同的无障碍名称。这两个键是它们各自的视觉隐藏标签，viewSelector 则是
 * 「模型分布 ↔ 用户消费榜」面板切换 tablist 的名称。
 */
describe('chart picker accessible-name locale keys', () => {
  it('contains zh labels', () => {
    expect(zh.usage.chartDataSource).toBe('数据来源')
    expect(zh.usage.chartMetric).toBe('统计指标')
    expect(zh.admin.dashboard.viewSelector).toBe('视图')
  })

  it('contains en labels', () => {
    expect(en.usage.chartDataSource).toBe('Data source')
    expect(en.usage.chartMetric).toBe('Metric')
    expect(en.admin.dashboard.viewSelector).toBe('View')
  })

  it('keeps the two locales in sync for the namespaces these keys live in', () => {
    // 全量 zh/en 对比存在一处先于本次改动的历史差异
    // （en 的 admin.groups.claudeMaxSimulation 在 zh 里被嵌进了 modelRouting），
    // 因此这里只锁定本次新增键所在的命名空间必须完全一致。
    expect(Object.keys(en.usage).sort()).toEqual(Object.keys(zh.usage).sort())
    expect(Object.keys(en.admin.dashboard).sort()).toEqual(Object.keys(zh.admin.dashboard).sort())
  })
})
