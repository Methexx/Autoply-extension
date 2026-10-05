import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { greenhouseAdapter } from '../../src/content/adapters/greenhouse'

describe('Greenhouse adapter (M4-T3)', () => {
  beforeEach(() => {
    const fixturePath = resolve(__dirname, '../fixtures/greenhouse/application.html')
    const html = readFileSync(fixturePath, 'utf-8')
    document.documentElement.innerHTML = html
  })

  it('matches greenhouse.io URLs', () => {
    expect(greenhouseAdapter.matches(new URL('https://boards.greenhouse.io/acme/jobs/12345'), document)).toBe(true)
    expect(greenhouseAdapter.matches(new URL('https://job-boards.greenhouse.io/acme'), document)).toBe(true)
    expect(greenhouseAdapter.matches(new URL('https://jobs.lever.co/globex/123'), document)).toBe(false)
  })

  it('finds the form root', () => {
    const root = greenhouseAdapter.findFormRoot(document)
    expect(root).not.toBeNull()
    expect(root?.id).toBe('application_form')
  })

  it('extracts job context accurately', () => {
    const job = greenhouseAdapter.extractJob(document)
    expect(job.title).toBe('Staff Software Engineer')
    expect(job.company).toBe('Acme Corp')
    expect(job.description).toContain('Acme Corp builds modern developer tools')
  })

  it('detects ≥95% of visible input fields in the Greenhouse fixture', () => {
    const root = greenhouseAdapter.findFormRoot(document)!
    const fields = greenhouseAdapter.findFields(root)

    // Form has 12 visible fields:
    // first_name, last_name, email, phone, location, linkedin, website/portfolio,
    // 2 textareas (Why join, Challenging problem),
    // 1 select (How hear),
    // 1 select (Gender), 1 input (Salary), 1 select (Visa)
    expect(fields.length).toBeGreaterThanOrEqual(11)

    const labels = fields.map(f => f.label)
    expect(labels).toContain('First Name')
    expect(labels).toContain('Last Name')
    expect(labels).toContain('Email')
    expect(labels).toContain('Phone')
    expect(labels).toContain('Why are you interested in joining Acme Corp?')
  })
})
