<template>
  <div>
    <!-- 铃铛按钮 -->
    <button
      @click="openModal"
      class="bell-btn"
      :class="{ 'has-unread': unreadCount > 0 }"
      :aria-label="t('announcements.title')"
    >
      <Icon name="bell" size="md" />
      <!-- 未读红点：静态，对齐 demo 的 .gn-icon-btn .badge-dot -->
      <span v-if="unreadCount > 0" class="bell-dot" data-testid="announcement-bell-dot"></span>
    </button>

    <!-- 公告列表 Modal -->
    <Teleport to="body">
      <Transition name="modal-fade">
        <div
          v-if="isModalOpen"
          class="ann-overlay"
          @click="closeModal"
        >
          <div
            ref="listPanelRef"
            class="ann-panel w-full max-w-[620px]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="announcement-list-title"
            aria-describedby="announcement-list-desc"
            tabindex="-1"
            @click.stop
          >
            <!-- Header：发丝线分隔，无渐变无光斑 -->
            <div class="ann-head">
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <div class="flex items-center gap-2">
                    <span class="ann-mark ann-mark-sm">
                      <Icon name="bell" size="sm" />
                    </span>
                    <h2 id="announcement-list-title" class="ann-head-title">
                      {{ t('announcements.title') }}
                    </h2>
                  </div>
                  <p v-if="unreadCount > 0" class="ann-head-sub">
                    <span class="ann-head-count">{{ unreadCount }}</span>
                    {{ t('announcements.unread') }}
                  </p>
                </div>
                <div class="flex flex-shrink-0 items-center gap-2">
                  <button
                    v-if="unreadCount > 0"
                    @click="markAllAsRead"
                    :disabled="loading"
                    class="btn btn-primary btn-sm"
                  >
                    {{ t('announcements.markAllRead') }}
                  </button>
                  <button
                    @click="closeModal"
                    class="ann-close"
                    :aria-label="t('common.close')"
                  >
                    <Icon name="x" size="sm" />
                  </button>
                </div>
              </div>
            </div>

            <!-- Body -->
            <div id="announcement-list-desc" class="ann-list">
              <!-- Loading -->
              <div v-if="loading" class="ann-state">
                <span class="ann-spinner"></span>
              </div>

              <!-- Announcements List -->
              <div v-else-if="announcements.length > 0">
                <div
                  v-for="item in announcements"
                  :key="item.id"
                  class="ann-row"
                  :class="{ 'is-unread': !item.read_at }"
                  role="button"
                  tabindex="0"
                  @click="openDetail(item)"
                  @keydown.enter.prevent="openDetail(item)"
                  @keydown.space.prevent="openDetail(item)"
                >
                  <!-- Status Indicator -->
                  <span class="ann-row-mark" :class="item.read_at ? 'is-read' : 'is-unread'">
                    <svg v-if="!item.read_at" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </span>

                  <!-- Content -->
                  <div class="flex min-w-0 flex-1 items-center justify-between gap-3">
                    <div class="min-w-0 flex-1">
                      <h3 class="ann-row-title">{{ item.title }}</h3>
                      <div class="mt-1 flex items-center gap-2">
                        <time class="ann-row-time">{{ formatRelativeTime(item.created_at) }}</time>
                        <span v-if="!item.read_at" class="badge badge-primary">
                          {{ t('announcements.unread') }}
                        </span>
                      </div>
                    </div>

                    <!-- Arrow -->
                    <svg class="ann-row-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </div>

              <!-- Empty State -->
              <div v-else class="ann-state ann-empty">
                <span class="ann-empty-mark">
                  <Icon name="inbox" size="xl" />
                </span>
                <p class="ann-empty-title">{{ t('announcements.empty') }}</p>
                <p class="ann-empty-sub">{{ t('announcements.emptyDescription') }}</p>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- 公告详情 Modal -->
    <Teleport to="body">
      <Transition name="modal-fade">
        <div
          v-if="detailModalOpen && selectedAnnouncement"
          class="ann-overlay"
          @click="closeDetail"
        >
          <div
            ref="detailPanelRef"
            class="ann-panel w-full max-w-[780px]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="announcement-detail-title"
            aria-describedby="announcement-detail-desc"
            tabindex="-1"
            @click.stop
          >
            <!-- Header：发丝线分隔，无渐变无光斑 -->
            <div class="ann-head">
              <div class="flex items-start justify-between gap-4">
                <div class="min-w-0 flex-1">
                  <div class="mb-3 flex flex-wrap items-center gap-2">
                    <span class="ann-mark">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </span>
                    <span class="badge badge-gray">{{ t('announcements.title') }}</span>
                    <span v-if="!selectedAnnouncement.read_at" class="badge badge-primary">
                      {{ t('announcements.unread') }}
                    </span>
                  </div>

                  <h2 id="announcement-detail-title" class="ann-title">
                    {{ selectedAnnouncement.title }}
                  </h2>

                  <div class="ann-meta-row">
                    <span class="ann-meta">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <time>{{ formatRelativeWithDateTime(selectedAnnouncement.created_at) }}</time>
                    </span>
                    <span class="ann-meta">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      <span>{{ selectedAnnouncement.read_at ? t('announcements.read') : t('announcements.unread') }}</span>
                    </span>
                  </div>
                </div>

                <button
                  @click="closeDetail"
                  class="ann-close"
                  :aria-label="t('common.close')"
                >
                  <Icon name="x" size="md" />
                </button>
              </div>
            </div>

            <!-- Body：继承不透明面板底色 -->
            <div id="announcement-detail-desc" class="ann-body ann-body-tall">
              <div
                class="markdown-body"
                v-html="renderMarkdown(selectedAnnouncement.content)"
              ></div>
            </div>

            <!-- Footer -->
            <div class="ann-foot ann-foot-split">
              <span class="ann-foot-hint">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{{ selectedAnnouncement.read_at ? t('announcements.readStatus') : t('announcements.markReadHint') }}</span>
              </span>
              <div class="flex flex-shrink-0 items-center gap-3">
                <button @click="closeDetail" class="btn btn-secondary">
                  {{ t('common.close') }}
                </button>
                <button
                  v-if="!selectedAnnouncement.read_at"
                  @click="markAsReadAndClose(selectedAnnouncement.id)"
                  class="btn btn-primary"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  {{ t('announcements.markRead') }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onBeforeUnmount, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { useAppStore } from '@/stores/app'
import { useAnnouncementStore } from '@/stores/announcements'
import { formatRelativeTime, formatRelativeWithDateTime } from '@/utils/format'
import { lockBodyScroll, unlockBodyScroll } from '@/composables/useCommandPalette'
import { useFocusTrap } from '@/composables/useFocusTrap'
import type { UserAnnouncement } from '@/types'
import Icon from '@/components/icons/Icon.vue'
import '@/styles/announcement-markdown.css'

const { t } = useI18n()
const appStore = useAppStore()
const announcementStore = useAnnouncementStore()

// Configure marked
marked.setOptions({
  breaks: true,
  gfm: true,
})

// Use store state (storeToRefs for reactivity)
const { announcements, loading } = storeToRefs(announcementStore)
const unreadCount = computed(() => announcementStore.unreadCount)

// Local modal state
const isModalOpen = ref(false)
const detailModalOpen = ref(false)
const selectedAnnouncement = ref<UserAnnouncement | null>(null)
const listPanelRef = ref<HTMLElement | null>(null)
const detailPanelRef = ref<HTMLElement | null>(null)

// Methods
function renderMarkdown(content: string): string {
  if (!content) return ''
  const html = marked.parse(content) as string
  return DOMPurify.sanitize(html)
}

function openModal() {
  isModalOpen.value = true
}

function closeModal() {
  isModalOpen.value = false
}

function openDetail(announcement: UserAnnouncement) {
  selectedAnnouncement.value = announcement
  detailModalOpen.value = true
  if (!announcement.read_at) {
    markAsRead(announcement.id)
  }
}

function closeDetail() {
  detailModalOpen.value = false
  selectedAnnouncement.value = null
}

async function markAsRead(id: number) {
  try {
    await announcementStore.markAsRead(id)
  } catch (err: any) {
    appStore.showError(err?.message || t('common.unknownError'))
  }
}

async function markAsReadAndClose(id: number) {
  await markAsRead(id)
  appStore.showSuccess(t('announcements.markedAsRead'))
  closeDetail()
}

async function markAllAsRead() {
  try {
    await announcementStore.markAllAsRead()
    appStore.showSuccess(t('announcements.allMarkedAsRead'))
  } catch (err: any) {
    appStore.showError(err?.message || t('common.unknownError'))
  }
}

onBeforeUnmount(() => {
  if (escListenerAttached) {
    document.removeEventListener('keydown', handleLayerKeydown)
    escListenerAttached = false
  }
  releaseLock()
})

/*
 * 两层浮层的真 modal 焦点管理：列表与详情各一个焦点陷阱。
 *
 * Esc 不放进陷阱：两个浮层共用一个组件级文档监听，按自身层栈路由到最顶层
 * （详情 → 列表），再 stopImmediatePropagation 挡住其他组件注册的 Esc
 * 监听 —— 例如全局公告弹窗盖在列表上时，弹窗后注册先执行，本组件不会在同
 * 一次按键里把列表一起关掉。只关详情时列表保持打开、滚动锁保持持有。
 *
 * 详情关闭后焦点还给触发行（列表仍在陷阱内），列表关闭后焦点还给铃铛。
 */
useFocusTrap({
  containerRef: listPanelRef,
  isActive: isModalOpen,
})

useFocusTrap({
  containerRef: detailPanelRef,
  isActive: detailModalOpen,
})

let escListenerAttached = false

function handleLayerKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape') return
  event.preventDefault()
  event.stopImmediatePropagation()
  if (detailModalOpen.value) {
    closeDetail()
  } else if (isModalOpen.value) {
    closeModal()
  }
}

