import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { readFileSync } from 'node:fs'

const contentScript = 'http://127.0.0.1:4173/content.js'
const greenhouseFixture = readFileSync(new URL('../fixtures/greenhouse/application.html', import.meta.url), 'utf8')
const leverFixture = readFileSync(new URL('../fixtures/lever/application.html', import.meta.url), 'utf8')
let injectionCount = 0

const profile = {
  fullName: 'Alex Candidate',
  email: 'alex@example.com',
  phone: '555-0100',
  location: 'Colombo, Sri Lanka',
  links: { linkedin: 'https://linkedin.com/in/alex', github: 'https://github.com/alex' },
  summary: 'Early-career software engineer.',
  skills: ['TypeScript'],
  education: [],
  experience: [],
  projects: [],
}

declare global {
  interface Window {
    __autoplyE2eMode?: 'success' | 'needs_input' | 'over_limit' | 'rate_limited' | 'invalid_key'
    submitted?: boolean
  }
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript((storedProfile) => {
    const profileKey = 'autoply_profile'
    const settingsKey = 'autoply_settings'
    window.__autoplyE2eMode = 'success'
    Object.defineProperty(globalThis, 'chrome', {
      value: {
        runtime: {
          id: 'autoply-e2e',
          sendMessage: (message: { type: string; questions?: Array<{ id: string; kind: string }> }, callback: (value: unknown) => void) => {
            if (message.type === 'DRAFT_REQUEST') {
              if (window.__autoplyE2eMode === 'rate_limited') {
                callback({ ok: false, error: { code: 'RATE_LIMITED', message: 'internal test error', retryable: true } })
                return
              }
              if (window.__autoplyE2eMode === 'invalid_key') {
                callback({ ok: false, error: { code: 'INVALID_KEY', message: 'internal test error', retryable: false } })
                return
              }
              callback({
                ok: true,
                drafts: message.questions?.map(question => ({
                  id: question.id,
                  status: window.__autoplyE2eMode === 'needs_input' ? 'needs_input' : 'ok',
                  answer: window.__autoplyE2eMode === 'needs_input'
                    ? ''
                    : window.__autoplyE2eMode === 'over_limit'
                    ? 'This draft deliberately exceeds the field limit.'.repeat(100)
                    : question.kind === 'select' || question.kind === 'radio' ? 'LinkedIn' : 'Draft answer.',
                })),
              })
              return
            }
            callback({ ok: true, drafts: [{ id: 'q', status: 'ok', answer: 'Regenerated draft.' }] })
          },
        },
        storage: {
          local: {
            get: async (key: string) => key === profileKey
              ? { [profileKey]: storedProfile }
              : { [settingsKey]: { geminiApiKey: 'test', model: 'test', jobTextMaxChars: 4000 } },
          },
        },
      },
    })
  }, profile)
})

async function loadFixture(page: Page, fixture: string) {
  await page.goto('http://127.0.0.1:4173/src/options/index.html')
  await page.setContent(fixture)
  await page.locator('form').evaluate(form => {
    const view = form.ownerDocument.defaultView as Window & { submitted?: boolean }
    view.submitted = false
    form.addEventListener('submit', event => {
      event.preventDefault()
      view.submitted = true
    })
  })
  injectionCount++
  await page.addScriptTag({ url: `${contentScript}?e2e=${injectionCount}`, type: 'module' })
  await expect(page.locator('#autoply-root')).toBeAttached()
}

