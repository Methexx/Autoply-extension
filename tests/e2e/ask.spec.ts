import { expect, test } from '@playwright/test'

test('selected-text assistant shows answers, supports follow-ups and never fills or submits', async ({ page }) => {
  await page.addInitScript(() => {
    let listener: ((message: unknown, sender: { id: string }, respond: (value: unknown) => void) => void) | undefined
    Object.defineProperty(globalThis, 'chrome', { value: { runtime: {
      id: 'test-extension',
      onMessage: { addListener: (fn: typeof listener) => { listener = fn } },
      sendMessage: async (message: { conversation: unknown[] }) => ({ ok: true, drafts: [{ id: 'chat', status: 'ok', answer: message.conversation.length ? 'Shorter answer' : 'First answer' }] }),
    } } })
    Object.assign(window, { openTestAsk: () => listener?.({ type: 'AUTOPLY_OPEN_ASK', selection: 'Why this role?' }, { id: 'test-extension' }, () => {}) })
  })
  await page.goto('http://127.0.0.1:4173/src/options/index.html')
  await page.setContent('<main><p>We build useful software.</p><form><textarea id="answer"></textarea><button>Submit</button></form></main>')
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (text: string) => { Object.assign(window, { copiedAnswer: text }) } } })
    document.querySelector('form')?.addEventListener('submit', event => { event.preventDefault(); Object.assign(window, { submitted: true }) })
  })
  await page.addScriptTag({ url: 'http://127.0.0.1:4173/ask.js' })
  await page.evaluate(() => (window as unknown as { openTestAsk: () => void }).openTestAsk())
  await expect(page.getByText('First answer')).toBeVisible()
  await page.getByRole('button', { name: 'Copy answer' }).click()
  expect(await page.evaluate(() => (window as unknown as { copiedAnswer?: string }).copiedAnswer)).toBe('First answer')
  await expect(page.getByText('Why this role?')).toBeVisible()
  await page.getByLabel('Ask a follow-up').fill('Make it shorter')
  await page.getByRole('button', { name: 'Send', exact: true }).click()
  await expect(page.getByText('Shorter answer')).toBeVisible()
  await expect(page.locator('#answer')).toHaveValue('')
  expect(await page.evaluate(() => (window as unknown as { submitted?: boolean }).submitted)).not.toBe(true)
  await page.getByRole('button', { name: 'Close Ask Autoply' }).click()
  await expect(page.locator('#autoply-ask-root')).toHaveCount(0)
})
