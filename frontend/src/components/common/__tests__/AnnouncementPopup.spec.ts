import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import AnnouncementPopup from '../AnnouncementPopup.vue'
import { useAnnouncementStore } from '@/stores/announcements'
import { resetBodyScrollLock } from '@/composables/useCommandPalette'
import { resetBackgroundHidden } from '@/composables/useFocusTrap'

const announcementMarkdownStyles = readFileSync(
  resolve(process.cwd(), 'src/styles/announcement-markdown.css'),
  'utf8',
)

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return {
    ...actual,
    useI18n: () => ({
      t: (key: string) => key,
    }),
  }
})

const announcement = {
  id: 1,
  title: 'Preview announcement',
  content: '## Preview heading\n\n<div>HTML content</div><script>window.__xss = true</script>',
  status: 'draft' as const,
  notify_mode: 'popup' as const,
  targeting: { any_of: [] },
  created_at: '2026-07-24T07:30:00Z',
  updated_at: '2026-07-24T07:30:00Z',
}

describe('AnnouncementPopup', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    // 滚动锁计数器是模块级共享状态：任何用例中途失败（挂载后未卸载）都会把
    // 计数器 +1 泄漏进下一个用例，让"打开时 overflow === 'hidden'"假绿。
    // 必须在 beforeEach 归零（§3.5 契约）。
    resetBodyScrollLock()
    // 焦点陷阱的背景隐藏计数器同样是模块级共享状态，跨用例归零。
    resetBackgroundHidden()
  })

  afterEach(() => {
    document.body.innerHTML = ''
    // 走计数器复位而不是直写 body.style.overflow：直写会绕过计数器，
    // 与生产代码的引用计数锁互相破坏（§3.5）。
    resetBodyScrollLock()
  })

  it('renders mixed Markdown and HTML inside the shared styled container', async () => {
    const store = useAnnouncementStore()
    store.currentPopup = {
      id: 1,
      title: 'Mixed content announcement',
      content: [
        '## Markdown heading',
        '',
        '<div><h3>HTML heading</h3><ul><li>HTML list item</li></ul></div>',
        '',
        '<table><thead><tr><th>Status</th></tr></thead><tbody><tr><td>OK</td></tr></tbody></table>',
        '<script>window.__announcementXss = true</script>',
      ].join('\n'),
      notify_mode: 'popup',
      created_at: '2026-07-24T07:30:00Z',
      updated_at: '2026-07-24T07:30:00Z',
    }

    const wrapper = mount(AnnouncementPopup)
    await wrapper.vm.$nextTick()

    const content = document.body.querySelector('.markdown-body')
    expect(content?.querySelector('h2')?.textContent).toBe('Markdown heading')
    expect(content?.querySelector('h3')?.textContent).toBe('HTML heading')
    expect(content?.querySelector('li')?.textContent).toBe('HTML list item')
    expect(content?.querySelector('table td')?.textContent).toBe('OK')
    expect(content?.querySelector('script')).toBeNull()

    wrapper.unmount()
  })

  it.each(['h2', 'h3', 'ul', 'li', 'blockquote', 'table', 'th', 'td', 'code'])(
    'loads a shared style rule for mixed-content <%s> elements',
    (element) => {
      expect(announcementMarkdownStyles).toContain(`.markdown-body ${element}`)
    },
  )

  it('previews an admin announcement without marking it as read', async () => {
    const store = useAnnouncementStore()
    const dismissPopup = vi.spyOn(store, 'dismissPopup')
    const wrapper = mount(AnnouncementPopup, {
      props: {
        announcement,
        preview: true,
      },
    })

    expect(document.body.textContent).toContain('Preview announcement')
    // 正向断言：弹窗打开时必须真正锁定 body 滚动（此前该 spec 只断言关闭后恢复）
    expect(document.body.style.overflow).toBe('hidden')
    expect(document.body.querySelector('.markdown-body h2')?.textContent).toBe('Preview heading')
    expect(document.body.querySelector('.markdown-body script')).toBeNull()
    expect(document.body.textContent).toContain('common.close')

    const dismissButton = document.body.querySelector<HTMLButtonElement>(
      '[data-testid="announcement-popup-dismiss"]',
    )
    dismissButton?.click()
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('close')).toHaveLength(1)
    expect(dismissPopup).not.toHaveBeenCalled()

    await wrapper.setProps({ announcement: null })
    expect(document.body.style.overflow).toBe('')
    wrapper.unmount()
  })

  it('keeps the existing user popup dismissal behavior', async () => {
    const store = useAnnouncementStore()
    store.currentPopup = announcement
    const dismissPopup = vi.spyOn(store, 'dismissPopup').mockResolvedValue()
    const wrapper = mount(AnnouncementPopup)
    // 正向断言：弹窗持有滚动锁（当前 popup 非空 → watch(displayedAnnouncement) 上锁）
    expect(document.body.style.overflow).toBe('hidden')

    const dismissButton = document.body.querySelector<HTMLButtonElement>(
      '[data-testid="announcement-popup-dismiss"]',
    )
    dismissButton?.click()
    await wrapper.vm.$nextTick()

    expect(dismissPopup).toHaveBeenCalledTimes(1)
    expect(wrapper.emitted('close')).toBeUndefined()
    wrapper.unmount()
  })

  it('holds the body scroll lock while open and releases it on unmount', async () => {
    const store = useAnnouncementStore()
    store.currentPopup = announcement
    const wrapper = mount(AnnouncementPopup)
    await wrapper.vm.$nextTick()

    expect(document.body.style.overflow).toBe('hidden')

    wrapper.unmount()
    expect(document.body.style.overflow).toBe('')
  })

  it('recovers from a leaked lock with resetBodyScrollLock (beforeEach contract)', () => {
    const store = useAnnouncementStore()
    store.currentPopup = announcement
    // 故意不卸载：模拟用例断言失败中断在 unmount 之前的现场。
    // 计数器此时 +1，直接断言 overflow 是 '' 会假绿 —— 真正防线是 beforeEach
    // 里的 resetBodyScrollLock()（本文件 beforeEach 已调用，这里验证复位本身）。
    const wrapper = mount(AnnouncementPopup)
    expect(document.body.style.overflow).toBe('hidden')

    resetBodyScrollLock()
    expect(document.body.style.overflow).toBe('')

    wrapper.unmount()
  })

  describe('modal 焦点管理（真 modal，不再只是属性层）', () => {
    function makeUserPopup(content = '## Body\n\ncopy') {
      return {
        id: 1,
        title: 'Modal focus announcement',
        content,
        notify_mode: 'popup' as const,
        created_at: '2026-07-24T07:30:00Z',
        updated_at: '2026-07-24T07:30:00Z',
      }
    }

    it('打开时焦点移入弹窗首个可交互元素，并给 #app 挂 aria-hidden', async () => {
      document.body.innerHTML = '<div id="app"><button id="trigger">trigger</button></div>'
      const store = useAnnouncementStore()
      store.currentPopup = makeUserPopup()
      const wrapper = mount(AnnouncementPopup)
      await wrapper.vm.$nextTick()
      await wrapper.vm.$nextTick()

      const dismiss = document.body.querySelector<HTMLButtonElement>(
        '[data-testid="announcement-popup-dismiss"]',
      )
      expect(document.activeElement).toBe(dismiss)
      expect(document.getElementById('app')?.getAttribute('aria-hidden')).toBe('true')

      wrapper.unmount()
      expect(document.getElementById('app')?.hasAttribute('aria-hidden')).toBe(false)
    })

    it('role=dialog + aria-modal + labelledby/describedby 指向真实存在的 id', async () => {
      const store = useAnnouncementStore()
      store.currentPopup = makeUserPopup()
      const wrapper = mount(AnnouncementPopup)
      await wrapper.vm.$nextTick()

      const panel = document.body.querySelector<HTMLElement>('.ann-panel')
      expect(panel?.getAttribute('role')).toBe('dialog')
      expect(panel?.getAttribute('aria-modal')).toBe('true')
      const labelledby = panel?.getAttribute('aria-labelledby') ?? ''
      const describedby = panel?.getAttribute('aria-describedby') ?? ''
      expect(document.getElementById(labelledby)).not.toBeNull()
      expect(document.getElementById(describedby)).not.toBeNull()

      wrapper.unmount()
    })

    it('Tab / Shift+Tab 在弹窗内循环（含正文链接），不逃逸', async () => {
      const store = useAnnouncementStore()
      store.currentPopup = makeUserPopup('<a href="https://example.com">docs</a>')
      const wrapper = mount(AnnouncementPopup)
      await wrapper.vm.$nextTick()

      const panel = document.body.querySelector<HTMLElement>('.ann-panel')!
      const link = panel.querySelector<HTMLElement>('a[href]')!
      const dismiss = document.body.querySelector<HTMLButtonElement>(
        '[data-testid="announcement-popup-dismiss"]',
      )!

      // 末尾（关闭按钮）→ Tab → 回到首个可聚焦元素（正文链接）
      dismiss.focus()
      panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }))
      expect(document.activeElement).toBe(link)

      // 首个 → Shift+Tab → 回到末尾
      link.focus()
      panel.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }),
      )
      expect(document.activeElement).toBe(dismiss)

      wrapper.unmount()
    })

    it('Esc 关闭弹窗并把焦点还给触发元素，同时移除 #app aria-hidden', async () => {
      document.body.innerHTML = '<div id="app"><button id="trigger">trigger</button></div>'
      const store = useAnnouncementStore()
      store.currentPopup = makeUserPopup()
      const dismissPopup = vi
        .spyOn(store, 'dismissPopup')
        .mockImplementation(() => {
          store.currentPopup = null
          return Promise.resolve()
        })
      const trigger = document.getElementById('trigger') as HTMLButtonElement
      trigger.focus()
      const wrapper = mount(AnnouncementPopup)
      await wrapper.vm.$nextTick()
      await wrapper.vm.$nextTick()

      expect(document.activeElement).not.toBe(trigger)
      expect(document.getElementById('app')?.getAttribute('aria-hidden')).toBe('true')

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      await wrapper.vm.$nextTick()

      expect(dismissPopup).toHaveBeenCalledTimes(1)
      expect(document.activeElement).toBe(trigger)
      expect(document.getElementById('app')?.hasAttribute('aria-hidden')).toBe(false)

      wrapper.unmount()
    })

    it('preview 模式下 Esc 触发 close 事件并还焦给触发元素', async () => {
      document.body.innerHTML = '<div id="app"><button id="trigger">trigger</button></div>'
      const trigger = document.getElementById('trigger') as HTMLButtonElement
      trigger.focus()
      const wrapper = mount(AnnouncementPopup, {
        props: { announcement, preview: true },
      })
      await wrapper.vm.$nextTick()
      await wrapper.vm.$nextTick()

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      await wrapper.vm.$nextTick()

      expect(wrapper.emitted('close')).toHaveLength(1)
      // 真实链路里 AnnouncementsView 在 close 事件里清掉 previewAnnouncement，
      // 弹窗随之关闭并还焦 —— 这里模拟父组件的这个动作。
      await wrapper.setProps({ announcement: null })
      await wrapper.vm.$nextTick()
      expect(document.activeElement).toBe(trigger)
      expect(document.getElementById('app')?.hasAttribute('aria-hidden')).toBe(false)

      wrapper.unmount()
    })

    it('打开状态卸载时释放背景隐藏并把焦点还给触发元素', async () => {
      document.body.innerHTML = '<div id="app"><button id="trigger">trigger</button></div>'
      const trigger = document.getElementById('trigger') as HTMLButtonElement
      trigger.focus()
      const store = useAnnouncementStore()
      store.currentPopup = makeUserPopup()
      const wrapper = mount(AnnouncementPopup)
      await wrapper.vm.$nextTick()

      expect(document.getElementById('app')?.getAttribute('aria-hidden')).toBe('true')

      wrapper.unmount()
      expect(document.getElementById('app')?.hasAttribute('aria-hidden')).toBe(false)
      expect(document.activeElement).toBe(trigger)
    })
  })
})
