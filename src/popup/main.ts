import './popup.css'

const button = document.querySelector<HTMLButtonElement>('#fill-form')
const status = document.querySelector<HTMLElement>('#status')

if (!button || !status) throw new Error('Popup controls were not found')

const popupButton = button
const statusElement = status

function setStatus(message: string): void {
  statusElement.textContent = message
}

async function startScan(): Promise<void> {
  popupButton.disabled = true
  setStatus('Starting Autoply on this page…')

  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true })
    if (!tab?.id) {
      setStatus('Autoply can run only on a web page with an application form.')
      return
    }

    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] })
    setStatus('Scanning started. Check the page for the Autoply panel.')
  } catch {
    setStatus("Chrome blocked Autoply on this page. Check the extension's Site access setting and try again.")
  } finally {
    popupButton.disabled = false
  }
}

popupButton.addEventListener('click', () => {
  void startScan()
})
