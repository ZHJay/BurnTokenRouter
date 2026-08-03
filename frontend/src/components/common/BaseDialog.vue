<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="show"
        class="modal-overlay"
        :style="zIndexStyle"
        @click.self="handleClose"
      >
        <!--
          Modal panel. role/aria-modal/aria-labelledby belong here, not on the
          overlay above: the overlay is a full-viewport scrim, so naming it as
          the dialog makes the dialog boundary the whole screen and leaves the
          actual panel as unnamed content inside it.

          tabindex="-1" is a fallback focus target for dialogs whose body has
          nothing focusable — focus must not be left behind in the now-inert
          background.
        -->
        <div
          ref="dialogRef"
          :class="['modal-content', widthClasses]"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="dialogId"
          tabindex="-1"
          @click.stop
        >
          <!-- Header -->
          <div class="modal-header">
            <h3 :id="dialogId" class="modal-title">
              {{ title }}
            </h3>
            <button
              v-if="showCloseButton"
              @click="emit('close')"
              class="btn btn-ghost btn-icon -mr-2"
              aria-label="Close modal"
            >
              <Icon name="x" size="md" />
            </button>
          </div>

          <!-- Body -->
          <div class="modal-body">
            <slot></slot>
          </div>

          <!-- Footer -->
          <div v-if="$slots.footer" class="modal-footer">
            <slot name="footer"></slot>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script lang="ts">
/**
 * Module scope, deliberately NOT `<script setup>`.
 *
 * `<script setup>` compiles into `setup()`, so everything declared there is
 * per-instance. That is what broke the id counter that used to live below:
 * `let dialogIdCounter = 0` reset on every mount, so every dialog in the app
 * got `modal-title-1` and every `aria-labelledby` resolved to the *first*
 * dialog's title (WCAG 4.1.2). This block is real module scope, evaluated once.
 */
let nextDialogId = 0

/** Per-instance identity so the stack can tell who is on top. */
type DialogToken = { readonly id: string }

/**
 * Every open BaseDialog, in open order.
 *
 * Three separate bugs had the same root cause — state that is global was kept
 * per instance. They share this one stack:
 *   - Escape must only reach the topmost dialog (WCAG 3.2.2)
 *   - the body scroll lock must be reference counted
 *   - `inert` on the app root must be reference counted
 *
 * Plain LIFO is the right ordering here: a dialog opened later is the one the
 * user just interacted with, and the stacked cases in this app raise `z-index`
 * as they nest rather than opening a lower dialog on top of a higher one.
 */
const openDialogs: DialogToken[] = []

/**
 * The app root. It lives in AppLayout.vue, which this change does not own, so
 * it is resolved by selector instead of being wired through a prop or provide.
 */
const APP_ROOT_SELECTOR = '#app'

function applyGlobalLocks() {
  document.body.classList.add('modal-open')
  // `inert` is what actually takes the background out of the Tab order.
  // `aria-modal="true"` only keeps a screen reader's virtual cursor inside the
  // dialog; it has no effect on sequential focus navigation. Without this the
  // whole page behind the modal stays keyboard reachable (WCAG 2.1.2).
  document.querySelector(APP_ROOT_SELECTOR)?.setAttribute('inert', '')
}

function releaseGlobalLocks() {
  document.body.classList.remove('modal-open')
  document.querySelector(APP_ROOT_SELECTOR)?.removeAttribute('inert')
}

function registerDialog(token: DialogToken) {
  if (openDialogs.includes(token)) return
  openDialogs.push(token)
  if (openDialogs.length === 1) applyGlobalLocks()
}

function unregisterDialog(token: DialogToken) {
  const index = openDialogs.indexOf(token)
  if (index === -1) return
  openDialogs.splice(index, 1)
  // Only the last dialog out releases the locks. Releasing unconditionally is
  // what let a closing inner dialog unlock page scrolling while an outer dialog
  // was still open.
  if (openDialogs.length === 0) releaseGlobalLocks()
}

