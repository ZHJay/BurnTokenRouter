import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import AmountInput from '@/components/payment/AmountInput.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}))

type AmountInputProps = InstanceType<typeof AmountInput>['$props']

function mountAmountInput(props: Partial<AmountInputProps> = {}) {
  return mount(AmountInput, {
    props: {
      modelValue: null,
      ...props,
    },
  })
}

function prefixOf(wrapper: ReturnType<typeof mountAmountInput>): string {
  return wrapper.get('[data-test="amount-currency-prefix"]').text()
}

describe('AmountInput currency prefix', () => {
  it('takes the prefix glyph from the currency prop instead of a hardcoded $', () => {
    expect(prefixOf(mountAmountInput({ currency: 'USD' }))).toBe('$')
    expect(prefixOf(mountAmountInput({ currency: 'CNY' }))).toBe('¥')
    expect(prefixOf(mountAmountInput({ currency: 'EUR' }))).toBe('€')
  })

  it('falls back to the default payment currency when the backend sends none', () => {
    // 后端不下发 currency 时，CTA 的 formatPaymentAmount 会回落到
    // DEFAULT_PAYMENT_CURRENCY='CNY'。前缀必须走同一条回落，
    // 否则又回到 $ 输入 + ¥ CTA 的原始 bug。
    expect(prefixOf(mountAmountInput({ currency: '' }))).toBe('¥')
    expect(prefixOf(mountAmountInput({ currency: null }))).toBe('¥')
    expect(prefixOf(mountAmountInput())).toBe('¥')
  })

  it('never renders a glyph the amount formatter would not agree with', () => {
    // 未知币种：currencySymbol 回落到币种代码本身，两侧仍然一致。
    expect(prefixOf(mountAmountInput({ currency: 'XYZ' }))).toBe('XYZ')
  })
})

describe('AmountInput default selection', () => {
  it('preselects the first amount on mount so the selected state is visible on load', async () => {
    const wrapper = mountAmountInput({ amounts: [10, 20, 50] })
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([10])
  })

  it('preselects the first amount that survives the min/max filter', async () => {
    const wrapper = mountAmountInput({ amounts: [10, 20, 50, 100], min: 30, max: 80 })
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([50])
  })

  it('preselects once limits arrive asynchronously from checkout-info', async () => {
    // min/max 来自 /payment/checkout-info，首帧可能把所有档位都过滤掉。
    const wrapper = mountAmountInput({ amounts: [10, 20, 50], min: 999, max: 0 })
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()

    await wrapper.setProps({ min: 20 })
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([20])
  })

  it('does not overwrite an amount the parent already restored', async () => {
    const wrapper = mountAmountInput({ modelValue: 66, amounts: [10, 20, 50] })
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect((wrapper.get('input').element as HTMLInputElement).value).toBe('66')
  })

  it('marks the selected amount with the accent ring recipe, not a 2px border', async () => {
    const wrapper = mountAmountInput({ amounts: [10, 20, 50], modelValue: 20 })
    await wrapper.vm.$nextTick()

    const buttons = wrapper.findAll('button')
    const selected = buttons[1]
    const unselected = buttons[0]

    expect(selected.classes()).toEqual(expect.arrayContaining([
      'bg-[var(--accent-tint)]',
      'text-[var(--accent)]',
      'shadow-[inset_0_0_0_1.5px_var(--accent)]',
    ]))
    expect(selected.attributes('aria-pressed')).toBe('true')

    expect(unselected.classes()).toEqual(expect.arrayContaining([
      'bg-[var(--surface-secondary)]',
      'text-[var(--label)]',
      'shadow-[inset_0_0_0_1px_var(--separator)]',
    ]))
    expect(unselected.attributes('aria-pressed')).toBe('false')

    // 2px 边框与 gray-200 硬编码在原型里不存在，系统用 inset ring。
    const allClasses = buttons.flatMap(button => button.classes())
    expect(allClasses).not.toContain('border-2')
    expect(allClasses.some(cls => cls.includes('border-gray-200'))).toBe(false)
    expect(allClasses.some(cls => cls.includes('dark:border-dark-600'))).toBe(false)
  })

  it('keeps the grid 2-up on phones and 3-up from sm', () => {
    const wrapper = mountAmountInput({ amounts: [10, 20, 50] })
    const grid = wrapper.get('button').element.parentElement

    expect([...(grid?.classList ?? [])]).toEqual(expect.arrayContaining([
      'grid',
      'grid-cols-2',
      'sm:grid-cols-3',
    ]))
  })

  it('drops the off-ladder h-12 from the custom amount field', () => {
    const input = mountAmountInput().get('input')

    expect(input.classes()).toEqual(expect.arrayContaining(['input', 'tabular']))
    expect(input.classes()).not.toContain('h-12')
  })
})
