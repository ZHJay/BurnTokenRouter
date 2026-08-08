<template>
  <div class="auth-page px-4 py-10">
    <div class="auth-spot auth-spot-1" aria-hidden="true"></div>
    <div class="auth-spot auth-spot-2" aria-hidden="true"></div>
    <div class="auth-spot auth-spot-3" aria-hidden="true"></div>
    <div class="relative z-10 mx-auto max-w-2xl">
      <div v-if="isProcessing" class="glass-card p-6 text-center">
        <div class="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary-500 border-t-transparent"></div>
        <h1 class="mt-4 text-lg font-semibold text-gray-900 dark:text-white">
          {{ t('auth.oauth.callbackTitle') }}
        </h1>
        <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
          {{ t('auth.oauth.callbackHint') }}
        </p>
      </div>

      <div v-else-if="needsRegistrationCompletion" class="glass-card p-6">
        <h1 class="text-lg font-semibold text-gray-900 dark:text-white">
          {{ t('auth.oidc.callbackTitle', { providerName }) }}
        </h1>
        <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
          {{ registrationHint }}
        </p>

        <div class="mt-6 space-y-4">
          <div>
            <label class="input-label">{{ t('auth.emailLabel') }}</label>
            <input
              class="input w-full"
              type="email"
              :value="registrationEmail"
              readonly
              disabled
            />
          </div>
          <div>
            <label class="input-label">{{ t('auth.passwordLabel') }}</label>
            <input
              v-model="password"
              type="password"
              class="input w-full"
              :placeholder="t('auth.createPasswordPlaceholder')"
              :disabled="isSubmitting"
              autocomplete="new-password"
              @keyup.enter="handleSubmitRegistration"
            />
          </div>
          <div>
            <label class="input-label">{{ t('auth.confirmPassword') }}</label>
            <input
              v-model="confirmPassword"
              type="password"
              class="input w-full"
              :placeholder="t('auth.confirmPasswordPlaceholder')"
              :disabled="isSubmitting"
              autocomplete="new-password"
              @keyup.enter="handleSubmitRegistration"
            />
          </div>
          <div v-if="invitationRequired">
            <label class="input-label">{{ t('auth.invitationCodeLabel') }}</label>
            <input
              v-model="invitationCode"
              type="text"
              class="input w-full"
              :placeholder="t('auth.invitationCodePlaceholder')"
              :disabled="isSubmitting"
              @keyup.enter="handleSubmitRegistration"
            />
          </div>
          <p v-if="registrationError" class="text-sm text-red-600 dark:text-red-400">
            {{ registrationError }}
          </p>
          <button
            class="btn btn-primary w-full"
            type="button"
            :disabled="isSubmitting || !canSubmitRegistration"
            @click="handleSubmitRegistration"
          >
            {{ isSubmitting ? t('common.processing') : t('auth.oidc.completeRegistration') }}
          </button>
        </div>
      </div>

      <div v-else-if="invalidCallback" class="glass-card p-6 text-center">
        <h1 class="text-lg font-semibold text-gray-900 dark:text-white">
          {{ t('auth.oauth.invalidCallbackTitle') }}
        </h1>
        <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
          {{ t('auth.oauth.invalidCallbackHint') }}
        </p>
        <button class="btn btn-primary mt-6" type="button" @click="router.replace('/login')">
          {{ t('auth.backToLogin') }}
        </button>
      </div>

      <div v-else class="glass-card p-6">
        <h1 class="text-lg font-semibold text-gray-900 dark:text-white">
          {{ t('auth.oauth.callbackTitle') }}
        </h1>
        <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
          {{ t('auth.oauth.callbackHint') }}
        </p>

        <div class="mt-6 space-y-4">
          <div>
            <label class="input-label">{{ t('auth.oauth.code') }}</label>
            <div class="flex gap-2">
              <input class="input flex-1 font-mono text-sm" :value="code" readonly />
              <button class="btn btn-secondary" type="button" :disabled="!code" @click="copy(code)">
                {{ t('common.copy') }}
              </button>
            </div>
          </div>

          <div>
            <label class="input-label">{{ t('auth.oauth.state') }}</label>
            <div class="flex gap-2">
              <input class="input flex-1 font-mono text-sm" :value="state" readonly />
              <button
                class="btn btn-secondary"
                type="button"
                :disabled="!state"
                @click="copy(state)"
              >
                {{ t('common.copy') }}
              </button>
            </div>
          </div>

          <div>
            <label class="input-label">{{ t('auth.oauth.fullUrl') }}</label>
            <div class="flex gap-2">
              <input class="input flex-1 font-mono text-xs" :value="fullUrl" readonly />
              <button
                class="btn btn-secondary"
                type="button"
                :disabled="!fullUrl"
                @click="copy(fullUrl)"
              >
                {{ t('common.copy') }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useClipboard } from '@/composables/useClipboard'
