import { registerMessageHandlers } from './messaging'
import { getProfile, getSettings } from '../shared/storage'

// Register all messaging listeners
registerMessageHandlers()

export const FILL_FORM_CONTEXT_MENU_ID = 'autoply-fill-form'
export const ASK_CONTEXT_MENU_ID = 'autoply-ask'
const DEFAULT_ACTION_TITLE = 'Autoply: fill this application'
const INJECTION_FAILURE_TITLE = "Autoply couldn't run on this page. Open an application form and try again."

function showInjectionFailure(tabId: number): void {
  void chrome.action?.setBadgeText?.({ tabId, text: '!' })
  void chrome.action?.setBadgeBackgroundColor?.({ tabId, color: '#b42318' })
  void chrome.action?.setTitle?.({ tabId, title: INJECTION_FAILURE_TITLE })
}

function clearActionStatus(tabId: number): void {
  void chrome.action?.setBadgeText?.({ tabId, text: '' })
  void chrome.action?.setTitle?.({ tabId, title: DEFAULT_ACTION_TITLE })
}

export async function handleActionClick(tab: chrome.tabs.Tab, frameId?: number): Promise<void> {
  if (!tab.id || !tab.url || (!tab.url.startsWith('http://') && !tab.url.startsWith('https://'))) {
    if (tab.id) showInjectionFailure(tab.id)
    return
  }

  const profile = await getProfile()
  const settings = await getSettings()

  // Missing profile or API key opens options page per M4-T8 AC
  if (!profile || !(settings?.geminiApiKey || settings?.openaiApiKey)) {
    if (chrome.runtime.openOptionsPage) {
      await chrome.runtime.openOptionsPage()
    }
    return
  }

  // Inject content script only after the user's explicit toolbar/menu action.
  try {
    await chrome.scripting.executeScript({
      target: frameId === undefined ? { tabId: tab.id } : { tabId: tab.id, frameIds: [frameId] },
      files: ['content.js'],
    })
    clearActionStatus(tab.id)
  } catch {
    // A page may block extension access. We cannot inject an overlay in that case,
    // so the action badge and tooltip give the user a visible, safe explanation.
    showInjectionFailure(tab.id)
  }
}

export function registerContextMenu(): void {
  if (!chrome.contextMenus) return
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: FILL_FORM_CONTEXT_MENU_ID,
      title: 'Fill this page’s form with Autoply',
      contexts: ['page', 'frame', 'editable'],
    })
    chrome.contextMenus.create({ id: ASK_CONTEXT_MENU_ID, title: 'Ask Autoply about selected text', contexts: ['selection'] })
  })
  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === FILL_FORM_CONTEXT_MENU_ID && tab) {
      void handleActionClick(tab, info.frameId)
    }
    if (info.menuItemId === ASK_CONTEXT_MENU_ID && tab?.id && info.selectionText?.trim()) {
      const tabId = tab.id
      const frameId = info.frameId ?? 0
      const selection = info.selectionText.slice(0, 4000)
      void chrome.scripting.executeScript({ target: { tabId, frameIds: [frameId] }, files: ['ask.js'] })
        .then(() => chrome.tabs.sendMessage(tabId, { type: 'AUTOPLY_OPEN_ASK', selection }, { frameId }))
        .catch(() => showInjectionFailure(tabId))
    }
  })
}

if (typeof chrome !== 'undefined' && chrome.action?.onClicked) {
  chrome.action.onClicked.addListener((tab) => {
    void handleActionClick(tab)
  })
}

if (typeof chrome !== 'undefined' && chrome.contextMenus) {
  registerContextMenu()
}
