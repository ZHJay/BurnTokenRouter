/**
 * 视觉契约测试 —— 邮件模板编辑器
 *
 * 本测试的核心目的是锁住**两层的分界**，这是本任务最容易搞混的一点：
 *
 *   · 邮件 HTML 正文（buildAppleBaselineEmail 产出，会发进收件人邮箱）
 *       → 必须内联 style + 字面色值 + <table> 布局
 *       → 禁止 CSS 变量、禁止 backdrop-filter（Gmail / Outlook / Apple Mail 不支持）
 *       → 禁止 logo 图片，品牌用 {{site_name}} 纯文本
 *
 *   · 编辑器 UI 外壳（<template> + <style scoped>，只在后台页面里显示）
 *       → 照常消费 CSS 变量，禁止硬编码颜色
 *
 * 同时验证保存逻辑零改动：插入基准模板只写入 textarea，不触发任何写接口。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import EmailTemplateEditor from '../EmailTemplateEditor.vue'

const source = readFileSync(
  resolve(process.cwd(), 'src/views/admin/settings/EmailTemplateEditor.vue'),
  'utf8',
)

/** 用花括号配平切出 buildAppleBaselineEmail 的函数体（= 邮件正文层） */
function emailBuilderSource(): string {
  const start = source.indexOf('function buildAppleBaselineEmail')
  expect(start).toBeGreaterThan(-1)
  let depth = 0
  const open = source.indexOf('{', start)
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1
    else if (source[i] === '}') {
      depth -= 1
      if (depth === 0) return source.slice(start, i + 1)
    }
  }
  throw new Error('unbalanced braces in buildAppleBaselineEmail')
}

/** 外壳层 = <template> 段 + <style scoped> 段（不含邮件正文） */
function shellSource(): string {
  const builder = emailBuilderSource()
  return source.replace(builder, '')
}

/**
 * 取真正的 <style scoped> 块。
 * 用 lastIndexOf 而非 indexOf：脚本段的注释里出现过字面量 "<style>"
 * （说明邮件客户端对 <style> 块支持差），indexOf 会命中那条注释，
 * 把邮件正文的字面色值一起圈进来，造成假阳性。
 * 同时剥掉 CSS 注释，避免注释里的 token 对照表被当成硬编码颜色。
 */
function scopedStyleBlock(): string {
  const shell = shellSource()
  const start = shell.lastIndexOf('<style')
  expect(start).toBeGreaterThan(-1)
  return shell.slice(start).replace(/\/\*[\s\S]*?\*\//g, '')
}

const { getEmailTemplates, getEmailTemplate, previewEmailTemplate } = vi.hoisted(() => ({
  getEmailTemplates: vi.fn(),
  getEmailTemplate: vi.fn(),
  previewEmailTemplate: vi.fn(),
}))
const updateEmailTemplate = vi.hoisted(() => vi.fn())
const restoreOfficialEmailTemplate = vi.hoisted(() => vi.fn())
const showSuccess = vi.hoisted(() => vi.fn())

vi.mock('@/api', () => ({
  adminAPI: {
    settings: {
      getEmailTemplates,
      getEmailTemplate,
      updateEmailTemplate,
      previewEmailTemplate,
      restoreOfficialEmailTemplate,
    },
  },
}))

vi.mock('@/stores', () => ({
  useAppStore: () => ({ showSuccess, showError: vi.fn() }),
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key, locale: { value: 'zh' } }),
}))

async function mountEditor(templateLocale = 'zh') {
  getEmailTemplates.mockResolvedValue({
    events: [{ value: 'auth.verify_code', category: 'auth' }],
    locales: [templateLocale],
    placeholders: ['site_name'],
  })
  getEmailTemplate.mockResolvedValue({
    subject: 'Existing subject',
    html: '<p>existing custom body</p>',
    is_custom: true,
    placeholders: ['site_name'],
  })
  previewEmailTemplate.mockResolvedValue({ subject: 'Existing subject', html: '<p>preview</p>' })

  const wrapper = mount(EmailTemplateEditor)
  await flushPromises()
  return wrapper
}

