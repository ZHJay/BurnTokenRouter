<template>
  <Teleport to="body">
    <!--
      Backdrop is a sibling of the menu, not its parent: the menu is what
      scales, and a shared wrapper would apply that scale to a full-viewport
      element with no transform-origin of its own.

      It is also mouse-only by construction, so it is hidden from the a11y tree
      — the keyboard equivalent is Escape, and announcing an unreachable
      "button" spanning the viewport only adds noise.
    -->
    <div
      v-if="show && position"
      class="fixed inset-0 z-[9998]"
      aria-hidden="true"
      @click="emit('close')"
    ></div>
    <!--
      One owner for the motion: `.dropdown` carries an intrinsic
      `animate-scale-in`, which grows the menu on enter and does nothing on
      close, so the menu used to vanish on the frame it closed. `animate-none`
      hands the whole thing to <transition>, which owns both directions.
      Same fix as AccountGroupsCell.vue:39 and AppHeader.vue:216.
    -->
    <transition name="dropdown">
      <div
        v-if="show && position"
        ref="menuRef"
        class="action-menu-content dropdown fixed z-[9999] w-52 origin-top animate-none"
        :style="{ top: position.top + 'px', left: position.left + 'px' }"
        role="menu"
        :aria-label="t('admin.accounts.moreActions')"
        @keydown="onMenuKeydown"
        @click.stop
      >
        <div role="none">
          <template v-if="account">
            <button role="menuitem" @click="$emit('test', account); $emit('close')" class="dropdown-item w-full">
              <Icon name="play" size="sm" class="text-green-500" :stroke-width="2" />
              {{ t('admin.accounts.testConnection') }}
            </button>
            <button role="menuitem" @click="$emit('stats', account); $emit('close')" class="dropdown-item w-full">
              <Icon name="chart" size="sm" class="text-indigo-500" />
              {{ t('admin.accounts.viewStats') }}
            </button>
            <button role="menuitem" @click="$emit('schedule', account); $emit('close')" class="dropdown-item w-full">
              <Icon name="clock" size="sm" class="text-orange-500" />
              {{ t('admin.scheduledTests.schedule') }}
            </button>
            <button v-if="canDuplicate" role="menuitem" @click="$emit('duplicate', account); $emit('close')" class="dropdown-item w-full">
              <Icon name="copy" size="sm" class="text-sky-500" />
              {{ t('admin.accounts.duplicateAccount') }}
            </button>
            <!-- 影子账号不持凭据:重授权/刷新 token 对其无效(后端拒绝),故隐藏(外审 G4)。 -->
            <template v-if="(account.type === 'oauth' || account.type === 'setup-token') && !isShadow">
              <button role="menuitem" @click="$emit('reauth', account); $emit('close')" class="dropdown-item w-full text-blue-600 dark:text-blue-400">
                <Icon name="link" size="sm" />
                {{ t('admin.accounts.reAuthorize') }}
              </button>
              <button role="menuitem" @click="$emit('refresh-token', account); $emit('close')" class="dropdown-item w-full text-purple-600 dark:text-purple-400">
                <Icon name="refresh" size="sm" />
                {{ t('admin.accounts.refreshToken') }}
              </button>
            </template>
            <button v-if="isOpenAIOAuthParent" role="menuitem" @click="$emit('create-spark-shadow', account); $emit('close')" class="dropdown-item w-full text-amber-600 dark:text-amber-400">
              <Icon name="sparkles" size="sm" />
              {{ t('admin.accounts.createSparkShadow') }}
            </button>
            <button v-if="supportsPrivacy" role="menuitem" @click="$emit('set-privacy', account); $emit('close')" class="dropdown-item w-full text-emerald-600 dark:text-emerald-400">
              <Icon name="shield" size="sm" />
              {{ t('admin.accounts.setPrivacy') }}
            </button>
            <div v-if="hasRecoverableState" role="separator" class="my-1 h-[0.5px] bg-[var(--separator)]"></div>
            <button v-if="hasRecoverableState" role="menuitem" @click="$emit('recover-state', account); $emit('close')" class="dropdown-item w-full text-emerald-600 dark:text-emerald-400">
              <Icon name="sync" size="sm" />
              {{ t('admin.accounts.recoverState') }}
            </button>
            <button v-if="hasQuotaLimit" role="menuitem" @click="$emit('reset-quota', account); $emit('close')" class="dropdown-item w-full text-teal-600 dark:text-teal-400">
              <Icon name="refresh" size="sm" />
              {{ t('admin.accounts.resetQuota') }}
            </button>
          </template>
        </div>
      </div>
    </transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { Icon } from '@/components/icons'