function isTopmostDialog(token: DialogToken) {
  return openDialogs.length > 0 && openDialogs[openDialogs.length - 1] === token
}

/**
 * Focusable candidates inside the panel.
 *
 * This set is recomputed on every keypress rather than captured when the dialog
 * opens: these dialog bodies are full of `v-if` fields, async-loaded steps and
 * `:disabled` toggles, so a cached list is stale almost immediately.
 */
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'iframe',
  'audio[controls]',
  'video[controls]',
  '[contenteditable]:not([contenteditable="false"])',
  '[tabindex]:not([tabindex="-1"])'
].join(',')

function isFocusableCandidate(el: HTMLElement, canMeasure: boolean) {
  if ((el as HTMLInputElement).disabled) return false
  if (el.hasAttribute('disabled')) return false

  // Reachable via one of the element selectors above but explicitly removed from
  // the Tab order, e.g. the hidden `autocomplete="one-time-code"` autofill input
  // the TOTP dialogs keep off-screen.
  if (el.getAttribute('tabindex') === '-1') return false

  // A `hidden` or `aria-hidden` subtree is not perceivable, so focusing into it
  // strands the user on something they cannot see or hear.
  if (el.closest('[hidden]')) return false
  if (el.closest('[aria-hidden="true"]')) return false

  const style = window.getComputedStyle(el)
  if (style.display === 'none' || style.visibility === 'hidden') return false

  // Layout-based visibility, but only where the environment does layout. jsdom
  // reports a zero-size box for everything, so gating on `canMeasure` keeps the
  // trap working under test while still catching collapsed nodes in a browser.
  if (canMeasure && el.getClientRects().length === 0) return false

  return true
}

function collectFocusable(panel: HTMLElement) {
  const canMeasure = panel.getClientRects().length > 0
  return Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter((el) =>
    isFocusableCandidate(el, canMeasure)
  )
}
</script>

<script setup lang="ts">
import { computed, watch, onMounted, onUnmounted, ref, nextTick } from 'vue'
import Icon from '@/components/icons/Icon.vue'

// 生成唯一ID以避免多个对话框时ID冲突。计数器在上面的模块作用域里,
// 不在 `<script setup>` 内 —— 后者会编译进 setup(),每个实例都会重置。
const dialogId = `modal-title-${++nextDialogId}`
const dialogToken: DialogToken = { id: dialogId }

// 焦点管理
const dialogRef = ref<HTMLElement | null>(null)
let previousActiveElement: HTMLElement | null = null
// 只有真正打开过的对话框才需要收尾。以 `show: false` 挂载的实例不该碰全局锁。
let hasOpened = false

type DialogWidth = 'narrow' | 'normal' | 'wide' | 'extra-wide' | 'full'

interface Props {
  show: boolean
  title: string
  width?: DialogWidth
  closeOnEscape?: boolean
  closeOnClickOutside?: boolean
  showCloseButton?: boolean
  zIndex?: number
  /**
   * CSS selector, resolved inside the panel, for the element that should take
   * focus when the dialog opens. Without it focus goes to the first focusable
   * element in DOM order, which is the header close button in every dialog that
   * has one — rarely what the user needs first.
   */
  initialFocus?: string
}

interface Emits {
  (e: 'close'): void
}

const props = withDefaults(defineProps<Props>(), {
  width: 'normal',
  closeOnEscape: true,
  closeOnClickOutside: false,
  showCloseButton: true,
  zIndex: 50,
  initialFocus: undefined
})

const emit = defineEmits<Emits>()

// Custom z-index style (overrides the default z-50 from CSS)
const zIndexStyle = computed(() => {
  return props.zIndex !== 50 ? { zIndex: props.zIndex } : undefined
})

