/**
 * 视觉契约测试 —— 公告铃铛与其列表/详情浮层
 *
 * 锁定 Phase A/B 的决策（HANDOFF.md 第 1 节 / HANDOFF-PHASE-C.md 第 2 节）：
 *   1. 浮出层不透明（var(--glass-bg-strong)），不得回归半透明
 *   2. 纱幕压暗（亮 18% / 暗 45% 黑）
 *   3. 弹窗展开锁 body 滚动，关闭恢复
 *   4. 无 logo 图片
 *   5. 禁止硬编码颜色
 *
 * 只断言视觉契约，不改动展示/已读/关闭的功能行为。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import AnnouncementBell from '../AnnouncementBell.vue'
import { useAnnouncementStore } from '@/stores/announcements'
import { resetBodyScrollLock } from '@/composables/useCommandPalette'

const bellSource = readFileSync(
  resolve(process.cwd(), 'src/components/common/AnnouncementBell.vue'),
  'utf8',
)
const popupSource = readFileSync(
  resolve(process.cwd(), 'src/components/common/AnnouncementPopup.vue'),
  'utf8',
)

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
  })
}

describe('AnnouncementBell 视觉契约', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    // 计数锁是模块级共享状态：任何没卸载干净的浮层会把锁泄漏进下一个用例
    resetBodyScrollLock()
  })

  afterEach(() => {
    document.body.innerHTML = ''
    resetBodyScrollLock()
  })

  describe('浮出层材质：不透明面板 + 纱幕', () => {
    it('列表浮层渲染不透明面板与纱幕容器', async () => {
      const store = useAnnouncementStore()
      store.announcements = [makeAnnouncement()] as never

      const wrapper = mountBell()
      await wrapper.find('.bell-btn').trigger('click')
      await wrapper.vm.$nextTick()

      expect(document.body.querySelector('.ann-overlay')).not.toBeNull()
      expect(document.body.querySelector('.ann-panel')).not.toBeNull()

      wrapper.unmount()
    })

    it('面板底色绑定 --glass-bg-strong，纱幕为 18% / 45% 黑', () => {
      expect(bellSource).toMatch(/\.ann-panel\s*\{[^}]*background:\s*var\(--glass-bg-strong\)/)
      expect(popupSource).toMatch(/\.ann-panel\s*\{[^}]*background:\s*var\(--glass-bg-strong\)/)

      for (const src of [bellSource, popupSource]) {
        expect(src).toMatch(/\.ann-overlay\s*\{[^}]*background:\s*rgba\(0,\s*0,\s*0,\s*0\.18\)/)
        expect(src).toMatch(/\.ann-overlay\s*\{\s*background:\s*rgba\(0,\s*0,\s*0,\s*0\.45\)/)
      }
    })

    it('浮出层不使用 backdrop-filter（玻璃只保留顶栏/登录卡/ambient）', () => {
      for (const src of [bellSource, popupSource]) {
        expect(src).not.toMatch(/backdrop-filter/)
        expect(src).not.toMatch(/backdrop-blur/)
      }
    })

    it('正文不自带 bg-white，继承不透明面板底色', () => {
      for (const src of [bellSource, popupSource]) {
        expect(src).not.toMatch(/class="[^"]*\bbg-white\b/)
      }
    })
  })

  describe('滚动锁定', () => {
    it('用共享的引用计数锁，而不是直写 body.style.overflow', () => {
      // 与 ⌘K 命令面板、移动端汉堡菜单锁同一个 body。直写会与计数器互相
      // 破坏：直写 'hidden' 后面板把它记成"原始值"，关闭时永久还原 'hidden'
      for (const src of [bellSource, popupSource]) {
        expect(src).toMatch(/lockBodyScroll\(\)/)
        expect(src).toMatch(/unlockBodyScroll\(\)/)
        // 只允许出现在注释里，不允许有真实赋值
        expect(src).not.toMatch(/^\s*document\.body\.style\.overflow\s*=/m)
      }
    })

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

    it('样式块不硬编码颜色，一律消费 CSS 变量', () => {
      for (const src of [bellSource, popupSource]) {
        const styleBlock = src.slice(src.indexOf('<style'))
        const hexes = styleBlock.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []
        // 仅允许 #fff/#ffffff：蓝底上的图标前景色，无暗色语义
        const disallowed = hexes.filter((h) => !['#fff', '#ffffff'].includes(h.toLowerCase()))
        expect(disallowed).toEqual([])
      }
    })

    it('不再残留渐变装饰与 ping 脉冲（Apple 基准是静态发丝线）', () => {
      for (const src of [bellSource, popupSource]) {
        expect(src).not.toMatch(/bg-gradient-to-/)
        expect(src).not.toMatch(/animate-ping/)
        expect(src).not.toMatch(/\bblur-(2xl|3xl)\b/)
      }
    })
  })
})