import type { Account } from '@/types'

const props = defineProps<{ show: boolean; account: Account | null; position: { top: number; left: number } | null }>()
const emit = defineEmits(['close', 'test', 'stats', 'schedule', 'duplicate', 'reauth', 'refresh-token', 'recover-state', 'reset-quota', 'set-privacy', 'create-spark-shadow'])
const { t } = useI18n()

const menuRef = ref<HTMLElement | null>(null)
/**
 * The element focus came from, restored on close.
 *
 * Read from `document.activeElement` rather than taken as a prop: the menu is
 * opened by a click on a per-row button that the parent does not hold a ref to,
 * and that button is what the pointer just focused.
 */
let previousActiveElement: HTMLElement | null = null

/** Enabled menu items, in DOM order. Recomputed per keypress: most are `v-if`. */
function menuItems(): HTMLElement[] {
  const menu = menuRef.value
  if (!menu) return []
  return Array.from(menu.querySelectorAll<HTMLElement>('[role="menuitem"]')).filter(
    (el) => !(el as HTMLButtonElement).disabled && !el.hasAttribute('disabled')
  )
}

function focusItemAt(index: number): void {
  const items = menuItems()
  if (items.length === 0) return
  // Wrap at both ends, the way a menu is expected to behave.
  const wrapped = ((index % items.length) + items.length) % items.length
  /*
   * preventScroll is required, not defensive. This menu is `position: fixed` and
   * teleported to <body>, but its trigger lives inside `.table-wrapper`, which
   * is a scroll container. A plain focus() asks the browser to scroll the
   * nearest scrollable ancestor to reveal the focused node, which fires a scroll
   * event — and both AccountsView and UsersView close the row menu on scroll, so
   * moving focus into the menu closed it on the very next frame.
   * (Measured: click -> MENU ADDED -> focus -> scroll(.table-wrapper) -> MENU REMOVED.)
   * The menu is already fully in the viewport by construction; there is nothing
   * to scroll to.
   */
  items[wrapped].focus({ preventScroll: true })
}

/**
 * Keyboard model for the menu.
 *
 * Tab is trapped rather than passed through, which is the point of the fix: the
 * menu is teleported to <body> while the trigger stays in the table, so an
 * untrapped Tab leaves the menu and lands *after* everything else on the page —
 * these 10 destructive actions were effectively unreachable from the trigger.
 * Arrow/Home/End give the menu its normal roving focus.
 */
function onMenuKeydown(event: KeyboardEvent): void {
  const items = menuItems()
  if (items.length === 0) return
  const current = items.indexOf(document.activeElement as HTMLElement)

  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault()
      focusItemAt(current + 1)
      break
    case 'ArrowUp':
      event.preventDefault()
      focusItemAt(current - 1)
      break
    case 'Home':
      event.preventDefault()
      focusItemAt(0)
      break
    case 'End':
      event.preventDefault()
      focusItemAt(items.length - 1)
      break
    case 'Tab': {
      event.preventDefault()
      const step = event.shiftKey ? -1 : 1
      focusItemAt(current === -1 ? 0 : current + step)
      break
    }
    default:
      break
  }
}
const canDuplicate = computed(() => {
  if (!props.account || props.account.parent_account_id != null) return false
  return ['apikey', 'upstream', 'bedrock', 'service_account'].includes(props.account.type)
})
const isRateLimited = computed(() => {
  if (props.account?.rate_limit_reset_at && new Date(props.account.rate_limit_reset_at) > new Date()) {
    return true
  }
  const modelLimits = (props.account?.extra as Record<string, unknown> | undefined)?.model_rate_limits as
    | Record<string, { rate_limit_reset_at: string }>
    | undefined
  if (modelLimits) {
    const now = new Date()
    return Object.values(modelLimits).some(info => new Date(info.rate_limit_reset_at) > now)
  }
  return false
})
const isOverloaded = computed(() => props.account?.overload_until && new Date(props.account.overload_until) > new Date())
const isTempUnschedulable = computed(() => props.account?.temp_unschedulable_until && new Date(props.account.temp_unschedulable_until) > new Date())
const hasRecoverableState = computed(() => {
  return props.account?.status === 'error' || Boolean(isRateLimited.value) || Boolean(isOverloaded.value) || Boolean(isTempUnschedulable.value)
})
const isAntigravityOAuth = computed(() => props.account?.platform === 'antigravity' && props.account?.type === 'oauth')
const isOpenAIOAuth = computed(() => props.account?.platform === 'openai' && props.account?.type === 'oauth')
// 影子账号(链接型,持 parent_account_id)不持凭据、type 不可变,凭据/隐私类操作对其无效。
const isShadow = computed(() => props.account?.parent_account_id != null)
// A "parent" OpenAI OAuth account is one that is NOT itself a shadow (parent_account_id == null)
const isOpenAIOAuthParent = computed(() => isOpenAIOAuth.value && !isShadow.value)
const supportsPrivacy = computed(() => (isAntigravityOAuth.value || isOpenAIOAuth.value) && !isShadow.value)
const hasQuotaLimit = computed(() => {
  return (props.account?.type === 'apikey' || props.account?.type === 'bedrock') && (
    (props.account?.quota_limit ?? 0) > 0 ||
    (props.account?.quota_daily_limit ?? 0) > 0 ||
    (props.account?.quota_weekly_limit ?? 0) > 0
  )
})

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') emit('close')
}

