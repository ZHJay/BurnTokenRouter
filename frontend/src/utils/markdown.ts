import { marked } from 'marked'
import DOMPurify from 'dompurify'

// 与全站既有 markdown 路径完全一致的渲染配置：
// AnnouncementBell.vue:246-247 / AnnouncementPopup.vue:99-100 /
// LegalDocumentView.vue:108-109 / ModelPlazaContent.vue / AdminComplianceDialog.vue 均为此形态。
marked.setOptions({
  breaks: true,
  gfm: true,
})

/**
 * 全站 markdown → 安全 HTML 的单一事实来源。
 *
 * 调用形态照抄既有路径：`marked.parse(content)` 后 `DOMPurify.sanitize(html)`，
 * 使用 DOMPurify **默认 config**（不传任何 options）——与公告、法律、合规、广场完全一致，
 * 不额外放行 iframe/script 等高风险标签（CustomPageView.vue:244 的
 * ADD_TAGS:['iframe'] 是已知待决策问题，此处不复制）。
 *
 * 默认 config 放行标题/列表/链接/图片/强调等管理员正常表达所需元素，
 * 并剥离 script、事件处理器（onerror 等）与 javascript: 协议 URL。
 * 注意：DOMPurify 3.x 默认 config 保留 style 属性（与全站五处 markdown 路径行为一致），
 * style 外带通道的残余防线是后端 CSP style-src，如需收紧属 root 级全站决策。
 */
export function renderMarkdown(content: string): string {
  if (!content) return ''
  const html = marked.parse(content) as string
  return DOMPurify.sanitize(html)
}
