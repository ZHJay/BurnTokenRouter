import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import PlazaViewToggle from '../PlazaViewToggle.vue'

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return {
    ...actual,
    useI18n: () => ({
      t: (key: string) => key
    })
  }
})

describe('PlazaViewToggle', () => {
  it('用全站 .segmented 分段控件渲染卡片/表格两档', () => {
    const wrapper = mount(PlazaViewToggle, { props: { modelValue: 'cards' } })

    expect(wrapper.classes()).toContain('segmented')
    const buttons = wrapper.findAll('button')
    expect(buttons).toHaveLength(2)
    expect(buttons[0].text()).toBe('modelPlaza.view.cards')
    expect(buttons[1].text()).toBe('modelPlaza.view.table')
  })

  it('当前档位标 active 且 aria-pressed 正确反映状态', () => {
    const wrapper = mount(PlazaViewToggle, { props: { modelValue: 'table' } })

    const cards = wrapper.get('[data-view="cards"]')
    const table = wrapper.get('[data-view="table"]')
    expect(table.classes()).toContain('active')
    expect(cards.classes()).not.toContain('active')
    expect(table.attributes('aria-pressed')).toBe('true')
    expect(cards.attributes('aria-pressed')).toBe('false')
  })

  it('点击另一档 emit update:modelValue', async () => {
    const wrapper = mount(PlazaViewToggle, { props: { modelValue: 'cards' } })

    await wrapper.get('[data-view="table"]').trigger('click')
    expect(wrapper.emitted('update:modelValue')).toEqual([['table']])
  })
})
