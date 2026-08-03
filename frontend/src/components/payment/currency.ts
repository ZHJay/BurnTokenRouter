export const DEFAULT_PAYMENT_CURRENCY = 'CNY'

/* 账户余额的记账货币。

   这个常量存在是因为本路由上有两个**不同且都正确**的货币单位，而它们此前都被
   写成了裸 `$`，看起来像同一个东西：

     1. 支付金额 —— 计价货币来自所选支付方式（visibleMethods[type].currency），
        未配置时回落到 DEFAULT_PAYMENT_CURRENCY = 'CNY'。用户实际被扣的就是它。
     2. 账户余额 —— 全站以 USD 记账。AppHeader 的余额胶囊、RedeemView 的余额、
        套餐的 daily/weekly/monthly_limit_usd 都是 USD，后端
        calculateCreditedBalance(payAmount, balance_recharge_multiplier) 正是把
        「支付货币金额」换算成「USD 余额」的那一步（i18n
        payment.rechargeRatePreview 写明 "1 CNY = {usd} USD"）。

   所以「到账余额」与「当前余额」必须保持 USD，不能跟随所选支付方式：支付宝
   （CNY）下把 USD 余额显示成 ¥ 会把一个缺符号的 bug 换成一个标错币种的 bug。
   命名常量而不是继续写裸 `$`，是为了让这一层的单位是被声明过的，
   而不是下一个人看到 `$` 后顺手「统一」掉。 */
export const BALANCE_LEDGER_CURRENCY = 'USD'

const PAYMENT_CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  CNY: '¥',
  RMB: '¥',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  HKD: 'HK$',
  TWD: 'NT$',
  KRW: '₩',
  AUD: 'A$',
  CAD: 'C$',
  SGD: 'S$',
  NZD: 'NZ$',
  MOP: 'MOP$',
  MYR: 'RM',
  THB: '฿',
  PHP: '₱',
  INR: '₹',
}

export function normalizePaymentCurrency(currency?: string | null): string {
  const normalized = String(currency || '').trim().toUpperCase()
  return /^[A-Z]{3}$/.test(normalized) ? normalized : DEFAULT_PAYMENT_CURRENCY
}

export function currencySymbol(currency?: string | null): string {
  const normalized = normalizePaymentCurrency(currency)
  return PAYMENT_CURRENCY_SYMBOLS[normalized] || normalized
}

function paymentCurrencyFractionDigits(currency: string): number {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
    }).resolvedOptions().maximumFractionDigits ?? 2
  } catch {
    return 2
  }
}

export function formatPaymentAmount(amount: number, currency?: string | null, locale?: string): string {
  const normalized = normalizePaymentCurrency(currency)
  const fractionDigits = paymentCurrencyFractionDigits(normalized)
  try {
    return new Intl.NumberFormat(locale || undefined, {
      style: 'currency',
      currency: normalized,
      currencyDisplay: 'narrowSymbol',
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(Number.isFinite(amount) ? amount : 0)
  } catch {
    return `${normalized} ${(Number.isFinite(amount) ? amount : 0).toFixed(fractionDigits)}`
  }
}

/* 格式化 USD 记账余额。走 formatPaymentAmount 而不是模板里的 `$${n.toFixed(2)}`，
   是为了让余额和支付金额共用同一条 narrowSymbol + 千分位 + 定位小数的输出规则 ——
   同屏两个金额层用同一套排版，差异只剩币种符号本身。 */
export function formatBalanceAmount(amount: number, locale?: string): string {
  return formatPaymentAmount(amount, BALANCE_LEDGER_CURRENCY, locale)
}
