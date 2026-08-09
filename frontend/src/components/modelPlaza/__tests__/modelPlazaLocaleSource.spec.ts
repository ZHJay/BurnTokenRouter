import { describe, expect, it } from 'vitest'
import zh from '@/i18n/locales/zh'
import en from '@/i18n/locales/en'
import zhDashboard from '@/i18n/locales/zh/dashboard'
import enDashboard from '@/i18n/locales/en/dashboard'
import zhModelPlaza from '@/i18n/locales/zh/modelPlaza'
import enModelPlaza from '@/i18n/locales/en/modelPlaza'

/**
 * `modelPlaza` 文案的**单一来源**契约。
 *
 * 历史：该子树曾同时存在于 `dashboard.ts` 与 `modelPlaza.ts`，靠 locale index
 * 的展开顺序 + 手工 re-spread 维持正确。子树已整体迁入 `modelPlaza.ts`，
 * 本 spec 因此从「守护脆弱合并」转为「确认唯一来源 + key 齐全 + zh/en 对齐」。
 *
 * 三件事值得继续钉住：
 * 1. `dashboard.ts` 不得再定义 `modelPlaza` —— 一旦有人加回去，浅层展开的
 *    静默覆盖会立刻复现（`i18n/__tests__/localesNoKeyCollision.spec.ts` 的
 *    roots 表也会同时报错，两处互为备份）
 * 2. 装配后 key 齐全 —— 定价表与筛选器的行为契约依赖这些 key，缺一个就是裸 key 上屏
 * 3. zh/en 键集合逐层一致 —— 少一边就是另一种语言掉字
 */

type Dict = Record<string, unknown>

function plazaOf(locale: Dict): Dict {
  return locale.modelPlaza as Dict
}

const locales: Record<string, Dict> = { zh, en }

describe('modelPlaza 文案单一来源', () => {
  it('dashboard.ts 不再定义 modelPlaza(迁移不可回退)', () => {
    expect((zhDashboard as Dict).modelPlaza).toBeUndefined()
    expect((enDashboard as Dict).modelPlaza).toBeUndefined()
  })

  it('modelPlaza.ts 是唯一来源,且无需依赖 index 展开顺序', () => {
    // 装配结果与模块自身导出的子树必须完全一致：若还有第二个来源在覆盖它，
    // 这里就会出现差异。
    expect(plazaOf(zh)).toEqual(zhModelPlaza.modelPlaza)
    expect(plazaOf(en)).toEqual(enModelPlaza.modelPlaza)
  })
})

describe.each(Object.keys(locales))('%s modelPlaza key 齐全', (name) => {
  const plaza = plazaOf(locales[name])

  it('定价表/筛选器依赖的既有 key 全在', () => {
    const table = plaza.table as Dict
    expect(table).toBeDefined()
    for (const key of [
      'model', 'input', 'output', 'cache', 'cacheWrite', 'cacheRead',
      'paidPrice', 'officialPrice', 'rate', 'unitPerMillion',
      'perUnitImage', 'perUnitRequest', 'perImage', 'perRequest'
    ]) {
      expect(table[key], `modelPlaza.table.${key} 丢失`).toBeTruthy()
    }

    const filters = plaza.filters as Dict
    for (const key of [
      'platformLabel', 'groupLabel', 'rateLabel',
      'searchPlaceholder', 'all'
    ]) {
      expect(filters[key], `modelPlaza.filters.${key} 丢失`).toBeTruthy()
    }

    expect(plaza.title).toBeTruthy()
    expect(plaza.description).toBeTruthy()
    expect(plaza.empty).toBeTruthy()
    expect(plaza.loadFailed).toBeTruthy()
    expect(plaza.noSearchResult).toBeTruthy()
    expect(plaza.anonymousHint).toBeTruthy()
    expect((plaza.detail as Dict).noModels).toBeTruthy()
    expect((plaza.detail as Dict).peakNote).toBeTruthy()
    expect((plaza.nav as Dict).login).toBeTruthy()
    expect((plaza.nav as Dict).backToDashboard).toBeTruthy()
    expect((plaza.badges as Dict).exclusive).toBeTruthy()
    expect((plaza.badges as Dict).subscription).toBeTruthy()
  })

  it('卡片化新增 key 全在', () => {
    const view = plaza.view as Dict
    expect(view.label).toBeTruthy()
    expect(view.cards).toBeTruthy()
    expect(view.table).toBeTruthy()

    const cards = plaza.cards as Dict
    expect(cards.tiered).toBeTruthy()
    expect(cards.cache).toBeTruthy()
    expect(cards.unitPrice).toBeTruthy()

    expect((plaza.filters as Dict).clearSearch).toBeTruthy()
  })
})

describe('modelPlaza 的 zh/en 对齐', () => {
  it('每一层键集合完全一致(任一语言掉字都会红)', () => {
    const z = plazaOf(zh)
    const e = plazaOf(en)

    expect(Object.keys(z).sort()).toEqual(Object.keys(e).sort())
    for (const sub of ['filters', 'badges', 'detail', 'table', 'nav', 'view', 'cards']) {
      expect(
        Object.keys(z[sub] as Dict).sort(),
        `modelPlaza.${sub} 的 zh/en 键集合不一致`
      ).toEqual(Object.keys(e[sub] as Dict).sort())
    }
  })
})
