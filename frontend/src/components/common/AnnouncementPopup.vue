<template>
  <Teleport to="body">
    <Transition name="popup-fade">
      <div
        v-if="displayedAnnouncement"
        class="ann-overlay"
      >
        <div
          ref="panelRef"
          class="ann-panel w-full max-w-[680px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="announcement-popup-title"
          aria-describedby="announcement-popup-desc"
          tabindex="-1"
          @click.stop
        >
          <!-- Header：发丝线分隔，无渐变无光斑（浮出层是不透明面板） -->
          <div class="ann-head">
            <div class="mb-3 flex items-center gap-2">
              <span class="ann-mark">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </span>
              <span class="badge badge-primary">{{ t('announcements.unread') }}</span>
            </div>

            <h2 id="announcement-popup-title" class="ann-title">
              {{ displayedAnnouncement.title }}
            </h2>

            <div class="ann-meta">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <time>{{ formatRelativeWithDateTime(displayedAnnouncement.created_at) }}</time>
            </div>
          </div>

          <!-- Body：不设自己的底色，继承不透明面板 -->
          <div id="announcement-popup-desc" class="ann-body">
            <div
              class="markdown-body"
              v-html="renderedContent"
            ></div>
          </div>

          <!-- Footer -->
          <div class="ann-foot">
            <button
              @click="handleDismiss"
              data-testid="announcement-popup-dismiss"
              class="btn btn-primary"
            >
              <svg v-if="preview" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
              <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              {{ preview ? t('common.close') : t('announcements.markRead') }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { useAnnouncementStore } from '@/stores/announcements'
import { formatRelativeWithDateTime } from '@/utils/format'
import { lockBodyScroll, unlockBodyScroll } from '@/composables/useCommandPalette'
import { useFocusTrap } from '@/composables/useFocusTrap'
import type { Announcement, UserAnnouncement } from '@/types'
import '@/styles/announcement-markdown.css'

type PreviewAnnouncement = Pick<Announcement | UserAnnouncement, 'title' | 'content' | 'created_at'>

const props = withDefaults(defineProps<{
  announcement?: PreviewAnnouncement | null
  preview?: boolean
}>(), {
  announcement: null,
  preview: false,
})

const emit = defineEmits<{
  close: []
}>()

const { t } = useI18n()
const announcementStore = useAnnouncementStore()
const displayedAnnouncement = computed(() => (
  props.preview ? props.announcement : announcementStore.currentPopup
))
const panelRef = ref<HTMLElement | null>(null)
const isPopupActive = computed(() => !!displayedAnnouncement.value)

marked.setOptions({
  breaks: true,
  gfm: true,
})

const renderedContent = computed(() => {
  const content = displayedAnnouncement.value?.content
  if (!content) return ''
  const html = marked.parse(content) as string
  return DOMPurify.sanitize(html)
})

function handleDismiss() {
  if (props.preview) {
    emit('close')
    return
  }
  announcementStore.dismissPopup()
}

/*
 * 真 modal：焦点进入 / Tab 陷阱 / Esc 关闭并还焦给触发元素 / 背景对读屏隐藏。
 * 契约与 ⌘K 命令面板一致（那是全仓库 a11y 实测全过的参考实现）；滚动锁仍由
 * 下面的 watch 单独持有，二者互不干扰。
 *
 * Esc 由本组件唯一的一个文档监听处理（不再依赖属性层）：stopImmediate-
 * Propagation 保证同一按键不会连带关掉下层浮层（例如弹窗盖在铃铛列表上时，
 * 弹窗后注册先执行，铃铛的监听被挡住，列表保持打开）。
 */
useFocusTrap({
  containerRef: panelRef,
  isActive: isPopupActive,
})

let escListenerAttached = false

function handlePopupKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape') return
  event.preventDefault()
  event.stopImmediatePropagation()
  handleDismiss()
}

