import { registerMessageHandlers } from './messaging'

// Register all messaging listeners
registerMessageHandlers()

chrome.action.onClicked.addListener(tab => {
  // M4-T8 will handle profile/key check and content-script injection.
  // For now just log that the action fired (dev only).
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.log('[Autoply SW] toolbar click on tab', tab.id)
  }
})