import { useAppStore, useAuthStore } from '@/stores'
import { apiClient } from '@/api/client'
import { buildApiUrl } from '@/api/url'
import {
  exchangePendingOAuthCompletion,
  persistOAuthTokenContext,
  type OAuthTokenResponse
} from '@/api/auth'
import {
  clearAllAffiliateReferralCodes,
  loadOAuthAffiliateCode,
  oauthAffiliatePayload
} from '@/utils/oauthAffiliate'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const { copyToClipboard } = useClipboard()
const appStore = useAppStore()
const authStore = useAuthStore()
const isProcessing = ref(false)
const isSubmitting = ref(false)
const needsRegistrationCompletion = ref(false)
const invitationRequired = ref(false)
const registrationEmail = ref('')
const password = ref('')
const confirmPassword = ref('')
const invitationCode = ref('')
const registrationError = ref('')
const pendingProvider = ref<'github' | 'google'>('github')
const redirectTo = ref('/dashboard')
const invalidCallback = ref(false)
const EMAIL_OAUTH_PENDING_PROVIDER_KEY = 'email_oauth_pending_provider'

type EmailOAuthPendingCompletion = Partial<OAuthTokenResponse> & {
  error?: string
  provider?: string
  redirect?: string
  email?: string
  resolved_email?: string
  invitation_required?: boolean
}

const code = computed(() => (route.query.code as string) || '')
const state = computed(() => (route.query.state as string) || '')
const error = computed(
  () => (route.query.error as string) || (route.query.error_description as string) || ''
)

const fullUrl = computed(() => {
  if (typeof window === 'undefined') return ''
  return window.location.href
})
const providerName = computed(() =>
  pendingProvider.value === 'google' ? 'Google' : 'GitHub'
)
const registrationHint = computed(() =>
  invitationRequired.value
    ? t('auth.oidc.invitationRequired', { providerName: providerName.value })
    : t('auth.oidc.completeRegistration')
)
const canSubmitRegistration = computed(() => {
  if (!registrationEmail.value.trim()) return false
  if (password.value.length < 6) return false
  if (password.value !== confirmPassword.value) return false
  if (invitationRequired.value && !invitationCode.value.trim()) return false
  return true
})

function parseFragmentParams(): URLSearchParams {
  const raw = typeof window !== 'undefined' ? window.location.hash : ''
  const hash = raw.startsWith('#') ? raw.slice(1) : raw
  return new URLSearchParams(hash)
}

function readTokenResponse(params: URLSearchParams): OAuthTokenResponse | null {
  const accessToken = params.get('access_token')?.trim() || ''
  if (!accessToken) return null

  const response: OAuthTokenResponse = { access_token: accessToken }
  const refreshToken = params.get('refresh_token')?.trim() || ''
  if (refreshToken) response.refresh_token = refreshToken
  const expiresIn = Number.parseInt(params.get('expires_in')?.trim() || '', 10)
  if (Number.isFinite(expiresIn) && expiresIn > 0) response.expires_in = expiresIn
  const tokenType = params.get('token_type')?.trim() || ''
  if (tokenType) response.token_type = tokenType
  return response
}

