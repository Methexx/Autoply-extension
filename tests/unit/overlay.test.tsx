import { afterEach, describe, expect, it } from 'vitest'
import { act } from 'react'
import { mountOverlay, OverlayController } from '../../src/content/overlay/Overlay'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

afterEach(() => {
  document.getElementById('autoply-root')?.remove()
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
})
