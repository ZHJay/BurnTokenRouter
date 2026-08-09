/**
 * 公告铃铛 —— 行为契约测试（列表/详情浮层 + 滚动锁 + 渲染结构）
 *
 * 2026-08-09 重构说明（fix_datatable）：原版本是纯源码文本正则的 change-detector
 * （readFileSync + 断言 CSS 字符串），样式重构即红、且「字符串存在」≠「样式生效」。
 * 已实测（探针）：jsdom 不注入 SFC 样式（style[data-v-*] 标签数为 0、cssRules 为空），
 * 材质类属性（background: var(--glass-bg-strong)、纱幕 rgba(0,0,0,.18/.45)、
 * 无 backdrop-filter、样式块无硬编码颜色）在 jsdom 里无法断言，相关假测试已删除，
 * 改由真实浏览器闸门 phase-b-qa/verify.py 与 Playwright 覆盖（建议见 fix_datatable 报告）。
 * 本文件只保留/新增可实测的行为契约：滚动锁（含多浮层共享计数锁）、各关闭路径、
 * 详情弹窗、正文消毒、未读态、无 logo 图片、渲染出的 class 表面。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

import AnnouncementBell from '../AnnouncementBell.vue'
import { useAnnouncementStore } from '@/stores/announcements'
import {
  lockBodyScroll,
  unlockBodyScroll,
  resetBodyScrollLock,
} from '@/composables/useCommandPalette'
import { resetBackgroundHidden } from '@/composables/useFocusTrap'

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return {
    ...actual,
    useI18n: () => ({ t: (key: string) => key }),
  }
})

vi.mock('@/stores/app', () => ({
  useAppStore: () => ({ showError: vi.fn(), showSuccess: vi.fn() }),
}))

function makeAnnouncement(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    title: 'Scheduled maintenance',
    content: '## Heading\n\nBody copy.',
    notify_mode: 'silent' as const,
    created_at: '2026-07-24T07:30:00Z',
    updated_at: '2026-07-24T07:30:00Z',
    read_at: null,
    ...overrides,
  }
}

function mountBell() {
  return mount(AnnouncementBell, {
    global: { stubs: { Icon: true } },
    // 焦点断言需要真实挂载：detached 容器里 focus() 是 no-op（jsdom）。
    attachTo: document.body,
  })
}

/** Transition 的离场动画在 jsdom 里靠 rAF 兜底完成，等两帧再断言 DOM 移除。 */
const settleFrames = async () => {
  await flushPromises()
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
}

/** 元素子树（含自身）的全部 class，用于渲染结构断言。 */
const collectClasses = (root: Element): string[] =>
  Array.from(root.querySelectorAll('*'))
    .flatMap((el) => Array.from(el.classList))
    .concat(Array.from(root.classList))