/**
 * Restores focus to the trigger.
 *
 * Skipped when focus has already moved somewhere outside the menu — every item
 * emits an action *and* `close`, and several of those actions open a dialog that
 * takes focus in the same tick. Restoring unconditionally would pull focus out of
 * the dialog that just opened, and leave the dialog holding a detached menu item
 * as its own restore target.
 */
function restoreFocus(): void {
  const target = previousActiveElement
  previousActiveElement = null
  if (!target || typeof target.focus !== 'function' || !target.isConnected) return

  const active = document.activeElement
  const focusIsLoose =
    active === null || active === document.body || menuRef.value?.contains(active) === true
  if (!focusIsLoose) return

  // Same reason as focusItemAt: the trigger sits in a scroll container, and a
  // scroll here would be read as "user scrolled" by the parent view.
  target.focus({ preventScroll: true })
}

watch(
  () => props.show,
  async (visible) => {
    if (visible) {
      previousActiveElement = document.activeElement as HTMLElement | null
      window.addEventListener('keydown', handleKeydown)
      // Wait for the teleported menu to exist before reaching into it.
      await nextTick()
      focusItemAt(0)
    } else {
      window.removeEventListener('keydown', handleKeydown)
      restoreFocus()
    }
  },
  /*
   * flush: 'sync' so the focus restore lands before anything else reacts to the
   * same click. Every item emits its action *and* `close`, and several actions
   * open a BaseDialog, which captures `document.activeElement` as its own
   * restore target. On the default 'pre' flush that capture happens while focus
   * is still on the menu item, so the dialog would later try to restore focus to
   * a node that no longer exists and drop focus to <body> instead. Restoring
   * synchronously puts the trigger back under the cursor first, so the dialog
   * captures the trigger — which is where focus should return to.
   */
  { immediate: true, flush: 'sync' }
)

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
  // A parent that unmounts the menu instead of setting `show = false` would
  // otherwise strand focus on a detached node.
  restoreFocus()
})
</script>

<style scoped>
/*
  Teleported to <body>, so this panel is not inside the modal backdrop root:
  its `backdrop-filter` samples whatever is actually painted under it and
  re-blurs the page. Same call already made for Select.vue's portal and Toast.
  Only the fill and the blur change; the four glass edges and --shadow-3 from
  `.dropdown` stay.
*/
.action-menu-content {
  background: var(--surface);
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

/* Symmetric enter/leave, anchored at the trigger via `.dropdown`'s origin. */
.dropdown-enter-active,
.dropdown-leave-active {
  transition:
    opacity 240ms var(--ease-out),
    transform 240ms var(--spring);
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: scale(0.94) translateY(-4px);
}

@media (prefers-reduced-motion: reduce) {
  .dropdown-enter-active,
  .dropdown-leave-active {
    transition-duration: 1ms;
  }

  .dropdown-enter-from,
  .dropdown-leave-to {
    transform: none;
  }
}
</style>
