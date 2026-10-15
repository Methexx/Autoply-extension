import { registerMessageHandlers } from './messaging'
import { getProfile, getSettings } from '../shared/storage'

// Register all messaging listeners
registerMessageHandlers()

export const FILL_FORM_CONTEXT_MENU_ID = 'autoply-fill-form'
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
  if (!profile || !settings?.geminiApiKey) {
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
  })
  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === FILL_FORM_CONTEXT_MENU_ID && tab) {
      void handleActionClick(tab, info.frameId)
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