/*
 * 滚动锁定走 useCommandPalette 的引用计数锁，不再直写 body.style.overflow。
 * ⌘K 命令面板与移动端汉堡菜单锁同一个 body；直写会与计数器互相破坏
 * （详见 GlobalNav.vue 的同款说明与 AnnouncementPopup.vue 的注释）。
 *
 * 只跟自己的两个浮层：列表与详情。announcementStore.currentPopup 由
 * AnnouncementPopup 自己持锁 —— 它在 App.vue 全局挂载，铃铛不必代管，
 * 代管反而会在未登录（铃铛不挂载）时留下无人释放的锁。
 */
let holdsLock = false

function releaseLock() {
  if (holdsLock) {
    unlockBodyScroll()
    holdsLock = false
  }
}

watch([isModalOpen, detailModalOpen], ([modal, detail]) => {
  const wantsLock = modal || detail
  if (wantsLock && !holdsLock) {
    lockBodyScroll()
    holdsLock = true
  } else if (!wantsLock) {
    releaseLock()
  }

  if (wantsLock && !escListenerAttached) {
    document.addEventListener('keydown', handleLayerKeydown)
    escListenerAttached = true
  } else if (!wantsLock && escListenerAttached) {
    document.removeEventListener('keydown', handleLayerKeydown)
    escListenerAttached = false
  }
})
</script>

