import { describe, it, expect, vi, beforeEach } from 'vitest'
import { FILL_FORM_CONTEXT_MENU_ID, handleActionClick, registerContextMenu } from '../../src/background/index'
import * as storage from '../../src/shared/storage'
import { runAutoplyScan } from '../../src/content/index'

describe('On-demand injection (M4-T8)', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    global.chrome = {
      runtime: {
        id: 'test-id',
        openOptionsPage: vi.fn().mockResolvedValue(undefined),
        sendMessage: vi.fn((_message: unknown, callback: (reply: unknown) => void) => {
          callback({ ok: true, drafts: [{ id: 'q', status: 'ok', answer: 'Draft answer' }] })
        }),
      },
      scripting: {
        executeScript: vi.fn().mockResolvedValue(undefined),
      },
      action: {
        onClicked: {
          addListener: vi.fn(),
        },
        setBadgeText: vi.fn(),
        setBadgeBackgroundColor: vi.fn(),
        setTitle: vi.fn(),
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
      files: ['content.js'],
    })
  })

  it('does nothing on non-http/https internal browser tabs', async () => {
    const tab = { id: 101, url: 'chrome://settings' } as chrome.tabs.Tab
    await handleActionClick(tab)

    expect(chrome.runtime.openOptionsPage).not.toHaveBeenCalled()
    expect(chrome.scripting.executeScript).not.toHaveBeenCalled()
    expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ tabId: 101, text: '!' })
  })

  it('shows an action error when Chrome blocks script injection', async () => {
    vi.spyOn(storage, 'getProfile').mockResolvedValue({
      fullName: 'Alice', email: 'alice@example.com', phone: '123', location: 'SF', links: {},
      summary: 'Summary', skills: [], education: [], experience: [], projects: [],
    })
    vi.spyOn(storage, 'getSettings').mockResolvedValue({
      geminiApiKey: 'valid-key', model: 'gemini-1.5-flash', jobTextMaxChars: 4000,
    })
    vi.mocked(chrome.scripting.executeScript).mockRejectedValue(new Error('Access denied'))

    await handleActionClick({ id: 101, url: 'https://example.com/apply' } as chrome.tabs.Tab)

    expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ tabId: 101, text: '!' })
    expect(chrome.action.setTitle).toHaveBeenCalledWith(expect.objectContaining({ tabId: 101 }))
  })

  it('adds the Fill this page form context-menu action', () => {
    const onClicked = { addListener: vi.fn() }
    const removeAll = vi.fn((callback: () => void) => callback())
    const create = vi.fn()
    global.chrome = {
      ...chrome,
      contextMenus: { removeAll, create, onClicked },
    } as unknown as typeof chrome

    registerContextMenu()

    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      id: FILL_FORM_CONTEXT_MENU_ID,
      title: 'Fill this page’s form with Autoply',
    }))
    expect(onClicked.addListener).toHaveBeenCalled()
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
    expect(document.getElementById('autoply-root')?.shadowRoot?.textContent).toContain(
      'Draft answer',
    )
  })

  it('shows a clear error when the page has no usable application fields', async () => {
    document.body.innerHTML = '<main><h1>Job listing</h1><p>Read the role details here.</p></main>'

    const result = await runAutoplyScan()

    expect(result.filledStandardCount).toBe(0)
    expect(result.openEndedQuestions).toEqual([])
    expect(document.getElementById('autoply-root')?.shadowRoot?.textContent).toContain(
      "I couldn't find an application form on this page.",
    )
  })

  it('confirms standard-only fills instead of leaving the panel drafting', async () => {
    document.body.innerHTML = '<form><label for="email">Email</label><input id="email" type="email" /></form>'
    vi.spyOn(storage, 'getProfile').mockResolvedValue({
      fullName: 'Marie Curie', email: 'marie@example.com', phone: '', location: '', links: {},
      summary: '', skills: [], education: [], experience: [], projects: [],
    })

    await runAutoplyScan()

    expect(document.getElementById('autoply-root')?.shadowRoot?.textContent).toContain(
      'Filled 1 standard field.',
    )
  })
})
