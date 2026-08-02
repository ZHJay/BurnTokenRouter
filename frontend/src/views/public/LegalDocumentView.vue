<template>
  <div class="min-h-screen text-gray-900 dark:text-white" style="background-color: var(--bg-base)">
    <!-- Floating chrome: regular material, content scrolls beneath -->
    <header class="glass sticky top-0 z-30" style="box-shadow: inset 0 -0.5px 0 var(--separator)">
      <div class="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <RouterLink to="/home" class="flex min-w-0 items-center gap-3">
          <template v-if="settings">
            <span
              class="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl shadow-elev-1"
              style="background: var(--surface); box-shadow: inset 0 0 0 0.5px var(--hairline), var(--shadow-1)"
            >
              <img :src="siteLogo || '/logo.svg'" alt="Logo" class="h-full w-full object-contain" />
            </span>
            <span class="on-glass truncate text-base font-semibold tracking-[-0.01em] text-gray-950 dark:text-white">
              {{ siteName }}
            </span>
          </template>
          <template v-else>
            <span class="skeleton h-10 w-10 flex-shrink-0 !rounded-xl" aria-hidden="true"></span>
            <span class="skeleton h-5 w-28" aria-hidden="true"></span>
          </template>
        </RouterLink>
        <RouterLink
          to="/login"
          class="btn btn-primary flex-shrink-0"
        >
          {{ t('home.login') }}
        </RouterLink>
      </div>
    </header>

    <main class="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:py-10">
      <div v-if="loading" class="flex min-h-[320px] items-center justify-center">
        <div class="spinner h-8 w-8 text-primary-600 dark:text-primary-400"></div>
      </div>

      <section
        v-else-if="loadError"
        class="rounded-xl p-6 text-red-700 dark:text-red-200"
        style="background: rgb(255 59 48 / 0.12); box-shadow: inset 0 0 0 0.5px rgb(255 59 48 / 0.26)"
      >
        <h1 class="text-lg font-semibold tracking-[-0.014em]">{{ t('legal.loadFailed') }}</h1>
        <p class="mt-2 text-[13px]">{{ t('legal.retryLater') }}</p>
      </section>

      <section
        v-else-if="!currentDocument"
        class="card p-6"
      >
        <div class="flex items-start gap-3">
          <span class="card-inset flex h-10 w-10 flex-shrink-0 items-center justify-center text-gray-600 dark:text-dark-300">
            <Icon name="document" size="sm" />
          </span>
          <div>
            <h1 class="text-lg font-semibold tracking-[-0.014em] text-gray-900 dark:text-white">{{ t('legal.notFound') }}</h1>
            <p class="mt-2 text-[13px] leading-6 text-gray-600 dark:text-dark-300">
              {{ t('legal.notFoundDescription') }}
            </p>
          </div>
        </div>
      </section>

      <article v-else>
        <div class="mb-8 pb-6" style="box-shadow: inset 0 -0.5px 0 var(--separator)">
          <div class="flex items-start gap-4">
            <span
              class="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg text-primary-700 dark:text-primary-300"
              style="background: var(--accent-tint)"
            >
              <Icon :name="documentIcon" size="md" />
            </span>
            <div class="min-w-0">
              <p class="text-xs font-semibold text-primary-700 dark:text-primary-300">{{ documentTypeLabel }}</p>
              <h1 class="mt-2 break-words text-2xl font-bold tracking-[-0.024em] text-gray-950 dark:text-white sm:text-3xl">
                {{ currentDocument.title }}
              </h1>
              <p v-if="updatedAt" class="mt-3 text-[13px] text-gray-500 dark:text-dark-400">
                {{ t('legal.updatedAt', { date: updatedAt }) }}
              </p>
            </div>
          </div>
        </div>

        <div
          v-if="hasContent"
          class="legal-document-content"
          v-html="renderedHtml"
        ></div>
        <div
          v-else
          class="card-inset px-6 py-14 text-center text-[13px] text-gray-500 dark:text-dark-400"
        >
          {{ t('legal.empty') }}
        </div>
      </article>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { useI18n } from 'vue-i18n'
import Icon from '@/components/icons/Icon.vue'
import { getLocale } from '@/i18n'
import { sanitizeUrl } from '@/utils/url'
import { useAppStore } from '@/stores/app'
import type { LoginAgreementDocument } from '@/types'
import zhAdminCompliance from '../../../../docs/legal/admin-compliance.zh.md?raw'
import enAdminCompliance from '../../../../docs/legal/admin-compliance.en.md?raw'

type LegalDocumentIcon = 'document' | 'shield' | 'globe' | 'cog'

const route = useRoute()
const { t } = useI18n()
const appStore = useAppStore()
const settings = computed(() => appStore.cachedPublicSettings)
const loading = ref(!settings.value)
const loadError = ref(false)

marked.setOptions({
  breaks: true,
  gfm: true,
})

