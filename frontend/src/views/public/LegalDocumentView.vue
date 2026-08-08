<template>
  <div class="legal-page">
    <header class="legal-nav glass">
      <div class="legal-nav-inner">
        <RouterLink to="/home" class="flex min-w-0 items-center gap-3">
          <template v-if="settings">
            <span class="legal-wordmark truncate">{{ siteName }}</span>
          </template>
          <template v-else>
            <span class="h-5 w-28 animate-pulse rounded bg-gray-200 dark:bg-dark-700" aria-hidden="true"></span>
          </template>
        </RouterLink>
        <RouterLink
          to="/login"
          class="btn btn-primary btn-sm"
        >
          {{ t('home.login') }}
        </RouterLink>
      </div>
    </header>

    <main class="legal-main">
      <div v-if="loading" class="flex min-h-[320px] items-center justify-center">
        <div class="h-8 w-8 animate-spin rounded-full border-b-2 border-primary-600"></div>
      </div>

      <section
        v-else-if="loadError"
        class="legal-error card"
      >
        <h1 class="text-lg font-semibold">{{ t('legal.loadFailed') }}</h1>
        <p class="mt-2 text-sm">{{ t('legal.retryLater') }}</p>
      </section>

      <section
        v-else-if="!currentDocument"
        class="card"
      >
        <div class="flex items-start gap-3">
          <span class="legal-doc-icon">
            <Icon name="document" size="sm" />
          </span>
          <div>
            <h1 class="text-lg font-semibold">{{ t('legal.notFound') }}</h1>
            <p class="legal-muted mt-2 text-sm leading-6">
              {{ t('legal.notFoundDescription') }}
            </p>
          </div>
        </div>
      </section>

      <article v-else>
        <div class="legal-doc-head">
          <div class="flex items-start gap-4">
            <span class="legal-doc-icon legal-doc-icon-lg">
              <Icon :name="documentIcon" size="md" />
            </span>
            <div class="min-w-0">
              <p class="legal-doc-type">{{ documentTypeLabel }}</p>
              <h1 class="legal-doc-title">
                {{ currentDocument.title }}
              </h1>
              <p v-if="updatedAt" class="legal-muted mt-3 text-sm">
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
          class="legal-empty"
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
const siteName = computed(() => settings.value?.site_name || appStore.siteName || 'Sub2API')
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
.legal-page {
  min-height: 100vh;
  background: var(--bg);
  color: var(--text-primary);
}

/* 48px 磨砂顶栏(与全局导航同语言) */
.legal-nav {
  position: sticky;
  top: 0;
  z-index: 40;
  height: var(--gn-height, 48px);
  border-bottom: 0.5px solid var(--separator);
  box-shadow: var(--glass-highlight);
}

.legal-nav-inner {
  max-width: 780px;
  height: 100%;
  margin: 0 auto;
  padding: 0 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.legal-wordmark {
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.02em;
  color: var(--text-primary);
  white-space: nowrap;
}

.legal-main {
  max-width: 780px;
  margin: 0 auto;
  padding: 48px 20px 80px;
}

.legal-muted {
  color: var(--text-secondary);
}

.legal-doc-icon {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: var(--r-md);
  background: var(--blue-soft);
  color: var(--blue);
}

.legal-doc-icon-lg {
  width: 48px;
  height: 48px;
  border-radius: 14px;
}

.legal-doc-type {
  font-size: 13px;
  font-weight: 600;
  color: var(--blue);
}

.legal-doc-title {
  margin-top: 6px;
  font-size: 30px;
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1.2;
  color: var(--text-primary);
  overflow-wrap: anywhere;
}

.legal-doc-head {
  margin-bottom: 32px;
  padding-bottom: 24px;
  border-bottom: 0.5px solid var(--separator);
}

.legal-error {
  border: 0.5px solid color-mix(in srgb, var(--red) 30%, transparent);
  background: color-mix(in srgb, var(--red) 8%, var(--bg-elevated));
  color: var(--red);
}

.legal-empty {
  padding: 56px 20px;
  text-align: center;
  border: 1px dashed var(--separator-strong);
  border-radius: var(--r-lg);
  color: var(--text-tertiary);
  font-size: 14px;
}

.legal-document-content {
  font-size: 15.5px;
  line-height: 1.85;
  overflow-wrap: anywhere;
  color: inherit;
}

.legal-document-content :deep(h1) {
  margin: 40px 0 16px;
  padding-bottom: 12px;
  border-bottom: 0.5px solid var(--separator);
  font-size: 26px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--text-primary);
}

.legal-document-content :deep(h2) {
  margin: 32px 0 12px;
  font-size: 21px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--text-primary);
}

.legal-document-content :deep(h3) {
  margin: 26px 0 10px;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
}

.legal-document-content :deep(h4) {
  margin: 22px 0 8px;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.legal-document-content :deep(p) {
  margin-bottom: 16px;
  color: var(--text-secondary);
}

.legal-document-content :deep(a) {
  color: var(--blue);
  text-decoration: underline;
  text-underline-offset: 3px;
}
.legal-document-content :deep(a):hover {
  color: var(--blue-hover);
}

.legal-document-content :deep(ul) {
  margin-bottom: 16px;
  padding-left: 22px;
  list-style: disc;
}

.legal-document-content :deep(ol) {
  margin-bottom: 16px;
  padding-left: 22px;
  list-style: decimal;
}

.legal-document-content :deep(li) {
  margin-bottom: 4px;
  color: var(--text-secondary);
}

.legal-document-content :deep(blockquote) {
  margin: 20px 0;
  padding: 2px 0 2px 16px;
  border-left: 3px solid var(--separator-strong);
  color: var(--text-secondary);
}

.legal-document-content :deep(code) {
  border-radius: 6px;
  background: var(--fill);
  padding: 2px 6px;
  font-family: "SF Mono", ui-monospace, Menlo, monospace;
  font-size: 0.88em;
  color: var(--text-primary);
}

.legal-document-content :deep(pre) {
  margin: 20px 0;
  overflow-x: auto;
  border-radius: var(--r-md);
  background: var(--bg-elevated);
  border: 0.5px solid var(--separator);
  padding: 16px;
  color: var(--text-secondary);
  box-shadow: var(--shadow-card);
}

.legal-document-content :deep(pre code) {
  background: transparent;
  padding: 0;
  color: inherit;
}

.legal-document-content :deep(table) {
  margin: 20px 0;
  display: block;
  width: 100%;
  overflow-x: auto;
  border-collapse: collapse;
}

.legal-document-content :deep(th) {
  border: 0.5px solid var(--separator);
  background: var(--fill);
  padding: 8px 12px;
  text-align: left;
  font-weight: 600;
  color: var(--text-primary);
}

.legal-document-content :deep(td) {
  border: 0.5px solid var(--separator);
  padding: 8px 12px;
  color: var(--text-secondary);
}

.legal-document-content :deep(img) {
  margin: 20px 0;
  height: auto;
  max-width: 100%;
  border-radius: var(--r-md);
}

.legal-document-content :deep(hr) {
  margin: 28px 0;
  border: none;
  height: 0.5px;
  background: var(--separator);
}
</style>