describe('AnnouncementBell 行为契约', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    // 计数锁是模块级共享状态：任何没卸载干净的浮层会把锁泄漏进下一个用例
    resetBodyScrollLock()
    // 焦点陷阱的背景隐藏计数器同样是模块级共享状态，跨用例归零。
    resetBackgroundHidden()
  })

  afterEach(() => {
    document.body.innerHTML = ''
    resetBodyScrollLock()
  })

  describe('浮层渲染与结构', () => {
    it('列表浮层渲染纱幕容器与不透明面板（dialog 语义，无装饰类残留）', async () => {
      const store = useAnnouncementStore()
      store.announcements = [makeAnnouncement()] as never

      const wrapper = mountBell()
      await wrapper.find('.bell-btn').trigger('click')
      await wrapper.vm.$nextTick()

      const overlay = document.body.querySelector('.ann-overlay')
      const panel = document.body.querySelector('.ann-panel')
      expect(overlay).not.toBeNull()
      expect(panel).not.toBeNull()
      expect(panel?.getAttribute('role')).toBe('dialog')
      expect(panel?.getAttribute('aria-modal')).toBe('true')

      // 渲染结构断言（真实渲染出的 class 表面）：面板子树不得携带半透明白底类
      // 或 Apple 基准之外的装饰类（bg-white / 渐变 / ping 脉冲 / 大 blur）。
      // 材质本身（--glass-bg-strong / 纱幕 rgba / backdrop-filter）jsdom 无法
      // 断言计算样式，见文件头说明。
      const classes = panel ? collectClasses(panel) : []
      expect(classes.some((c) => c === 'bg-white')).toBe(false)
      expect(classes.some((c) => c.startsWith('bg-gradient-to-'))).toBe(false)
      expect(classes.some((c) => c === 'animate-ping')).toBe(false)
      expect(classes.some((c) => c === 'blur-2xl' || c === 'blur-3xl')).toBe(false)

      wrapper.unmount()
    })

    it('列表头部显示未读计数', async () => {
      const store = useAnnouncementStore()
      store.announcements = [makeAnnouncement(), makeAnnouncement({ id: 2 })] as never

      const wrapper = mountBell()
      await wrapper.find('.bell-btn').trigger('click')
      await wrapper.vm.$nextTick()

      expect(document.body.querySelector('.ann-head-count')?.textContent).toBe('2')
      wrapper.unmount()
    })
  })

  describe('滚动锁定', () => {
    it('列表展开锁 body 滚动，关闭后恢复', async () => {
      const store = useAnnouncementStore()
      store.announcements = [makeAnnouncement()] as never

      const wrapper = mountBell()
      expect(document.body.style.overflow).toBe('')

      await wrapper.find('.bell-btn').trigger('click')
      await wrapper.vm.$nextTick()
      expect(document.body.style.overflow).toBe('hidden')

      document.body.querySelector<HTMLButtonElement>('.ann-close')?.click()
      await wrapper.vm.$nextTick()
      expect(document.body.style.overflow).toBe('')

      wrapper.unmount()
    })

    it('卸载时恢复 body 滚动，不把页面永久锁死', async () => {
      const store = useAnnouncementStore()
      store.announcements = [makeAnnouncement()] as never

      const wrapper = mountBell()
      await wrapper.find('.bell-btn').trigger('click')
      await wrapper.vm.$nextTick()
      expect(document.body.style.overflow).toBe('hidden')

      wrapper.unmount()
      expect(document.body.style.overflow).toBe('')
    })

    it('与其它浮层共享引用计数锁：外部持锁时关闭列表不会提前解锁', async () => {
      const store = useAnnouncementStore()
      store.announcements = [makeAnnouncement()] as never

      const wrapper = mountBell()
      await wrapper.find('.bell-btn').trigger('click')
      await wrapper.vm.$nextTick()
      expect(document.body.style.overflow).toBe('hidden')

      // 模拟另一个浮层（⌘K 面板 / 移动端汉堡菜单）同时持锁：计数 1 → 2。
      // 若铃铛改成直写 body.style.overflow，以下关闭会提前把页面解锁，
      // 该断言当场红 —— 这就是 §3.5 共享计数锁契约要防的缺陷。
      lockBodyScroll()

      document.body.querySelector<HTMLButtonElement>('.ann-close')?.click()
      await wrapper.vm.$nextTick()
      expect(document.body.style.overflow).toBe('hidden')

      unlockBodyScroll()
      expect(document.body.style.overflow).toBe('')
      wrapper.unmount()
    })

    it('Escape 键关闭列表并释放滚动锁', async () => {
      const store = useAnnouncementStore()
      store.announcements = [makeAnnouncement()] as never

      const wrapper = mountBell()
      await wrapper.find('.bell-btn').trigger('click')
      await wrapper.vm.$nextTick()
      expect(document.body.style.overflow).toBe('hidden')

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
      await settleFrames()

      expect(document.body.querySelector('.ann-overlay')).toBeNull()
      expect(document.body.style.overflow).toBe('')
      wrapper.unmount()
    })

    it('遮罩点击关闭列表并释放滚动锁', async () => {
      const store = useAnnouncementStore()
      store.announcements = [makeAnnouncement()] as never

      const wrapper = mountBell()
      await wrapper.find('.bell-btn').trigger('click')
      await wrapper.vm.$nextTick()

      document.body.querySelector<HTMLElement>('.ann-overlay')?.click()
      await settleFrames()

      expect(document.body.querySelector('.ann-overlay')).toBeNull()
      expect(document.body.style.overflow).toBe('')
      wrapper.unmount()
    })

    it('详情弹窗展开时同样锁定滚动，列表与详情全部关闭后才恢复', async () => {
      const store = useAnnouncementStore()
      store.announcements = [makeAnnouncement()] as never
      vi.spyOn(store, 'markAsRead').mockResolvedValue(undefined)

      const wrapper = mountBell()
      await wrapper.find('.bell-btn').trigger('click')
      await wrapper.vm.$nextTick()
      ;(document.body.querySelectorAll('.ann-row')[0] as HTMLElement)?.click()
      await wrapper.vm.$nextTick()

      const detailPanel = document.body.querySelector(
        '[aria-labelledby="announcement-detail-title"]',
      )
      expect(detailPanel).not.toBeNull()
      expect(document.body.style.overflow).toBe('hidden')

      // 只关详情：列表还开着，锁必须保持
      detailPanel?.querySelector<HTMLButtonElement>('.ann-close')?.click()
      await settleFrames()
      expect(
        document.body.querySelector('[aria-labelledby="announcement-detail-title"]'),
      ).toBeNull()
      expect(document.body.style.overflow).toBe('hidden')

      // 关列表：全部浮层关闭，锁释放
      document.body.querySelector<HTMLButtonElement>('.ann-close')?.click()
      await settleFrames()
      expect(document.body.querySelector('.ann-overlay')).toBeNull()
      expect(document.body.style.overflow).toBe('')

      wrapper.unmount()
    })
  })

  describe('正文消毒', () => {
    it('详情正文经 DOMPurify 消毒，不渲染脚本', async () => {
      const store = useAnnouncementStore()
      store.announcements = [
        makeAnnouncement({
          content: '## Heading\n\n<script>window.__bellXss = true</script>',
        }),
      ] as never
      vi.spyOn(store, 'markAsRead').mockResolvedValue(undefined)

      const wrapper = mountBell()
      await wrapper.find('.bell-btn').trigger('click')
      await wrapper.vm.$nextTick()
      ;(document.body.querySelectorAll('.ann-row')[0] as HTMLElement)?.click()
      await wrapper.vm.$nextTick()

      const detailBody = document.body.querySelector(
        '[aria-labelledby="announcement-detail-title"] .markdown-body',
      )
      expect(detailBody?.querySelector('h2')?.textContent).toBe('Heading')
      expect(detailBody?.querySelector('script')).toBeNull()
      wrapper.unmount()
    })
  })

  describe('未读红点与铃铛态', () => {
    it('有未读时渲染红点并给铃铛加 has-unread', () => {
      const store = useAnnouncementStore()
      store.announcements = [makeAnnouncement({ read_at: null })] as never

      const wrapper = mountBell()
      expect(wrapper.find('[data-testid="announcement-bell-dot"]').exists()).toBe(true)
      expect(wrapper.find('.bell-btn').classes()).toContain('has-unread')

      wrapper.unmount()
    })

    it('全部已读时不渲染红点', () => {
      const store = useAnnouncementStore()
      store.announcements = [makeAnnouncement({ read_at: '2026-07-25T00:00:00Z' })] as never

      const wrapper = mountBell()
      expect(wrapper.find('[data-testid="announcement-bell-dot"]').exists()).toBe(false)
      expect(wrapper.find('.bell-btn').classes()).not.toContain('has-unread')

      wrapper.unmount()
    })
  })

  describe('设计系统合规', () => {
    it('不渲染任何 logo 图片（品牌 = 站点名纯文本）', async () => {
      const store = useAnnouncementStore()
      store.announcements = [makeAnnouncement()] as never

      const wrapper = mountBell()
      await wrapper.find('.bell-btn').trigger('click')
      await wrapper.vm.$nextTick()

      expect(document.body.querySelectorAll('img')).toHaveLength(0)
      wrapper.unmount()
    })
  })

  describe('焦点管理（两层浮层真 modal）', () => {
    /** 弹窗 Teleport 到 body，背景是 #app：造一个可断言的 app 根。 */
    function setupApp() {
      document.body.innerHTML = '<div id="app"></div>'
    }

    it('打开列表时焦点移入列表弹窗的首个可交互元素，并给 #app 挂 aria-hidden', async () => {
      setupApp()
      const store = useAnnouncementStore()
      store.announcements = [makeAnnouncement(), makeAnnouncement({ id: 2 })] as never

      const wrapper = mountBell()
      await wrapper.find('.bell-btn').trigger('click')
      await wrapper.vm.$nextTick()
      await wrapper.vm.$nextTick()

      const panel = document.body.querySelector<HTMLElement>(
        '.ann-panel[aria-labelledby="announcement-list-title"]',
      )
      expect(panel).not.toBeNull()
      expect(panel?.contains(document.activeElement)).toBe(true)
      expect(document.activeElement).toBe(panel?.querySelector<HTMLButtonElement>('.btn-primary'))
      expect(document.getElementById('app')?.getAttribute('aria-hidden')).toBe('true')

      wrapper.unmount()
      expect(document.getElementById('app')?.hasAttribute('aria-hidden')).toBe(false)
    })

    it('公告行是键盘可达的按钮语义：role/tabindex/Enter 打开详情', async () => {
      const store = useAnnouncementStore()
      store.announcements = [makeAnnouncement()] as never
      vi.spyOn(store, 'markAsRead').mockResolvedValue(undefined)

      const wrapper = mountBell()
      await wrapper.find('.bell-btn').trigger('click')
      await wrapper.vm.$nextTick()

      const row = document.body.querySelector<HTMLElement>('.ann-row')
      expect(row?.getAttribute('role')).toBe('button')
      expect(row?.getAttribute('tabindex')).toBe('0')

      row?.focus()
      row?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
      await wrapper.vm.$nextTick()
      await wrapper.vm.$nextTick()

      expect(
        document.body.querySelector('[aria-labelledby="announcement-detail-title"]'),
      ).not.toBeNull()
      wrapper.unmount()
    })

    it('Tab / Shift+Tab 在列表弹窗内循环（行是陷阱的一部分），不逃逸', async () => {
      const store = useAnnouncementStore()
      store.announcements = [makeAnnouncement(), makeAnnouncement({ id: 2 })] as never

      const wrapper = mountBell()
      await wrapper.find('.bell-btn').trigger('click')
      await wrapper.vm.$nextTick()

      const panel = document.body.querySelector<HTMLElement>(
        '.ann-panel[aria-labelledby="announcement-list-title"]',
      )!
      const focusables = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      )
      const first = focusables[0]
      const last = focusables[focusables.length - 1]

      last.focus()
      panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }))
      expect(document.activeElement).toBe(first)

      first.focus()
      panel.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }),
      )
      expect(document.activeElement).toBe(last)

      wrapper.unmount()
    })

    it('Esc 关闭列表并把焦点还给铃铛按钮，同时移除 #app aria-hidden', async () => {
      setupApp()
      const store = useAnnouncementStore()
      store.announcements = [makeAnnouncement()] as never

      const wrapper = mountBell()
      const bellBtn = wrapper.find('.bell-btn').element as HTMLButtonElement
      bellBtn.focus()
      await wrapper.find('.bell-btn').trigger('click')
      await wrapper.vm.$nextTick()
      await wrapper.vm.$nextTick()
      expect(document.getElementById('app')?.getAttribute('aria-hidden')).toBe('true')

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      await settleFrames()

      expect(document.body.querySelector('.ann-overlay')).toBeNull()
      expect(document.activeElement).toBe(bellBtn)
      expect(document.getElementById('app')?.hasAttribute('aria-hidden')).toBe(false)

      wrapper.unmount()
    })

    it('详情层 Esc 只关详情：焦点回到列表内的行、列表保持打开、aria-hidden 保持', async () => {
      setupApp()
      const store = useAnnouncementStore()
      store.announcements = [makeAnnouncement()] as never
      vi.spyOn(store, 'markAsRead').mockResolvedValue(undefined)

      const wrapper = mountBell()
      await wrapper.find('.bell-btn').trigger('click')
      await wrapper.vm.$nextTick()
      await wrapper.vm.$nextTick()

      const row = document.body.querySelector<HTMLElement>('.ann-row')!
      row.focus()
      row.click()
      await wrapper.vm.$nextTick()
      await wrapper.vm.$nextTick()

      const detailPanel = document.body.querySelector(
        '[aria-labelledby="announcement-detail-title"]',
      )
      expect(detailPanel?.contains(document.activeElement)).toBe(true)

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      await settleFrames()

      expect(
        document.body.querySelector('[aria-labelledby="announcement-detail-title"]'),
      ).toBeNull()
      expect(
        document.body.querySelector('[aria-labelledby="announcement-list-title"]'),
      ).not.toBeNull()
      expect(document.activeElement).toBe(row)
      expect(document.getElementById('app')?.getAttribute('aria-hidden')).toBe('true')

      // 再按 Esc 关列表：全部浮层关闭后 aria-hidden 才移除
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      await settleFrames()

      expect(document.body.querySelector('.ann-overlay')).toBeNull()
      expect(document.getElementById('app')?.hasAttribute('aria-hidden')).toBe(false)

      wrapper.unmount()
    })
  })
})
