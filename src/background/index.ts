import { registerMessageHandlers } from './messaging'
import { getProfile, getSettings } from '../shared/storage'

// Register all messaging listeners
registerMessageHandlers()

export async function handleActionClick(tab: chrome.tabs.Tab): Promise<void> {
  if (!tab.id || !tab.url || (!tab.url.startsWith('http://') && !tab.url.startsWith('https://'))) {
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

  // Inject content script into active tab on demand
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['src/content/index.ts'],
  })
}

if (typeof chrome !== 'undefined' && chrome.action?.onClicked) {
  chrome.action.onClicked.addListener((tab) => {
    void handleActionClick(tab)
  })
}