for (const fixture of [
  { name: 'Greenhouse', html: greenhouseFixture, nameSelector: '#first_name', emailSelector: '#email', questionSelector: '#job_application_answers_attributes_2_text_value', sensitiveSelector: '#gender', sensitiveIsRadio: false },
  { name: 'Lever', html: leverFixture, nameSelector: '[name="name"]', emailSelector: '[name="email"]', questionSelector: '[name="comments"]', sensitiveSelector: '[name="cards[sponsorship][field0]"]', sensitiveIsRadio: true },
]) {
  test(`fills the ${fixture.name} fixture only after approval and never submits`, async ({ page }) => {
    await loadFixture(page, fixture.html)
    const overlay = page.locator('#autoply-root')
    await expect.poll(() => overlay.evaluate(host => host.shadowRoot?.textContent ?? '')).toContain('Draft answer.')
    await expect(page.locator(fixture.nameSelector)).toHaveValue(fixture.name === 'Greenhouse' ? 'Alex' : 'Alex Candidate')
    await expect(page.locator(fixture.emailSelector)).toHaveValue('alex@example.com')
    await expect(page.locator(fixture.questionSelector)).toHaveValue('')
    if (fixture.sensitiveIsRadio) await expect(page.locator(fixture.sensitiveSelector).first()).not.toBeChecked()
    else await expect(page.locator(fixture.sensitiveSelector)).toHaveValue('')

    const answer = overlay.locator('textarea').first()
    await answer.fill('My edited answer.')
    await page.getByRole('button', { name: 'Approve', exact: true }).first().click()
    await page.getByRole('button', { name: 'Fill approved (1)', exact: true }).click()

    await expect(page.locator(fixture.questionSelector)).toHaveValue('My edited answer.')
    await expect(page.getByText('Review the form, then submit it yourself.')).toBeVisible()
    expect(await page.locator('form').evaluate(form => (form.ownerDocument.defaultView as Window).submitted)).toBe(false)
  })
}

test('closing, needs-input, over-limit, rerun, and hidden fields remain safe', async ({ page }) => {
  await loadFixture(page, greenhouseFixture)
  const overlay = page.locator('#autoply-root')
  await page.getByRole('button', { name: 'Close Autoply' }).click()
  await expect(page.locator('#job_application_answers_attributes_2_text_value')).toHaveValue('')

  await page.locator('#email').fill('manual@example.com')
  await page.locator('body').evaluate(() => {
    const honeypot = document.createElement('input')
    honeypot.type = 'hidden'
    honeypot.id = 'honeypot'
    document.querySelector('form')?.append(honeypot)
  })
  await page.evaluate(() => { window.__autoplyInjected = false; window.__autoplyE2eMode = 'needs_input' })
  injectionCount++
  await page.addScriptTag({ url: `${contentScript}?e2e=${injectionCount}`, type: 'module' })
  await expect.poll(() => overlay.evaluate(host => host.shadowRoot?.textContent ?? '')).toContain("I don't have this in your profile")
  await expect(page.locator('#email')).toHaveValue('manual@example.com')
  await expect(page.locator('#honeypot')).toHaveValue('')
  await expect(page.getByRole('button', { name: 'Approve', exact: true }).first()).toBeDisabled()

  await page.getByRole('button', { name: 'Close Autoply' }).click()
  await page.evaluate(() => { window.__autoplyInjected = false; window.__autoplyE2eMode = 'over_limit' })
  injectionCount++
  await page.addScriptTag({ url: `${contentScript}?e2e=${injectionCount}`, type: 'module' })
  await expect.poll(() => overlay.evaluate(host => host.shadowRoot?.textContent ?? '')).toContain('1500')
  await expect(page.getByRole('button', { name: 'Approve', exact: true }).first()).toBeDisabled()
})

test('mapped draft errors preserve standard fills and expose only the documented action', async ({ page }) => {
  await page.goto('http://127.0.0.1:4173/src/options/index.html')
  await page.evaluate(() => { window.__autoplyE2eMode = 'rate_limited' })
  await page.setContent(greenhouseFixture)
  await page.locator('form').evaluate(form => {
    const view = form.ownerDocument.defaultView as Window & { submitted?: boolean }
    view.submitted = false
    form.addEventListener('submit', event => {
      event.preventDefault()
      view.submitted = true
    })
  })
  injectionCount++
  await page.addScriptTag({ url: `${contentScript}?e2e=${injectionCount}`, type: 'module' })
  await expect(page.getByText('The AI provider rate limit was reached. Wait a minute, then try again.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Retry', exact: true })).toBeVisible()
  await expect(page.locator('#first_name')).toHaveValue('Alex')
  await expect(page.locator('#email')).toHaveValue('alex@example.com')

  await page.getByRole('button', { name: 'Retry', exact: true }).click()
  await expect(page.getByText('The AI provider rate limit was reached. Wait a minute, then try again.')).toBeVisible()
  expect(await page.locator('form').evaluate(form => (form.ownerDocument.defaultView as Window).submitted)).toBe(false)
})