const widthClasses = computed(() => {
  // Width guidance: narrow=confirm/short prompts, normal=standard forms,
  // wide=multi-section forms or rich content, extra-wide=analytics/tables,
  // full=full-screen or very dense layouts.
  const widths: Record<DialogWidth, string> = {
    narrow: 'max-w-md',
    normal: 'max-w-lg',
    wide: 'w-full sm:max-w-2xl md:max-w-3xl lg:max-w-4xl',
    'extra-wide': 'w-full sm:max-w-3xl md:max-w-4xl lg:max-w-5xl xl:max-w-6xl',
    full: 'w-full sm:max-w-4xl md:max-w-5xl lg:max-w-6xl xl:max-w-7xl'
  }
  return widths[props.width]
})

const handleClose = () => {
  if (props.closeOnClickOutside) {
    emit('close')
  }
}

/**
 * Move focus into the dialog. Exposed so a dialog whose fields arrive
 * asynchronously can re-apply it once they render — until then there is nothing
 * for `initialFocus` to match.
 */
const focusInitial = () => {
  const panel = dialogRef.value
  if (!panel) return

  const candidates = collectFocusable(panel)

  if (props.initialFocus) {
    let target: HTMLElement | null = null
    try {
      target = panel.querySelector<HTMLElement>(props.initialFocus)
    } catch {
      // A malformed selector must not stop the dialog from opening.
      target = null
    }
    if (target && candidates.includes(target)) {
      target.focus()
      return
    }
  }

  if (candidates.length > 0) {
    candidates[0].focus()
    return
  }

  // Nothing focusable in the body: park focus on the panel itself rather than
  // leaving it on an element that is now inside the inert background.
  panel.focus()
}

const trapTab = (event: KeyboardEvent) => {
  const panel = dialogRef.value
  if (!panel) return

  const candidates = collectFocusable(panel)

  if (candidates.length === 0) {
    event.preventDefault()
    panel.focus()
    return
  }

  const first = candidates[0]
  const last = candidates[candidates.length - 1]
  const active = document.activeElement as HTMLElement | null

  // Wrap at both ends, and pull focus back in if it is somehow already outside.
  if (event.shiftKey) {
    if (active === first || !panel.contains(active)) {
      event.preventDefault()
      last.focus()
    }
    return
  }

  if (active === last || !panel.contains(active)) {
    event.preventDefault()
    first.focus()
  }
}

const handleKeydown = (event: KeyboardEvent) => {
  if (!props.show) return
  // Every open instance hears this same document-level event, so the stack picks
  // the one that may act. Without this, one Escape closed the entire stack.
  if (!isTopmostDialog(dialogToken)) return

  if (event.key === 'Escape') {
    if (props.closeOnEscape) {
      emit('close')
    }
    // A dialog with closeOnEscape disabled is deliberately blocking, so the key
    // is swallowed here rather than falling through to anything underneath.
    return
  }

  if (event.key === 'Tab') {
    trapTab(event)
  }
}

const openDialog = async () => {
  hasOpened = true
  // 保存当前焦点元素
  previousActiveElement = document.activeElement as HTMLElement | null
  registerDialog(dialogToken)

  // 等待DOM更新后设置焦点到对话框
  await nextTick()
  focusInitial()
}

const closeDialog = () => {
  if (!hasOpened) return
  hasOpened = false

  // Release locks before restoring focus: focus cannot land inside an `inert`
  // subtree, and the element being restored to lives in the app root.
  unregisterDialog(dialogToken)

  // 恢复之前的焦点
  const target = previousActiveElement
  previousActiveElement = null
  if (target && typeof target.focus === 'function' && target.isConnected) {
    target.focus()
  }
}

// Prevent body scroll when modal is open and manage focus
watch(
  () => props.show,
  (isOpen) => {
    if (isOpen) {
      void openDialog()
    } else {
      closeDialog()
    }
  },
  { immediate: true }
)

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
  // 卸载即关闭:`v-if` 挂载的对话框永远不会把 show 切回 false,
  // 所以引用计数和焦点恢复必须在这里收尾,否则锁会泄漏。
  closeDialog()
})

defineExpose({ focusInitial })
</script>