<style scoped>
/* 铃铛按钮：药丸 + fill 悬停 */
.bell-btn {
  position: relative;
  display: flex;
  height: 36px;
  width: 36px;
  align-items: center;
  justify-content: center;
  border-radius: var(--r-pill);
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: background 0.18s var(--ease), color 0.18s var(--ease), transform 0.12s var(--ease);
}

.bell-btn:hover {
  background: var(--fill);
  color: var(--text-primary);
  transform: scale(1.04);
}

.bell-btn:active {
  transform: scale(0.94);
}

.bell-btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 4px var(--blue-soft);
}

/* 有未读时铃铛本体变蓝 */
.bell-btn.has-unread {
  color: var(--blue);
}

/* 未读红点：静态，描边取页面底色以在顶栏玻璃上分离 */
.bell-dot {
  position: absolute;
  top: 5px;
  right: 6px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--red);
  border: 1.5px solid var(--bg);
}

/* 契约镜像：纱幕压暗（亮 18% / 暗 45% 黑），不透明面板 */
.ann-overlay {
  position: fixed;
  inset: 0;
  z-index: 130;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  overflow-y: auto;
  background: rgba(0, 0, 0, 0.18);
  padding: 16px;
  padding-top: 8vh;
}

:global(html.dark) .ann-overlay {
  background: rgba(0, 0, 0, 0.45);
}

.ann-panel {
  overflow: hidden;
  border-radius: var(--r-xl);
  background: var(--glass-bg-strong);
  border: 0.5px solid var(--separator);
  box-shadow: var(--glass-highlight), var(--shadow-pop);
}

/* ---- 头部 ---- */
.ann-head {
  padding: 20px 24px 18px;
  border-bottom: 0.5px solid var(--separator);
}

.ann-mark {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: var(--r-md);
  background: var(--blue-soft);
  color: var(--blue);
  flex-shrink: 0;
}

.ann-mark svg {
  width: 18px;
  height: 18px;
}

.ann-mark-sm {
  width: 28px;
  height: 28px;
  border-radius: var(--r-sm);
}

.ann-head-title {
  font-size: 17px;
  font-weight: 600;
  letter-spacing: -0.02em;
  color: var(--text-primary);
}

.ann-head-sub {
  margin-top: 6px;
  font-size: 13px;
  color: var(--text-secondary);
}

.ann-head-count {
  font-weight: 600;
  color: var(--blue);
}

.ann-title {
  font-size: 22px;
  font-weight: 700;
  line-height: 1.25;
  letter-spacing: -0.03em;
  color: var(--text-primary);
}

.ann-meta-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px;
  margin-top: 8px;
}

.ann-meta {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--text-secondary);
}

.ann-meta svg {
  width: 15px;
  height: 15px;
  color: var(--text-tertiary);
  flex-shrink: 0;
}

