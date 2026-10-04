// Service worker entry point.
// This file is intentionally minimal at scaffold stage.
// Messaging, Gemini calls, and prompt logic are added in M2-T3 and M3.

chrome.action.onClicked.addListener(tab => {
  // M4-T8 will handle profile/key check and content-script injection.
  // For now just log that the action fired (dev only).
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.log('[Autoply SW] toolbar click on tab', tab.id)
  }
})
