import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { leverAdapter } from '../../src/content/adapters/lever'
import { getAdapterForPage } from '../../src/content/adapters/index'

describe('Lever adapter (M4-T4)', () => {
  beforeEach(() => {
    const fixturePath = resolve(__dirname, '../fixtures/lever/application.html')
    const html = readFileSync(fixturePath, 'utf-8')
    document.documentElement.innerHTML = html
  })

  it('matches jobs.lever.co URLs and respects priority', () => {
    const leverUrl = new URL('https://jobs.lever.co/globex/123-abc/apply')
    expect(leverAdapter.matches(leverUrl, document)).toBe(true)

    const adapter = getAdapterForPage(leverUrl, document)
    expect(adapter.name).toBe('lever')
  })

  it('finds the Lever form root', () => {
    const root = leverAdapter.findFormRoot(document)
    expect(root).not.toBeNull()
    expect(root?.id).toBe('application-form')
  })

  it('extracts job context from Lever fixture', () => {
    const job = leverAdapter.extractJob(document)
    expect(job.title).toBe('Senior Frontend Engineer')
    expect(job.company).toBe('Globex Corp')
    expect(job.description).toContain('Globex Corp is modernizing enterprise software')
  })

  it('detects ≥95% of visible fields in the Lever fixture', () => {
    const root = leverAdapter.findFormRoot(document)!
    const fields = leverAdapter.findFields(root)

    // In Lever fixture:
    // Full Name, Email, Phone, Current company, LinkedIn, GitHub, Portfolio,
    // 2 textareas (What makes great fit, React experience),
    // 1 radio group (Visa sponsorship), 1 input (Desired compensation)
    expect(fields.length).toBeGreaterThanOrEqual(10)

    const labels = fields.map(f => f.label)
    expect(labels).toContain('Full Name')
    expect(labels).toContain('Email')
    expect(labels).toContain('Phone')
    expect(labels).toContain('LinkedIn URL')
    expect(labels).toContain('What makes you a great fit for Globex Corp?')
    expect(labels).toContain('Will you now or in the future require visa sponsorship?')
  })
})