function sanitizeRedirectPath(path: string | null | undefined): string {
  if (!path) return '/dashboard'
  if (!path.startsWith('/')) return '/dashboard'
  if (path.startsWith('//')) return '/dashboard'
  if (path.includes('://')) return '/dashboard'
  if (path.includes('\n') || path.includes('\r')) return '/dashboard'
  return path
}

function readPendingEmailOAuthProvider(): 'github' | 'google' | null {
  if (typeof window === 'undefined') return null
  const provider = window.sessionStorage.getItem(EMAIL_OAUTH_PENDING_PROVIDER_KEY)
  if (provider === 'github' || provider === 'google') return provider
  return null
}

function redirectProviderCallbackToBackend(provider: 'github' | 'google'): void {
  if (typeof window === 'undefined') return
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(route.query)) {
    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (item != null) params.append(key, String(item))
      })
    } else if (value != null) {
      params.set(key, String(value))
    }
  }
  const suffix = params.toString() ? `?${params.toString()}` : ''
  window.location.href = buildApiUrl(`/auth/oauth/${provider}/callback${suffix}`)
}

async function finalizeTokenResponse(tokenResponse: OAuthTokenResponse, redirect: string) {
  persistOAuthTokenContext(tokenResponse)
  await authStore.setToken(tokenResponse.access_token)
  if (typeof window !== 'undefined') {
    window.sessionStorage.removeItem(EMAIL_OAUTH_PENDING_PROVIDER_KEY)
  }
  clearAllAffiliateReferralCodes()
  appStore.showSuccess(t('auth.loginSuccess'))
  await router.replace(sanitizeRedirectPath(redirect))
}

function hasOAuthTokenResponse(value: Partial<OAuthTokenResponse>): value is OAuthTokenResponse {
  return typeof value.access_token === 'string' && value.access_token.trim() !== ''
}

async function resumePendingEmailOAuth() {
  isProcessing.value = true
  try {
    const completion = await exchangePendingOAuthCompletion() as EmailOAuthPendingCompletion
    const completionRedirect = completion.redirect || '/dashboard'
    if (hasOAuthTokenResponse(completion)) {
      await finalizeTokenResponse(completion, completionRedirect)
      return
    }

    const provider = String(completion.provider || '').toLowerCase()
    if (provider === 'github' || provider === 'google') {
      pendingProvider.value = provider
    }
    redirectTo.value = sanitizeRedirectPath(completionRedirect)

    if (completion.error === 'invitation_required' || completion.error === 'registration_completion_required') {
      invitationRequired.value = completion.error === 'invitation_required' || completion.invitation_required === true
      registrationEmail.value = String(completion.resolved_email || completion.email || '').trim()
      needsRegistrationCompletion.value = true
      isProcessing.value = false
      return
    }

    appStore.showError(completion.error || t('auth.loginFailed'))
  } catch (e: unknown) {
    const err = e as { message?: string; response?: { data?: { message?: string } } }
    const message = err.response?.data?.message || err.message || t('auth.loginFailed')
    appStore.showError(message)
    invalidCallback.value = true
  } finally {
    if (!needsRegistrationCompletion.value) {
      isProcessing.value = false
    }
  }
}

async function handleSubmitRegistration() {
  registrationError.value = ''
  if (!registrationEmail.value.trim()) {
    registrationError.value = t('auth.emailRequired')
    return
  }
  if (password.value.length < 6) {
    registrationError.value = t('auth.passwordMinLength')
    return
  }
  if (password.value !== confirmPassword.value) {
    registrationError.value = t('auth.passwordsDoNotMatch')
    return
  }
  const code = invitationCode.value.trim()
  if (invitationRequired.value && !code) return

  isSubmitting.value = true
  try {
    const payload: { password: string; invitation_code?: string; aff_code?: string } = {
      password: password.value,
      ...oauthAffiliatePayload(loadOAuthAffiliateCode())
    }
    if (invitationRequired.value) {
      payload.invitation_code = code
    }
    const { data } = await apiClient.post<OAuthTokenResponse>(
      `/auth/oauth/${pendingProvider.value}/complete-registration`,
      payload
    )
    await finalizeTokenResponse(data, redirectTo.value)
  } catch (e: unknown) {
    const err = e as { message?: string; response?: { data?: { message?: string } } }
    registrationError.value =
      err.response?.data?.message || err.message || t('auth.oidc.completeRegistrationFailed')
  } finally {
    isSubmitting.value = false
  }
}

