/**
 * 平台 → 全站 `.badge` 变体类的映射。
 *
 * `.b-*` 由 style.css 统一定义（消费 CSS 变量，明暗自适应），此处只做归类，
 * 不产生任何硬编码颜色。未知平台回退品牌蓝。
 */

const VARIANT: Record<string, string> = {
  anthropic: 'b-claude',
  openai: 'b-openai',
  gemini: 'b-gemini',
  grok: 'b-grok',
  antigravity: 'b-purple',
  composite: 'b-blue'
}

export function platformBadgeVariant(platform: string): string {
  return VARIANT[platform] ?? 'b-blue'
}
