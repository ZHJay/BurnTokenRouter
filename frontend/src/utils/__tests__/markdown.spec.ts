import { describe, expect, it } from 'vitest'
import { renderMarkdown } from '../markdown'

// 真实 DOMPurify（不 mock）：这些断言锁住的是消毒本身，mock 掉就毫无意义。
describe('renderMarkdown', () => {
  it('strips <script> tags', () => {
    const html = renderMarkdown('<script>alert(1)</script>Hello')
    expect(html).not.toContain('<script')
    expect(html).not.toContain('alert(1)')
    expect(html).toContain('Hello')
  })

  it('strips inline event handlers (onerror/onload/onclick)', () => {
    const html = renderMarkdown('<img src="x" onerror="alert(1)"><a href="https://ok.example" onclick="steal()">link</a>')
    expect(html).not.toContain('onerror')
    expect(html).not.toContain('onclick')
    expect(html).not.toContain('steal')
    expect(html).toContain('ok.example')
  })

  it('blocks javascript: URLs in links and images', () => {
    const html = renderMarkdown(
      '[click me](javascript:alert(1)) ![img](javascript:alert(2))'
    )
    expect(html).not.toContain('javascript:')
    expect(html).not.toContain('alert(')
  })

  it('keeps style attributes like every other site-wide markdown path (default config)', () => {
    // 事实锁定：DOMPurify 3.3.1 默认 config（本站公告/法律/合规/广场同款）放行 style 属性，
    // 与 AnnouncementBell/LegalDocumentView 等五处路径行为完全一致。style 外带通道的
    // 残余防线是后端 CSP style-src，若全站收紧属 root 决策，不在本文件单点收窄。
    const html = renderMarkdown('<div style="background:url(https://evil.example/x)">box</div>')
    expect(html).toContain('style=')
    expect(html).toContain('box')
  })

  it('keeps normal markdown: headings, lists, links, images, bold', () => {
    const md = [
      '# Title',
      '',
      '- item one',
      '- item two',
      '',
      'Text with **bold** and [a link](https://example.com/page).',
      '',
      '![alt](https://example.com/pic.png)',
    ].join('\n')
    const html = renderMarkdown(md)
    expect(html).toContain('<h1>Title</h1>')
    expect(html).toContain('<li>item one</li>')
    expect(html).toContain('<li>item two</li>')
    expect(html).toContain('<strong>bold</strong>')
    expect(html).toContain('<a href="https://example.com/page">a link</a>')
    expect(html).toContain('<img src="https://example.com/pic.png" alt="alt"')
  })

  it('keeps safe inline HTML the admin may already be using', () => {
    const html = renderMarkdown('<section id="custom-home"><h2>Hello</h2></section>')
    expect(html).toContain('id="custom-home"')
    expect(html).toContain('<h2>Hello</h2>')
  })

  it.each(['', '   ', '\n\t'])('returns empty for blank input %j', (input) => {
    expect(renderMarkdown(input)).toBe('')
  })

  it('does not crash on undefined', () => {
    // @ts-expect-error -- 显式验证调用方误传 undefined 时也不炸
    expect(renderMarkdown(undefined)).toBe('')
  })

  it('sanitizes script mixed into an otherwise normal document', () => {
    const md = [
      '# Welcome',
      '',
      '<script>document.cookie</script>',
      '',
      'More content.',
    ].join('\n')
    const html = renderMarkdown(md)
    expect(html).not.toContain('<script')
    expect(html).not.toContain('document.cookie')
    expect(html).toContain('<h1>Welcome</h1>')
    expect(html).toContain('More content.')
  })
})