onMounted(async () => {
  const params = parseFragmentParams()
  const tokenResponse = readTokenResponse(params)
  const fragmentError = params.get('error') || ''
  const fragmentErrorDescription =
    params.get('error_description') || params.get('error_message') || ''

  if (fragmentError) {
    appStore.showError(fragmentErrorDescription || fragmentError)
    return
  }
  if (!tokenResponse) {
    if (route.path === '/auth/oauth/callback') {
      const pendingEmailOAuthProvider = readPendingEmailOAuthProvider()
      if (pendingEmailOAuthProvider && code.value && state.value) {
        redirectProviderCallbackToBackend(pendingEmailOAuthProvider)
        return
      }
      await resumePendingEmailOAuth()
    }
    return
  }

  isProcessing.value = true
  try {
    await finalizeTokenResponse(tokenResponse, params.get('redirect') || '/dashboard')
  } catch (error: unknown) {
    const message = (error as { message?: string })?.message || t('auth.loginFailed')
    appStore.showError(message)
    isProcessing.value = false
  }
})

watch(
  error,
  (message) => {
    if (message) {
      appStore.showError(message)
    }
  },
  { immediate: true }
)

const copy = (value: string) => {
  if (!value) return
  copyToClipboard(value)
}
</script>

<style scoped>
.auth-page {
  min-height: 100vh;
  min-height: 100dvh;
  position: relative;
  overflow: hidden;
  background: var(--bg);
  transition: background var(--dur) var(--ease);
}

.auth-spot {
  position: fixed;
  z-index: 0;
  border-radius: 50%;
  pointer-events: none;
  will-change: transform;
}
.auth-spot-1 {
  width: 420px;
  height: 420px;
  top: -140px;
  left: -120px;
  background: var(--blue);
  opacity: 0.13;
  filter: blur(90px);
  animation: auth-drift-1 26s var(--ease) infinite alternate;
}
.auth-spot-2 {
  width: 380px;
  height: 380px;
  top: 10%;
  right: -140px;
  background: var(--purple);
  opacity: 0.11;
  filter: blur(90px);
  animation: auth-drift-2 30s var(--ease) infinite alternate;
}
.auth-spot-3 {
  width: 460px;
  height: 460px;
  bottom: -180px;
  left: 20%;
  background: var(--teal);
  opacity: 0.1;
  filter: blur(100px);
  animation: auth-drift-3 34s var(--ease) infinite alternate;
}

:global(html.dark) .auth-spot-1 {
  opacity: 0.22;
}
:global(html.dark) .auth-spot-2 {
  opacity: 0.18;
}
:global(html.dark) .auth-spot-3 {
  opacity: 0.16;
}

@keyframes auth-drift-1 {
  from { transform: translate3d(0, 0, 0) scale(1); }
  to   { transform: translate3d(90px, 70px, 0) scale(1.15); }
}
@keyframes auth-drift-2 {
  from { transform: translate3d(0, 0, 0) scale(1); }
  to   { transform: translate3d(-80px, 60px, 0) scale(1.1); }
}
@keyframes auth-drift-3 {
  from { transform: translate3d(0, 0, 0) scale(1); }
  to   { transform: translate3d(-70px, -50px, 0) scale(1.12); }
}

@media (max-width: 560px) {
  .auth-spot-1 { width: 320px; height: 320px; top: -120px; left: -110px; }
  .auth-spot-2 { width: 280px; height: 280px; top: 18%; right: -110px; }
  .auth-spot-3 { width: 340px; height: 340px; bottom: -150px; left: 10%; }
}

@media (prefers-reduced-motion: reduce) {
  .auth-spot {
    animation: none;
  }
}
</style>
