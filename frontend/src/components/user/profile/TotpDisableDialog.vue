<template>
  <!--
    Mounted behind `v-if` by ProfileTotpCard, so mounting is opening. BaseDialog
    supplies the role, the focus trap, Escape, focus restore and the
    reference-counted background locks this dialog had none of.
  -->
  <BaseDialog
    ref="dialogRef"
    :show="true"
    :title="t('profile.totp.disableTitle')"
    width="narrow"
    :close-on-click-outside="true"
    initial-focus="[data-initial-focus]"
    @close="$emit('close')"
  >
    <div>
      <div class="stat-icon stat-icon-danger mx-auto h-12 w-12 rounded-full">
        <svg class="h-6 w-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
      </div>
      <p class="mt-4 text-center text-sm text-gray-500 dark:text-gray-400">
        {{ t('profile.totp.disableWarning') }}
      </p>
    </div>

    <!-- Loading verification method -->
    <div v-if="methodLoading" class="flex items-center justify-center py-8" role="status">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
    </div>

    <form v-else @submit.prevent="handleDisable" class="mt-6 space-y-4">
      <!-- Email verification -->
      <div v-if="verificationMethod === 'email'">
        <label for="totp-disable-email-code" class="input-label">{{ t('profile.totp.emailCode') }}</label>
        <div class="flex gap-2">
          <input
            id="totp-disable-email-code"
            v-model="form.emailCode"
            data-initial-focus
            type="text"
            maxlength="6"
            inputmode="numeric"
            class="input flex-1"
            :placeholder="t('profile.totp.enterEmailCode')"
          />
          <button
            type="button"
            class="btn btn-secondary whitespace-nowrap"
            :disabled="sendingCode || codeCooldown > 0"
            @click="handleSendCode"
          >
            {{ codeCooldown > 0 ? `${codeCooldown}s` : (sendingCode ? t('common.sending') : t('profile.totp.sendCode')) }}
          </button>
        </div>
      </div>

      <!-- Password verification -->
      <div v-else>
        <label for="totp-disable-password" class="input-label">
          {{ t('profile.currentPassword') }}
        </label>
        <input
          id="totp-disable-password"
          v-model="form.password"
          data-initial-focus
          type="password"
          autocomplete="current-password"
          class="input"
          :placeholder="t('profile.totp.enterPassword')"
        />
      </div>

      <!-- Actions -->
      <div class="flex justify-end gap-3 pt-4">
        <button type="button" class="btn btn-secondary" @click="$emit('close')">
          {{ t('common.cancel') }}
        </button>
        <button
          type="submit"
          class="btn btn-danger"
          :disabled="loading || !canSubmit"
        >
          {{ loading ? t('common.processing') : t('profile.totp.confirmDisable') }}
        </button>
      </div>
    </form>
  </BaseDialog>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAppStore } from '@/stores/app'
import { totpAPI } from '@/api'
import BaseDialog from '@/components/common/BaseDialog.vue'

const emit = defineEmits<{
  close: []
  success: []
}>()

const { t } = useI18n()
const appStore = useAppStore()

const dialogRef = ref<InstanceType<typeof BaseDialog> | null>(null)

const methodLoading = ref(true)
const verificationMethod = ref<'email' | 'password'>('password')
const loading = ref(false)
const sendingCode = ref(false)
const codeCooldown = ref(0)
const cooldownTimer = ref<ReturnType<typeof setInterval> | null>(null)
const form = ref({
  emailCode: '',
  password: ''
})

const canSubmit = computed(() => {
  if (verificationMethod.value === 'email') {
    return form.value.emailCode.length === 6
  }
  return form.value.password.length > 0
})

const loadVerificationMethod = async () => {
  methodLoading.value = true
  try {
    const method = await totpAPI.getVerificationMethod()
    verificationMethod.value = method.method
  } catch (err: any) {
    appStore.showError(err.response?.data?.message || t('common.error'))
    emit('close')
  } finally {
    methodLoading.value = false
    // The field this dialog wants focused does not exist until this resolves, so
    // `initial-focus` had nothing to match when BaseDialog first opened.
    await nextTick()
    dialogRef.value?.focusInitial()
  }
}

const handleSendCode = async () => {
  sendingCode.value = true
  try {
    await totpAPI.sendVerifyCode()
    appStore.showSuccess(t('profile.totp.codeSent'))
    // Start cooldown
    codeCooldown.value = 60
    if (cooldownTimer.value) {
      clearInterval(cooldownTimer.value)
      cooldownTimer.value = null
    }
    cooldownTimer.value = setInterval(() => {
      codeCooldown.value--
      if (codeCooldown.value <= 0) {
        if (cooldownTimer.value) {
          clearInterval(cooldownTimer.value)
          cooldownTimer.value = null
        }
      }
    }, 1000)
  } catch (err: any) {
    appStore.showError(err.response?.data?.message || t('profile.totp.sendCodeFailed'))
  } finally {
    sendingCode.value = false
  }
}

const handleDisable = async () => {
  if (!canSubmit.value) return

  loading.value = true

  try {
    const request = verificationMethod.value === 'email'
      ? { email_code: form.value.emailCode }
      : { password: form.value.password }

    await totpAPI.disable(request)
    appStore.showSuccess(t('profile.totp.disableSuccess'))
    emit('success')
  } catch (err: any) {
    appStore.showError(err.response?.data?.message || t('profile.totp.disableFailed'))
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadVerificationMethod()
})

onUnmounted(() => {
  if (cooldownTimer.value) {
    clearInterval(cooldownTimer.value)
    cooldownTimer.value = null
  }
})
</script>
