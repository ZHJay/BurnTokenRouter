<template>
  <!--
    This dialog is on the authentication path, so it has to carry the same
    semantics as every other modal in the app: it used to be a bare `<div>` with
    no role, no aria-modal, no Escape, no focus trap and no focus restore.
    BaseDialog supplies all of it, plus the reference-counted scroll lock and the
    `inert` background.

    `show` is a constant because LoginView mounts this behind `v-if` — mounting
    IS opening, and unmounting is what closes it. BaseDialog tears the locks down
    on unmount for exactly this pattern.
  -->
  <BaseDialog
    :show="true"
    :title="t('profile.totp.loginTitle')"
    width="narrow"
    :close-on-escape="!verifying"
    :close-on-click-outside="false"
    :show-close-button="false"
    initial-focus="[data-otp-cell='0']"
    @close="handleCancel"
  >
    <div class="text-center">
      <div
        class="mx-auto flex h-12 w-12 items-center justify-center rounded-full"
        style="background: var(--accent-tint)"
      >
        <svg class="h-6 w-6 text-primary-600 dark:text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
        </svg>
      </div>
      <p class="mt-4 text-[13px] text-gray-500 dark:text-gray-400">
        {{ t('profile.totp.loginHint') }}
      </p>
      <p v-if="userEmailMasked" class="mt-1 text-[13px] font-medium text-gray-700 dark:text-gray-300">
        {{ userEmailMasked }}
      </p>
    </div>

    <!-- Code Input -->
    <div class="mt-6">
      <!-- Hidden input for password manager autofill (autocomplete="one-time-code") -->
      <input
        ref="hiddenOtpInputRef"
        type="text"
        inputmode="numeric"
        autocomplete="one-time-code"
        maxlength="6"
        class="pointer-events-none absolute left-0 top-0 h-px w-px opacity-0"
        aria-hidden="true"
        tabindex="-1"
        @input="handleHiddenOtpInput"
      />
      <!--
        The six cells are one logical field, so the name goes on the group. Naming
        each cell with the same string would make a screen reader announce
        "Enter 6-digit code" six times with no way to tell the cells apart; the
        position label below is numeric on purpose, so it needs no translation.
      -->
      <div class="flex justify-center gap-2" role="group" :aria-label="t('profile.totp.enterCode')">
        <input
          v-for="(_, index) in 6"
          :key="index"
          :ref="(el) => setInputRef(el, index)"
          :data-otp-cell="index"
          type="text"
          maxlength="1"
          inputmode="numeric"
          pattern="[0-9]"
          autocomplete="off"
          :aria-label="`${index + 1} / 6`"
          class="input tabular !w-10 px-0 text-center text-lg font-semibold"
          style="height: 48px"
          :disabled="verifying"
          @input="handleCodeInput($event, index)"
          @keydown="handleKeydown($event, index)"
          @paste="handlePaste"
        />
      </div>
      <!-- Loading indicator -->
      <div v-if="verifying" class="mt-3 flex items-center justify-center gap-2 text-[13px] text-gray-500" role="status">
        <div class="spinner h-4 w-4 text-primary-600 dark:text-primary-400"></div>
        {{ t('common.verifying') }}
      </div>
    </div>

    <template #footer>
      <!-- Cancel button only -->
      <button
        type="button"
        class="btn btn-secondary w-full"
        :disabled="verifying"
        @click="handleCancel"
      >
        {{ t('common.cancel') }}
      </button>
    </template>
  </BaseDialog>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAppStore } from '@/stores'
import BaseDialog from '@/components/common/BaseDialog.vue'

defineProps<{
  tempToken: string
  userEmailMasked?: string
}>()

const emit = defineEmits<{
  verify: [code: string]
  cancel: []
}>()

const { t } = useI18n()
const appStore = useAppStore()

const verifying = ref(false)
const code = ref<string[]>(['', '', '', '', '', ''])
const inputRefs = ref<(HTMLInputElement | null)[]>([])
const hiddenOtpInputRef = ref<HTMLInputElement | null>(null)

// Escape and the Cancel button share one guard: cancelling mid-verification
// would drop an in-flight request the user cannot see the result of.
const handleCancel = () => {
  if (verifying.value) return
  emit('cancel')
}

// Watch for code changes and auto-submit when 6 digits are entered
watch(
  () => code.value.join(''),
  (newCode) => {
    if (newCode.length === 6 && !verifying.value) {
      emit('verify', newCode)
    }
  }
)

defineExpose({
  setVerifying: (value: boolean) => { verifying.value = value },
  setError: (message: string) => {
    if (message) {
      appStore.showError(message)
    }
    code.value = ['', '', '', '', '', '']
    // Clear input DOM values
    inputRefs.value.forEach(input => {
      if (input) input.value = ''
    })
    // Clear hidden autofill input
    if (hiddenOtpInputRef.value) {
      hiddenOtpInputRef.value.value = ''
    }
    nextTick(() => {
      inputRefs.value[0]?.focus()
    })
  }
})

const setInputRef = (el: any, index: number) => {
  inputRefs.value[index] = el as HTMLInputElement | null
}

const handleCodeInput = (event: Event, index: number) => {
  const input = event.target as HTMLInputElement
  const value = input.value.replace(/[^0-9]/g, '')
  code.value[index] = value

  if (value && index < 5) {
    nextTick(() => {
      inputRefs.value[index + 1]?.focus()
    })
  }
}

// Handle autofill from password managers via the hidden autocomplete="one-time-code" input
const handleHiddenOtpInput = (event: Event) => {
  const input = event.target as HTMLInputElement
  const digits = input.value.replace(/[^0-9]/g, '').slice(0, 6).split('')

  digits.forEach((digit, i) => {
    code.value[i] = digit
    if (inputRefs.value[i]) {
      inputRefs.value[i]!.value = digit
    }
  })

  for (let i = digits.length; i < 6; i++) {
    code.value[i] = ''
    if (inputRefs.value[i]) {
      inputRefs.value[i]!.value = ''
    }
  }
}

const handleKeydown = (event: KeyboardEvent, index: number) => {
  if (event.key === 'Backspace') {
    const input = event.target as HTMLInputElement
    // If current cell is empty and not the first, move to previous cell
    if (!input.value && index > 0) {
      event.preventDefault()
      inputRefs.value[index - 1]?.focus()
    }
    // Otherwise, let the browser handle the backspace naturally
    // The input event will sync code.value via handleCodeInput
  }
}

const handlePaste = (event: ClipboardEvent) => {
  event.preventDefault()
  const pastedData = event.clipboardData?.getData('text') || ''
  const digits = pastedData.replace(/[^0-9]/g, '').slice(0, 6).split('')

  // Update both the ref and the input elements
  digits.forEach((digit, index) => {
    code.value[index] = digit
    if (inputRefs.value[index]) {
      inputRefs.value[index]!.value = digit
    }
  })

  // Clear remaining inputs if pasted less than 6 digits
  for (let i = digits.length; i < 6; i++) {
    code.value[i] = ''
    if (inputRefs.value[i]) {
      inputRefs.value[i]!.value = ''
    }
  }

  const focusIndex = Math.min(digits.length, 5)
  nextTick(() => {
    inputRefs.value[focusIndex]?.focus()
  })
}
</script>
