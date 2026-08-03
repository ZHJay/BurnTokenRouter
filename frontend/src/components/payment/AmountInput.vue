<template>
  <div class="space-y-4">
    <!-- Quick Amount Buttons -->
    <div>
      <label class="input-label">
        {{ t('payment.quickAmounts') }}
      </label>
      <!-- 2-up on phones, 3-up from sm. 40px 的行高在 3 列里无法涨到 44pt 而不让
           这一行吃掉整张卡，所以让按钮在拇指真正操作的宽度上变宽。 -->
      <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <button
          v-for="amt in filteredAmounts"
          :key="amt"
          type="button"
          :aria-pressed="modelValue === amt"
          :class="[
            'tabular rounded-lg px-4 py-2.5 text-center text-sm font-medium',
            'transition duration-fast ease-apple-out active:scale-[0.98] focus-visible:outline-none',
            'focus-visible:ring-[3.5px] focus-visible:ring-[color:var(--accent-tint-strong)]',
            modelValue === amt
              ? 'bg-[var(--accent-tint)] text-[var(--accent)] shadow-[inset_0_0_0_1.5px_var(--accent)]'
              : 'bg-[var(--surface-secondary)] text-[var(--label)] shadow-[inset_0_0_0_1px_var(--separator)] hover:shadow-[inset_0_0_0_1px_var(--label-quaternary)]',
          ]"
          @click="selectAmount(amt)"
        >
          {{ amt }}
        </button>
      </div>
    </div>

    <!-- Custom Amount Input -->
    <div>
      <label class="input-label">
        {{ t('payment.customAmount') }}
      </label>
      <div class="relative">
        <!-- 前缀字形来自 currency prop：与 CTA 的 formatPaymentAmount 同源，
             不再是硬编码的 `$`。--label-secondary 而非装饰层：它是该字段
             唯一说明计价货币的地方，属于必要文字。 -->
        <span
          data-test="amount-currency-prefix"
          class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--label-secondary)]"
        >
          {{ prefixSymbol }}
        </span>
        <input
          type="text"
          inputmode="decimal"
          :aria-label="t('payment.customAmount')"
          :value="customText"
          :placeholder="placeholderText"
          class="input tabular w-full pl-8 pr-4"
          @input="handleInput"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { currencySymbol } from './currency'

const props = withDefaults(defineProps<{
  amounts?: number[]
  modelValue: number | null
  min?: number
  max?: number
  /* 计价货币。留空时 currencySymbol() 会回落到 DEFAULT_PAYMENT_CURRENCY，
     与 CTA 上 formatPaymentAmount() 的回落路径一致 —— 两侧同源同回落。 */
  currency?: string | null
}>(), {
  amounts: () => [10, 20, 50, 100, 200, 500, 1000, 2000, 5000],
  min: 0,
  max: 0,
  currency: '',
})

const emit = defineEmits<{
  'update:modelValue': [value: number | null]
}>()

const { t } = useI18n()

const customText = ref('')

const prefixSymbol = computed(() => currencySymbol(props.currency))

// 0 = no limit
const filteredAmounts = computed(() =>
  props.amounts.filter((a) => (props.min <= 0 || a >= props.min) && (props.max <= 0 || a <= props.max))
)

const placeholderText = computed(() => {
  if (props.min > 0 && props.max > 0) return `${props.min} - ${props.max}`
  if (props.min > 0) return `≥ ${props.min}`
  if (props.max > 0) return `≤ ${props.max}`
  return t('payment.enterAmount')
})

const AMOUNT_PATTERN = /^\d*(\.\d{0,2})?$/

function selectAmount(amt: number) {
  customText.value = String(amt)
  emit('update:modelValue', amt)
}

function handleInput(e: Event) {
  const val = (e.target as HTMLInputElement).value
  if (!AMOUNT_PATTERN.test(val)) return
  customText.value = val
  if (val === '') {
    emit('update:modelValue', null)
    return
  }
  const num = parseFloat(val)
  if (!isNaN(num) && num > 0) {
    emit('update:modelValue', num)
  } else {
    emit('update:modelValue', null)
  }
}

watch(() => props.modelValue, (v) => {
  if (v !== null && String(v) !== customText.value) {
    customText.value = String(v)
  }
}, { immediate: true })

/* 预选第一个可用档位。

   选中态一直存在，但 modelValue 以 null 开局、没有任何档位被预选，所以首屏永远
   看不到它 —— 缺的是默认值，不是状态样式。预选同时让 CTA 从「¥0.00 + 禁用」
   变成一个可提交的真实金额，首屏不再停在最不可读的那一帧。

   取第一个（受 min/max 过滤后）而非「最常用档位」：后者是产品判断，需要成单
   数据支撑，这里没有。第一个可用档位是最小且可解释的选择。

   onMounted 而非 setup 期：父组件的 min/max 来自 /payment/checkout-info，
   挂载后才到达，所以在 filteredAmounts 上加 watch 来跟上首次非空的那批档位。 */
function preselectDefaultAmount() {
  if (props.modelValue !== null) return
  const first = filteredAmounts.value[0]
  if (first === undefined) return
  selectAmount(first)
}

onMounted(preselectDefaultAmount)

watch(filteredAmounts, (list, previous) => {
  // 只在档位表首次可用时补预选，避免覆盖用户已有的输入。
  if (previous.length === 0 && list.length > 0) preselectDefaultAmount()
})
</script>