describe('EmailTemplateEditor 视觉契约', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
  })

  describe('邮件正文层：内联样式 + 字面色值（收件端不支持 CSS 变量）', () => {
    it('邮件正文不含任何 CSS 变量', () => {
      expect(emailBuilderSource()).not.toMatch(/var\(--/)
    })

    it('邮件正文不含 backdrop-filter 等收件端不支持的现代 CSS', () => {
      const email = emailBuilderSource()
      expect(email).not.toMatch(/backdrop-filter/)
      expect(email).not.toMatch(/backdrop-blur/)
    })

    it('邮件正文用内联 style，且色值与设计 token 对应', () => {
      const email = emailBuilderSource()
      expect(email).toMatch(/style="/)
      // 苹果蓝亮色（--blue）用于 CTA 与链接
      expect(email).toContain('#0071e3')
      // 文字三档 + 底色两档
      expect(email).toContain('#1d1d1f') // --text-primary
      expect(email).toContain('#6e6e73') // --text-secondary
      expect(email).toContain('#86868b') // --text-tertiary
      expect(email).toContain('#f5f5f7') // --bg
      expect(email).toContain('#ffffff') // --bg-elevated
    })

    it('邮件正文不引用 logo 图片，品牌为站点名纯文本', () => {
      const email = emailBuilderSource()
      expect(email).not.toMatch(/<img/i)
      expect(email).not.toMatch(/\.(png|jpe?g|svg|webp)/i)
      expect(email).toContain('{{site_name}}')
    })

    it('邮件正文用 table 布局并锁定亮色（邮件端不做暗色反转）', () => {
      const email = emailBuilderSource()
      expect(email).toMatch(/<table role="presentation"/)
      expect(email).toContain('color-scheme')
      expect(email).toContain('light')
    })
  })

  describe('编辑器外壳层：只消费 CSS 变量', () => {
    it('外壳样式不硬编码颜色（唯一例外是 iframe 空态兜底白底）', () => {
      const hexes = scopedStyleBlock().match(/#[0-9a-fA-F]{3,8}\b/g) ?? []
      expect(hexes.map((h) => h.toLowerCase()).filter((h) => h !== '#ffffff')).toEqual([])
    })

    it('外壳样式确实在消费设计 token', () => {
      const styleBlock = scopedStyleBlock()
      expect(styleBlock).toMatch(/var\(--separator\)/)
      expect(styleBlock).toMatch(/var\(--text-primary\)/)
      expect(styleBlock).toMatch(/var\(--blue\)/)
    })

    it('外壳与邮件正文确实是两层：外壳用变量，正文用字面色值', () => {
      // 外壳不出现邮件正文的字面色值
      expect(scopedStyleBlock()).not.toContain('#0071e3')
      // 邮件正文不出现变量
      expect(emailBuilderSource()).not.toMatch(/var\(--/)
    })
  })

  describe('插入基准模板：只改视觉，不碰保存逻辑', () => {
    it('把 Apple 基准模板写入 HTML 文本域，且不调用任何写接口', async () => {
      const wrapper = await mountEditor('zh')

      const textarea = wrapper.get('#email-template-html')
      expect((textarea.element as HTMLTextAreaElement).value).toContain('existing custom body')

      await wrapper.get('[data-testid="email-template-insert-baseline"]').trigger('click')
      await flushPromises()

      const value = (textarea.element as HTMLTextAreaElement).value
      expect(value).toContain('{{site_name}}')
      expect(value).toContain('#0071e3')
      expect(value).not.toContain('existing custom body')

      // 保存逻辑零改动：插入不触发保存/恢复
      expect(updateEmailTemplate).not.toHaveBeenCalled()
      expect(restoreOfficialEmailTemplate).not.toHaveBeenCalled()
      expect(showSuccess).toHaveBeenCalledWith(
        'admin.settings.emailTemplates.insertBaselineSuccess',
      )

      wrapper.unmount()
    })

    it('覆盖已有内容前先确认，用户取消则不改动', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(false)
      const wrapper = await mountEditor('zh')

      await wrapper.get('[data-testid="email-template-insert-baseline"]').trigger('click')
      await flushPromises()

      const value = (wrapper.get('#email-template-html').element as HTMLTextAreaElement).value
      expect(value).toContain('existing custom body')
      expect(value).not.toContain('#0071e3')

      wrapper.unmount()
    })

    it('语言跟随所选模板 locale，而非界面语言', async () => {
      const wrapper = await mountEditor('en')

      await wrapper.get('[data-testid="email-template-insert-baseline"]').trigger('click')
      await flushPromises()

      const value = (wrapper.get('#email-template-html').element as HTMLTextAreaElement).value
      expect(value).toContain('lang="en"')
      expect(value).toContain('View details')

      wrapper.unmount()
    })
  })
})
