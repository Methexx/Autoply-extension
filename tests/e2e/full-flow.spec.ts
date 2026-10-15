import { expect, test } from '@playwright/test'
import { resolve } from 'node:path'

const contentScript = resolve(process.cwd(), 'dist/content.js')

const profile = {
  fullName: 'Alex Candidate',
  email: 'alex@example.com',
  phone: '',
  location: '',
  links: {},
  summary: 'Early-career software engineer.',
  skills: ['TypeScript'],
  education: [],
  experience: [],
  projects: [],
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript((storedProfile) => {
    const profileKey = 'autoply_profile'
    const settingsKey = 'autoply_settings'
    Object.defineProperty(window, 'chrome', {
      value: {
        runtime: {
          id: 'autoply-e2e',
          sendMessage: (message: { type: string; questions?: { id: string }[] }, callback: (value: unknown) => void) => {
            if (message.type === 'DRAFT_REQUEST') {
              callback({ ok: true, drafts: [{ id: message.questions?.[0]?.id, status: 'ok', answer: 'Edited draft source.' }] })
              return
            }
            callback({ ok: true, drafts: [{ id: 'q', status: 'ok', answer: 'Regenerated draft.' }] })
          },
        },
        storage: {
          local: {
            get: async (key: string) => key === profileKey ? { [profileKey]: storedProfile } : { [settingsKey]: { geminiApiKey: 'test', model: 'test', jobTextMaxChars: 4000 } },
          },
        },
      },
    })
  }, profile)
})

test('fills only an approved, edited draft and never submits', async ({ page }) => {
  await page.setContent(`
    <form id="application"><label for="name">Full name</label><input id="name" name="name">
    <label for="email">Email</label><input id="email" type="email">
    <label for="q">Why do you want to work here?</label><textarea id="q"></textarea>
    <button type="submit">Submit</button></form>
    <script>window.submitted = false; document.querySelector('form').addEventListener('submit', event => { event.preventDefault(); window.submitted = true })</script>
  `)

  await page.addScriptTag({ path: contentScript })
  await expect(page.getByText('Edited draft source.')).toBeVisible()
  await expect(page.locator('#name')).toHaveValue('Alex Candidate')
  await expect(page.locator('#email')).toHaveValue('alex@example.com')
  await expect(page.locator('#q')).toHaveValue('')

  const answer = page.locator('#autoply-root').locator('textarea').first()
  await answer.fill('My edited answer.')
  await page.getByRole('button', { name: 'Approve' }).click()
  await page.getByRole('button', { name: 'Fill approved (1)' }).click()

  await expect(page.locator('#q')).toHaveValue('My edited answer.')
  await expect(page.getByText('Review the form, then submit it yourself.')).toBeVisible()
  await expect(page.locator('form')).toEvaluate((form) => (form.ownerDocument.defaultView as Window & { submitted: boolean }).submitted).resolves.toBe(false)
})

test('closing the overlay leaves open-ended fields untouched', async ({ page }) => {
  await page.setContent('<form><input name="name"><input type="email"><textarea id="q">Keep me empty</textarea></form>')
  await page.addScriptTag({ path: contentScript })
  await page.getByRole('button', { name: 'Close Autoply' }).click()
  await expect(page.locator('#q')).toHaveValue('Keep me empty')
})