/* 关闭按钮：透明底 + fill 悬停，不用半透明白底 */
.ann-close {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  flex-shrink: 0;
  border: none;
  border-radius: var(--r-pill);
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: background 0.18s var(--ease), color 0.18s var(--ease), transform 0.12s var(--ease);
}

.ann-close:hover {
  background: var(--fill);
  color: var(--text-primary);
}

.ann-close:active {
  transform: scale(0.94);
}

.ann-close:focus-visible {
  outline: none;
  box-shadow: 0 0 0 4px var(--blue-soft);
}

/* ---- 列表 ---- */
.ann-list {
  max-height: 65vh;
  overflow-y: auto;
}

.ann-row {
  display: flex;
  align-items: center;
  gap: 14px;
  min-height: 72px;
  padding: 14px 24px;
  border-bottom: 0.5px solid var(--separator);
  cursor: pointer;
  transition: background 0.14s var(--ease);
}

.ann-row:last-child {
  border-bottom: none;
}

.ann-row:hover {
  background: var(--fill);
}

.ann-row:focus-visible {
  outline: none;
  box-shadow: inset 0 0 0 3px var(--blue-soft);
}

.ann-row.is-unread {
  background: var(--blue-soft);
}

.ann-row.is-unread:hover {
  background: var(--fill-hover);
}

.ann-row-mark {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  border-radius: var(--r-md);
}

.ann-row-mark svg {
  width: 18px;
  height: 18px;
}

.ann-row-mark.is-unread {
  background: var(--blue);
  color: #fff;
}

.ann-row-mark.is-read {
  background: var(--fill);
  color: var(--text-tertiary);
}

.ann-row-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13.5px;
  font-weight: 500;
  color: var(--text-primary);
}

.ann-row-time {
  font-size: 12px;
  color: var(--text-tertiary);
}

.ann-row-chev {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  color: var(--text-tertiary);
  transition: transform 0.2s var(--ease);
}

.ann-row:hover .ann-row-chev {
  transform: translateX(3px);
  color: var(--text-secondary);
}

/* ---- 加载 / 空状态 ---- */
.ann-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 56px 20px;
}

.ann-spinner {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 2.5px solid var(--fill-hover);
  border-top-color: var(--blue);
  animation: ann-spin 0.7s linear infinite;
}

@keyframes ann-spin {
  to {
    transform: rotate(360deg);
  }
}

.ann-empty-mark {
  display: grid;
  place-items: center;
  width: 64px;
  height: 64px;
  margin-bottom: 14px;
  border-radius: var(--r-pill);
  background: var(--fill);
  color: var(--text-tertiary);
}

.ann-empty-title {
  font-size: 13.5px;
  font-weight: 500;
  color: var(--text-primary);
}

.ann-empty-sub {
  margin-top: 4px;
  font-size: 12px;
  color: var(--text-tertiary);
}

/* ---- 详情正文：继承面板底色 ---- */
.ann-body {
  max-height: 50vh;
  overflow-y: auto;
  padding: 24px 28px;
}

.ann-body-tall {
  max-height: 60vh;
}

/* ---- 页脚 ---- */
.ann-foot {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 28px;
  border-top: 0.5px solid var(--separator);
}

.ann-foot-split {
  justify-content: space-between;
}

.ann-foot-hint {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  font-size: 12px;
  color: var(--text-tertiary);
}

.ann-foot-hint svg {
  width: 15px;
  height: 15px;
  flex-shrink: 0;
}

/* Modal Animations */
.modal-fade-enter-active {
  transition: opacity 0.3s var(--ease);
}

.modal-fade-leave-active {
  transition: opacity 0.2s var(--ease);
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.modal-fade-enter-from > div {
  transform: scale(0.94) translateY(-12px);
  opacity: 0;
}

.modal-fade-leave-to > div {
  transform: scale(0.96) translateY(-8px);
  opacity: 0;
}

/* 滚动条：Apple 风格细条，消费变量而非硬编码灰阶。
   （旧实现挂在 .overflow-y-auto 上且用 .dark 作根，两处都已失效：
     容器已改名为 .ann-list / .ann-body，且本仓库暗色根是 html.dark） */
.ann-list::-webkit-scrollbar,
.ann-body::-webkit-scrollbar {
  width: 8px;
}

.ann-list::-webkit-scrollbar-track,
.ann-body::-webkit-scrollbar-track {
  background: transparent;
}

.ann-list::-webkit-scrollbar-thumb,
.ann-body::-webkit-scrollbar-thumb {
  background: var(--fill-hover);
  border-radius: var(--r-pill);
  border: 2px solid transparent;
  background-clip: padding-box;
}

.ann-list::-webkit-scrollbar-thumb:hover,
.ann-body::-webkit-scrollbar-thumb:hover {
  background: var(--text-tertiary);
  background-clip: padding-box;
  border: 2px solid transparent;
}
</style>
