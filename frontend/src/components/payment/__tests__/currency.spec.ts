import { describe, expect, it } from 'vitest'
import {
  BALANCE_LEDGER_CURRENCY,
  currencySymbol,
  formatBalanceAmount,
  formatPaymentAmount,
} from '../currency'

describe('formatPaymentAmount', () => {
  it('uses the currency default fraction digits', () => {
    expect(formatPaymentAmount(100, 'JPY', 'en-US')).not.toContain('.00')
    expect(formatPaymentAmount(100, 'KRW', 'en-US')).not.toContain('.00')
    expect(formatPaymentAmount(100, 'HKD', 'en-US')).toContain('.00')
  })
})

describe('currencySymbol', () => {
  it('maps common payment currencies and falls back safely', () => {
    expect(currencySymbol('USD')).toBe('$')
    expect(currencySymbol('cny')).toBe('¥')
    expect(currencySymbol('EUR')).toBe('€')
    expect(currencySymbol('')).toBe('¥')
    expect(currencySymbol('XYZ')).toBe('XYZ')
  })
})

describe('formatBalanceAmount', () => {
  it('stays in the USD ledger currency regardless of the payment currency', () => {
    // 余额层不跟随所选支付方式：这是本路由上第二个、独立的货币单位。
    expect(BALANCE_LEDGER_CURRENCY).toBe('USD')
    expect(formatBalanceAmount(248.74, 'en-US')).toBe('$248.74')
    expect(formatBalanceAmount(14, 'en-US')).toBe('$14.00')
    // 中文 locale 下依然是 $ —— 记账货币与界面语言无关。
    expect(formatBalanceAmount(248.74, 'zh-CN')).toContain('$')
    expect(formatBalanceAmount(248.74, 'zh-CN')).not.toContain('¥')
  })

  it('renders a symbol for zero and non-finite input instead of a bare number', () => {
    expect(formatBalanceAmount(0, 'en-US')).toBe('$0.00')
    expect(formatBalanceAmount(Number.NaN, 'en-US')).toBe('$0.00')
  })
})