watch(
  isPopupActive,
  (active) => {
    if (active && !escListenerAttached) {
      document.addEventListener('keydown', handlePopupKeydown)
      escListenerAttached = true
    } else if (!active && escListenerAttached) {
      document.removeEventListener('keydown', handlePopupKeydown)
      escListenerAttached = false
    }
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  if (escListenerAttached) {
    document.removeEventListener('keydown', handlePopupKeydown)
    escListenerAttached = false
  }
  releaseLock()
})

/*
 * 滚动锁定走 useCommandPalette 的引用计数锁，不再直写 body.style.overflow。
 *
 * 为什么必须用计数锁：⌘K 命令面板与移动端汉堡菜单锁的是同一个 body。直写会
 * 与计数器互相破坏 —— 本弹窗直写 'hidden' 后，命令面板打开时会把 'hidden'
 * 记成"原始值"，等它关闭就把 'hidden' 永久还原回去，页面再也滚不动。
 *
 * 本组件只负责自己这一把锁（本地 holdsLock 保证配对，重复开不会多加计数），
 * 铃铛组件负责它自己的两个浮层。旧实现里"只加不减、由铃铛代还"的写法还有个
 * 潜在缺陷：未登录时铃铛不挂载，弹窗关掉后就没人还锁了。
 */
let holdsLock = false

function releaseLock() {
  if (holdsLock) {
    unlockBodyScroll()
    holdsLock = false
  }
}

watch(
  displayedAnnouncement,
  (popup) => {
    if (popup && !holdsLock) {
      lockBodyScroll()
      holdsLock = true
    } else if (!popup) {
      releaseLock()
    }
  },
  { immediate: true },
)

</script>

<style scoped>
.ann-overlay {
  /* 契约镜像：纱幕压暗（亮 18% / 暗 45% 黑） */
  position: fixed;
  inset: 0;
  z-index: 140;
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
  /* 契约镜像：不透明浮出面板 */
  overflow: hidden;
  border-radius: var(--r-xl);
  background: var(--glass-bg-strong);
  border: 0.5px solid var(--separator);
  box-shadow: var(--glass-highlight), var(--shadow-pop);
}

/* ---- 头部：发丝线分隔，不用渐变/光斑（玻璃质感只保留顶栏/登录卡/ambient） ---- */
.ann-head {
  padding: 24px 28px 20px;
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

.ann-title {
  font-size: 22px;
  font-weight: 700;
  line-height: 1.25;
  letter-spacing: -0.03em;
  color: var(--text-primary);
}

.ann-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  font-size: 13px;
  color: var(--text-secondary);
}

.ann-meta svg {
  width: 15px;
  height: 15px;
  color: var(--text-tertiary);
  flex-shrink: 0;
}

/* ---- 正文：继承面板底色，不再自带 bg-white/dark ---- */
.ann-body {
  max-height: 50vh;
  overflow-y: auto;
  padding: 24px 28px;
}

/* ---- 页脚 ---- */
.ann-foot {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 16px 28px;
  border-top: 0.5px solid var(--separator);
}

.popup-fade-enter-active {
  transition: opacity 0.3s var(--ease);
}

.popup-fade-leave-active {
  transition: opacity 0.2s var(--ease);
}

.popup-fade-enter-from,
.popup-fade-leave-to {
  opacity: 0;
}

.popup-fade-enter-from > div {
  transform: scale(0.94) translateY(-12px);
  opacity: 0;
}

.popup-fade-leave-to > div {
  transform: scale(0.96) translateY(-8px);
  opacity: 0;
}

/* 滚动条：Apple 风格细条，消费变量而非硬编码灰阶 */
.ann-body::-webkit-scrollbar {
  width: 8px;
}

.ann-body::-webkit-scrollbar-track {
  background: transparent;
}

.ann-body::-webkit-scrollbar-thumb {
  background: var(--fill-hover);
  border-radius: var(--r-pill);
  border: 2px solid transparent;
  background-clip: padding-box;
}

.ann-body::-webkit-scrollbar-thumb:hover {
  background: var(--text-tertiary);
  background-clip: padding-box;
  border: 2px solid transparent;
}
</style>
