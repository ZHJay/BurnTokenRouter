import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import CnBaseUrlPresets from '../CnBaseUrlPresets.vue'

describe('CnBaseUrlPresets v3 styling', () => {
  it('uses filter-chip states and keeps selection behavior', async () => {
    const wrapper = mount(CnBaseUrlPresets, {
      props: { platform: 'kimi', mode: 'coding', protocol: 'chat_completions' },
    })

    const presets = wrapper.findAll('[data-testid="cn-base-url-preset"]')
    expect(presets.length).toBeGreaterThan(0)
    expect(presets.every(preset => preset.classes().includes('filter-chip'))).toBe(true)
    expect(presets.some(preset => preset.classes().includes('on'))).toBe(true)

    await presets[0].trigger('click')
    expect(wrapper.emitted('select')).toHaveLength(1)
  })
})
