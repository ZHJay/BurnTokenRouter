import { beforeEach, describe, expect, it, vi } from 'vitest'

import { handleRadioGroupKeydown } from '../radioGroupKeyboard'

function buildGroup(
  count = 3,
  options: { disabledIndex?: number; ariaDisabledIndex?: number } = {},
) {
  const group = document.createElement('div')
  group.setAttribute('role', 'radiogroup')

  const radios: HTMLButtonElement[] = []
  for (let i = 0; i < count; i += 1) {
    const radio = document.createElement('button')
    radio.setAttribute('role', 'radio')
    radio.textContent = `option-${i}`
    if (options.disabledIndex === i) {
      radio.setAttribute('disabled', '')
    }
    if (options.ariaDisabledIndex === i) {
      radio.setAttribute('aria-disabled', 'true')
    }
    group.appendChild(radio)
    radios.push(radio)
  }

  document.body.appendChild(group)
  return { group, radios }
}

function press(target: HTMLElement, key: string) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
  // currentTarget is only populated while dispatching, so bind the listener first.
  target.addEventListener('keydown', handleRadioGroupKeydown)
  target.dispatchEvent(event)
  target.removeEventListener('keydown', handleRadioGroupKeydown)
  return event
}

describe('handleRadioGroupKeydown', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('moves forward on ArrowRight and ArrowDown by clicking the next radio', () => {
    const { radios } = buildGroup(3)
    const clicks = radios.map((radio) => {
      const spy = vi.fn()
      radio.addEventListener('click', spy)
      return spy
    })

    press(radios[0], 'ArrowRight')
    expect(clicks[1]).toHaveBeenCalledTimes(1)
    expect(document.activeElement).toBe(radios[1])

    press(radios[1], 'ArrowDown')
    expect(clicks[2]).toHaveBeenCalledTimes(1)
    expect(document.activeElement).toBe(radios[2])
  })

  it('moves backward on ArrowLeft and ArrowUp', () => {
    const { radios } = buildGroup(3)
    const clicks = radios.map((radio) => {
      const spy = vi.fn()
      radio.addEventListener('click', spy)
      return spy
    })

    press(radios[2], 'ArrowLeft')
    expect(clicks[1]).toHaveBeenCalledTimes(1)

    press(radios[1], 'ArrowUp')
    expect(clicks[0]).toHaveBeenCalledTimes(1)
  })

  it('wraps around at both ends', () => {
    const { radios } = buildGroup(3)
    const firstClick = vi.fn()
    const lastClick = vi.fn()
    radios[0].addEventListener('click', firstClick)
    radios[2].addEventListener('click', lastClick)

    press(radios[0], 'ArrowLeft')
    expect(lastClick).toHaveBeenCalledTimes(1)

    press(radios[2], 'ArrowRight')
    expect(firstClick).toHaveBeenCalledTimes(1)
  })

  it('prevents default so arrow keys do not scroll the page', () => {
    const { radios } = buildGroup(2)
    const event = press(radios[0], 'ArrowRight')
    expect(event.defaultPrevented).toBe(true)
  })

  it('ignores keys that are not arrows', () => {
    const { radios } = buildGroup(2)
    const click = vi.fn()
    radios[1].addEventListener('click', click)

    const event = press(radios[0], 'Enter')
    expect(click).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(false)
  })

  it('skips disabled radios', () => {
    const { radios } = buildGroup(3, { disabledIndex: 1 })
    const skipped = vi.fn()
    const landed = vi.fn()
    radios[1].addEventListener('click', skipped)
    radios[2].addEventListener('click', landed)

    press(radios[0], 'ArrowRight')
    expect(skipped).not.toHaveBeenCalled()
    expect(landed).toHaveBeenCalledTimes(1)
  })

  it('skips aria-disabled radios', () => {
    const { radios } = buildGroup(3, { ariaDisabledIndex: 1 })
    const skipped = vi.fn()
    const landed = vi.fn()
    radios[1].addEventListener('click', skipped)
    radios[2].addEventListener('click', landed)

    press(radios[0], 'ArrowRight')
    expect(skipped).not.toHaveBeenCalled()
    expect(landed).toHaveBeenCalledTimes(1)
  })

  it('does nothing for a single-option group', () => {
    const { radios } = buildGroup(1)
    const click = vi.fn()
    radios[0].addEventListener('click', click)

    const event = press(radios[0], 'ArrowRight')
    expect(click).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(false)
  })

  it('does nothing when the target is outside a radiogroup', () => {
    const orphan = document.createElement('button')
    orphan.setAttribute('role', 'radio')
    document.body.appendChild(orphan)
    const click = vi.fn()
    orphan.addEventListener('click', click)

    const event = press(orphan, 'ArrowRight')
    expect(click).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(false)
  })
})
