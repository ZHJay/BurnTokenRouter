<template>
  <!--
    Step-up 2FA gates privileged actions, and it stacks: UserEditModal and
    UserCreateModal are themselves BaseDialogs, so this one opens on top of an
    already-open dialog. Going through BaseDialog is what makes that stack behave
    — one Escape closes only this dialog, and the scroll lock survives it closing
    while the dialog underneath stays open.

    z-index 60 keeps it above the z-50 dialog that triggered it.
  -->
  <BaseDialog
    :show="controller.visible.value"
    :title="t('stepUp.title')"
    width="narrow"
    :z-index="60"
    :close-on-escape="!verifying"
    :close-on-click-outside="true"
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
          <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
        </svg>
      </div>
      <p class="mt-4 text-[13px] text-gray-500 dark:text-gray-400">
        {{ t('stepUp.hint') }}
      </p>
    </div>

    <div class="mt-6">
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
      <div v-if="verifying" class="mt-3 flex items-center justify-center gap-2 text-[13px] text-gray-500" role="status">
        <div class="spinner h-4 w-4 text-primary-600 dark:text-primary-400"></div>
        {{ t('common.verifying') }}
      </div>
    </div>

    <template #footer>
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
import { totpAPI } from '@/api'
import BaseDialog from '@/components/common/BaseDialog.vue'
import type { StepUpController } from '@/composables/useStepUp'

const props = defineProps<{
  controller: StepUpController
}>()

const { t } = useI18n()
const appStore = useAppStore()

const verifying = ref(false)
const code = ref<string[]>(['', '', '', '', '', ''])
const inputRefs = ref<(HTMLInputElement | null)[]>([])
const hiddenOtpInputRef = ref<HTMLInputElement | null>(null)

// Clear stale digits whenever the dialog opens. Focusing the first cell is
// BaseDialog's job now, via `initial-focus`.
watch(
  () => props.controller.visible.value,
  (open) => {
    if (open) {
      resetInputs()
    }
  }
)

// Auto-submit once 6 digits are entered.
watch(
  () => code.value.join(''),
  (newCode) => {
    if (newCode.length === 6 && !verifying.value) {
      submit(newCode)
    }
  }
)

async function submit(otp: string) {
  verifying.value = true
  try {
    await totpAPI.stepUp(otp)
    verifying.value = false
    resetInputs()
    props.controller.onVerified()
  } catch (err: any) {
    verifying.value = false
    appStore.showError(err?.message || t('stepUp.verifyFailed'))
    resetInputs()
    nextTick(() => inputRefs.value[0]?.focus())
  }
}

function resetInputs() {
  code.value = ['', '', '', '', '', '']
  inputRefs.value.forEach((input) => {
    if (input) input.value = ''
  })
  if (hiddenOtpInputRef.value) hiddenOtpInputRef.value.value = ''
}

function handleCancel() {
  if (verifying.value) return
  props.controller.onCancel()
}

const setInputRef = (el: any, index: number) => {
  inputRefs.value[index] = el as HTMLInputElement | null
}

const handleCodeInput = (event: Event, index: number) => {
  const input = event.target as HTMLInputElement
  const value = input.value.replace(/[^0-9]/g, '')
  code.value[index] = value
  if (value && index < 5) {
    nextTick(() => inputRefs.value[index + 1]?.focus())
  }
}

const handleHiddenOtpInput = (event: Event) => {
  const input = event.target as HTMLInputElement
  const digits = input.value.replace(/[^0-9]/g, '').slice(0, 6).split('')
  for (let i = 0; i < 6; i++) {
    code.value[i] = digits[i] || ''
    if (inputRefs.value[i]) inputRefs.value[i]!.value = digits[i] || ''
  }
}

const handleKeydown = (event: KeyboardEvent, index: number) => {
  if (event.key === 'Backspace') {
    const input = event.target as HTMLInputElement
    if (!input.value && index > 0) {
      event.preventDefault()
      inputRefs.value[index - 1]?.focus()
    }
  }
}

const handlePaste = (event: ClipboardEvent) => {
  event.preventDefault()
  const pastedData = event.clipboardData?.getData('text') || ''
  const digits = pastedData.replace(/[^0-9]/g, '').slice(0, 6).split('')
  for (let i = 0; i < 6; i++) {
    code.value[i] = digits[i] || ''
    if (inputRefs.value[i]) inputRefs.value[i]!.value = digits[i] || ''
  }
  const focusIndex = Math.min(digits.length, 5)
  nextTick(() => inputRefs.value[focusIndex]?.focus())
}
</script>
