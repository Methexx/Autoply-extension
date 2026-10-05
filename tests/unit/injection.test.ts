import { describe, it, expect, vi, beforeEach } from 'vitest'
import { handleActionClick } from '../../src/background/index'
import * as storage from '../../src/shared/storage'
import { runAutoplyScan } from '../../src/content/index'

describe('On-demand injection (M4-T8)', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    global.chrome = {
      runtime: {
        id: 'test-id',
        openOptionsPage: vi.fn().mockResolvedValue(undefined),
      },
      scripting: {
        executeScript: vi.fn().mockResolvedValue(undefined),
      },
      action: {
        onClicked: {
          addListener: vi.fn(),
        },
      },
    } as unknown as typeof chrome
  })

  it('opens options page if profile is missing', async () => {
    vi.spyOn(storage, 'getProfile').mockResolvedValue(null)
    vi.spyOn(storage, 'getSettings').mockResolvedValue({
      geminiApiKey: 'valid-key',
      model: 'gemini-1.5-flash',
      jobTextMaxChars: 4000,
    })

    const tab = { id: 101, url: 'https://boards.greenhouse.io/acme/jobs/1' } as chrome.tabs.Tab
    await handleActionClick(tab)

    expect(chrome.runtime.openOptionsPage).toHaveBeenCalled()
    expect(chrome.scripting.executeScript).not.toHaveBeenCalled()
  })

  it('opens options page if API key is missing', async () => {
    vi.spyOn(storage, 'getProfile').mockResolvedValue({
      fullName: 'Alice',
      email: 'alice@example.com',
      phone: '123',
      location: 'SF',
      links: {},
      summary: 'Summary',
      skills: [],
      education: [],
      experience: [],
      projects: [],
    })
    vi.spyOn(storage, 'getSettings').mockResolvedValue(null)

    const tab = { id: 101, url: 'https://boards.greenhouse.io/acme/jobs/1' } as chrome.tabs.Tab
    await handleActionClick(tab)

    expect(chrome.runtime.openOptionsPage).toHaveBeenCalled()
    expect(chrome.scripting.executeScript).not.toHaveBeenCalled()
  })

  it('injects content script on demand when profile and key exist', async () => {
    vi.spyOn(storage, 'getProfile').mockResolvedValue({
      fullName: 'Alice',
      email: 'alice@example.com',
      phone: '123',
      location: 'SF',
      links: {},
      summary: 'Summary',
      skills: [],
      education: [],
      experience: [],
      projects: [],
    })
    vi.spyOn(storage, 'getSettings').mockResolvedValue({
      geminiApiKey: 'valid-key',
      model: 'gemini-1.5-flash',
      jobTextMaxChars: 4000,
    })

    const tab = { id: 101, url: 'https://boards.greenhouse.io/acme/jobs/1' } as chrome.tabs.Tab
    await handleActionClick(tab)

    expect(chrome.runtime.openOptionsPage).not.toHaveBeenCalled()
    expect(chrome.scripting.executeScript).toHaveBeenCalledWith({
      target: { tabId: 101 },
      files: ['src/content/index.ts'],
    })
  })

  it('does nothing on non-http/https internal browser tabs', async () => {
    const tab = { id: 101, url: 'chrome://settings' } as chrome.tabs.Tab
    await handleActionClick(tab)

    expect(chrome.runtime.openOptionsPage).not.toHaveBeenCalled()
    expect(chrome.scripting.executeScript).not.toHaveBeenCalled()
  })

  it('runs scan in content script and detects fields', async () => {
    document.body.innerHTML = `
      <form id="apply_form">
        <label for="first">First Name</label>
        <input id="first" name="first_name" />
        <label for="last">Last Name</label>
        <input id="last" name="last_name" />
        <label for="email">Email</label>
        <input id="email" type="email" />
        <label for="q">Why do you want to work here?</label>
        <textarea id="q"></textarea>
      </form>
    `

    vi.spyOn(storage, 'getProfile').mockResolvedValue({
      fullName: 'Marie Curie',
      email: 'marie@example.com',
      phone: '',
      location: '',
      links: {},
      summary: '',
      skills: [],
      education: [],
      experience: [],
      projects: [],
    })

    const result = await runAutoplyScan()

    expect(result.filledStandardCount).toBe(3) // first, last, email
    expect(result.openEndedQuestions).toHaveLength(1)
    expect(result.openEndedQuestions[0]?.id).toBe('q')
  })
})