const documentId = computed(() => String(route.params.documentId || ''))
const isAdminComplianceDocument = computed(() => documentId.value === 'admin-compliance')
const documents = computed(() => settings.value?.login_agreement_documents ?? [])
const siteName = computed(() => settings.value?.site_name || 'Sub2API')
const siteLogo = computed(() => sanitizeUrl(settings.value?.site_logo || '', {
  allowRelative: true,
  allowDataUrl: true,
}))
const updatedAt = computed(() =>
  isAdminComplianceDocument.value ? '' : settings.value?.login_agreement_updated_at || ''
)
const documentTypeLabel = computed(() =>
  isAdminComplianceDocument.value ? t('legal.adminCompliance') : t('legal.loginAgreement')
)

const currentDocument = computed<LoginAgreementDocument | null>(() => {
  if (isAdminComplianceDocument.value) {
    return {
      id: 'admin-compliance',
      title: t('adminCompliance.title'),
      content_md: getLocale() === 'zh' ? zhAdminCompliance : enAdminCompliance
    }
  }
  const id = documentId.value
  if (!id) {
    return null
  }
  return documents.value.find((doc) => doc.id === id) ?? null
})

const hasContent = computed(() => Boolean(currentDocument.value?.content_md?.trim()))

const renderedHtml = computed(() => {
  const content = currentDocument.value?.content_md?.trim() || ''
  if (!content) {
    return ''
  }
  const html = marked.parse(content) as string
  return DOMPurify.sanitize(html)
})

const documentIcon = computed<LegalDocumentIcon>(() => {
  const title = currentDocument.value?.title || ''
  if (title.includes('政策') || title.includes('隐私')) {
    return 'shield'
  }
  if (title.includes('国家') || title.includes('地区')) {
    return 'globe'
  }
  if (title.includes('特定')) {
    return 'cog'
  }
  return 'document'
})

onMounted(async () => {
  loadError.value = false
  const loadedSettings = await appStore.fetchPublicSettings()
  if (!loadedSettings) {
    loadError.value = true
  }
  loading.value = false
})
</script>

<style scoped>
.legal-document-content {
  line-height: 1.75;
  overflow-wrap: anywhere;
  color: inherit;
}

.legal-document-content :deep(h1) {
  @apply mb-4 mt-8 pb-3 text-3xl font-bold;
  letter-spacing: -0.024em;
  border: 0;
  box-shadow: inset 0 -0.5px 0 var(--separator);
}

.legal-document-content :deep(h2) {
  @apply mb-3 mt-7 text-2xl font-bold;
  letter-spacing: -0.022em;
}

.legal-document-content :deep(h3) {
  @apply mb-2 mt-6 text-xl font-semibold;
  letter-spacing: -0.014em;
}

.legal-document-content :deep(h4) {
  @apply mb-2 mt-5 text-lg font-semibold;
}

.legal-document-content :deep(p) {
  @apply mb-4 text-gray-700 dark:text-dark-200;
}

.legal-document-content :deep(a) {
  @apply text-primary-600 underline underline-offset-4 hover:text-primary-700 dark:text-primary-300 dark:hover:text-primary-200;
}

.legal-document-content :deep(ul) {
  @apply mb-4 list-disc pl-6;
}

.legal-document-content :deep(ol) {
  @apply mb-4 list-decimal pl-6;
}

.legal-document-content :deep(li) {
  @apply mb-1 text-gray-700 dark:text-dark-200;
}

.legal-document-content :deep(blockquote) {
  @apply my-5 pl-4 text-gray-600 dark:text-dark-300;
  border-left: 3px solid var(--separator);
}

.legal-document-content :deep(code) {
  @apply rounded-md px-1.5 py-0.5 font-mono text-sm;
  background-color: var(--surface-secondary);
  box-shadow: inset 0 0 0 0.5px var(--separator);
}

.legal-document-content :deep(pre) {
  @apply my-5 overflow-x-auto rounded-xl p-4;
  background-color: #1c1c1e;
  color: rgb(255 255 255 / 0.94);
}

.legal-document-content :deep(pre code) {
  @apply bg-transparent p-0 text-inherit;
  box-shadow: none;
}

.legal-document-content :deep(table) {
  @apply my-5 block w-full overflow-x-auto border-collapse;
}

.legal-document-content :deep(th) {
  @apply px-3 py-2 text-left font-semibold;
  background-color: var(--surface-secondary);
  border: 0;
  box-shadow: inset 0 0 0 0.5px var(--separator);
}

.legal-document-content :deep(td) {
  @apply px-3 py-2;
  border: 0;
  box-shadow: inset 0 0 0 0.5px var(--separator);
}

.legal-document-content :deep(img) {
  @apply my-5 h-auto max-w-full rounded-lg;
}

.legal-document-content :deep(hr) {
  @apply my-7;
  border: 0;
  height: 0.5px;
  background-color: var(--separator);
}
</style>
