import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { extractJobContext } from '../../src/content/detect/job'

describe('Job context extraction (M4-T7)', () => {
  it('extracts correct title, company, and description from Greenhouse fixture', () => {
    const greenhouseHtml = readFileSync(
      resolve(__dirname, '../fixtures/greenhouse/application.html'),
      'utf-8',
    )
    document.documentElement.innerHTML = greenhouseHtml

    const url = new URL('https://boards.greenhouse.io/acmewares/jobs/54321')
    const job = extractJobContext(url, document)

    expect(job.title).toBe('Staff Software Engineer')
    expect(job.company).toBe('Acme Corp')
    expect(job.description).toContain('Acme Corp builds modern developer tools')
    expect(job.url).toBe(url.href)
  })

  it('extracts correct title, company, and description from Lever fixture', () => {
    const leverHtml = readFileSync(
      resolve(__dirname, '../fixtures/lever/application.html'),
      'utf-8',
    )
    document.documentElement.innerHTML = leverHtml

    const url = new URL('https://jobs.lever.co/globex/778899/apply')
    const job = extractJobContext(url, document)

    expect(job.title).toBe('Senior Frontend Engineer')
    expect(job.company).toBe('Globex Corp')
    expect(job.description).toContain('Globex Corp is modernizing enterprise software')
    expect(job.url).toBe(url.href)
  })
})
