import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import AccountTableFilters from '../AccountTableFilters.vue'

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return {
    ...actual,
    useI18n: () => ({ t: (key: string) => key })
  }
})

const SelectStub = {
  props: ['modelValue', 'options', 'ariaLabel'],
  emits: ['update:modelValue', 'change'],
  template:
    '<button type="button" class="select-stub" :aria-label="ariaLabel" @click="$emit(\'update:modelValue\', options[1]?.value); $emit(\'change\')">{{ ariaLabel }}</button>'
}

const SearchInputStub = {
  props: ['modelValue', 'placeholder'],
  emits: ['update:modelValue', 'search'],
  template: '<input class="search-stub" :value="modelValue" :placeholder="placeholder" />'
}

function mountFilters() {
  return mount(AccountTableFilters, {
    props: {
      searchQuery: '',
      filters: {
        platform: '',
        type: '',
        status: '',
        privacy_mode: '',
        group: ''
      },
      groups: []
    },
    global: {
      stubs: {
        Select: SelectStub,
        SearchInput: SearchInputStub
      }
    }
  })
}

describe('AccountTableFilters Apple toolbar hierarchy', () => {
  it('shows search plus group/status first and keeps advanced production filters expandable', async () => {
    const wrapper = mountFilters()

    expect(wrapper.get('.account-filter-search').isVisible()).toBe(true)
    expect(wrapper.get('[data-filter="group"]').isVisible()).toBe(true)
    expect(wrapper.get('[data-filter="status"]').isVisible()).toBe(true)
    expect(wrapper.find('[data-filter="platform"]').exists()).toBe(false)
    expect(wrapper.find('[data-filter="type"]').exists()).toBe(false)
    expect(wrapper.find('[data-filter="privacy"]').exists()).toBe(false)

    await wrapper.get('[data-test="account-advanced-filters-toggle"]').trigger('click')

    expect(wrapper.get('[data-filter="platform"]').isVisible()).toBe(true)
    expect(wrapper.get('[data-filter="type"]').isVisible()).toBe(true)
    expect(wrapper.get('[data-filter="privacy"]').isVisible()).toBe(true)
  })
})
