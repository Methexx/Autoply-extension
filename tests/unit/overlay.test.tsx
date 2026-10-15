import { afterEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { mountOverlay, OverlayController } from '../../src/content/overlay/Overlay'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

afterEach(() => {
  document.getElementById('autoply-root')?.remove()
  vi.restoreAllMocks()
})

describe('review overlay shell', () => {
  it('mounts inside a Shadow DOM and updates its progress state', async () => {
    let controller: OverlayController
    await act(async () => {
      controller = mountOverlay()
    })
    const host = document.getElementById('autoply-root')

    expect(host?.shadowRoot?.textContent).toContain('Scanning the form…')
    expect(host?.shadowRoot?.querySelector('style')).not.toBeNull()

    await act(async () => controller.setState('drafting'))
    expect(host?.shadowRoot?.textContent).toContain('Drafting answers with Gemini…')
  })

  it('closes on Escape without altering page content', async () => {
    document.body.innerHTML = '<form><input value="unchanged" /></form>'
    await act(async () => {
      mountOverlay('drafting')
    })

    await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })))

    expect(document.getElementById('autoply-root')).toBeNull()
    expect(document.querySelector('input')?.value).toBe('unchanged')
  })

  it.each([
    ['NO_PROFILE', 'Add your profile first.', 'Open options'],
    ['NO_KEY', 'Add your Gemini API key to get drafts.', 'Open options'],
    ['INVALID_KEY', 'Gemini rejected your API key.', 'Open options'],
    ['RATE_LIMITED', "Gemini's rate limit was reached. Wait a minute, then try again.", 'Retry'],
    ['NETWORK', "Couldn't reach Gemini. Check your connection.", 'Retry'],
    ['BAD_MODEL_OUTPUT', "The model's answer couldn't be used.", 'Retry'],
    ['NO_FIELDS', "I couldn't find an application form on this page.", 'Close'],
    ['UNSUPPORTED_PAGE', "This page isn't supported yet.", 'Close'],
  ] as const)('shows the documented %s error and action', async (code, copy, action) => {
    const sendMessage = vi.fn()
    Object.defineProperty(globalThis, 'chrome', {
      configurable: true,
      value: { runtime: { sendMessage } },
    })
    let retryCount = 0
    let controller: OverlayController
    await act(async () => {
      controller = mountOverlay()
      controller.showError({ code, message: 'internal error detail', retryable: action === 'Retry' }, () => {
        retryCount++
      })
    })
    const host = document.getElementById('autoply-root')
    const button = host?.shadowRoot?.querySelector('button.autoply-fill-approved') as HTMLButtonElement

    expect(host?.shadowRoot?.textContent).toContain(copy)
    expect(host?.shadowRoot?.textContent).not.toContain('internal error detail')
    expect(button.textContent).toBe(action)
    await act(async () => button.click())

    if (action === 'Open options') {
      expect(sendMessage).toHaveBeenCalledWith({
        type: 'OPEN_OPTIONS',
        reason: code === 'NO_PROFILE' ? 'no_profile' : 'no_key',
      })
    } else if (action === 'Retry') {
      expect(retryCount).toBe(1)
    } else {
      expect(document.getElementById('autoply-root')).toBeNull()
    }
  })
})
