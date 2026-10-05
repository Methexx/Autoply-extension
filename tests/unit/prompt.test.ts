import { describe, it, expect } from 'vitest'
import { buildSystemPrompt, buildUserPrompt } from '../../src/background/llm/prompt'
import { DraftInput } from '../../src/background/llm/provider'

describe('prompt module', () => {
  const mockInput: DraftInput = {
    profile: {
      fullName: 'Jane Doe',
      summary: 'Developer',
      skills: ['TypeScript'],
      education: [],
      experience: [],
      projects: []
    },
    job: {
      title: 'Engineer',
      company: 'Tech',
      description: 'Long description'.repeat(500),
      url: 'https://...'
    },
    questions: [{ id: 'q1', label: 'Why?', kind: 'text' }]
  }

  it('buildSystemPrompt returns string without interpolating user data', () => {
    const sys = buildSystemPrompt()
    expect(sys).toContain('Use ONLY facts stated in PROFILE')
    expect(sys).not.toContain('Jane')
  })

  it('buildUserPrompt includes profile, job, and questions without contact details', () => {
    const userPrompt = buildUserPrompt(mockInput)
    expect(userPrompt).toContain('Jane Doe')
    expect(userPrompt).toContain('Engineer')
    expect(userPrompt).toContain('Why?')
    expect(userPrompt).not.toContain('email')
  })

  it('buildUserPrompt truncates long job descriptions', () => {
    const userPrompt = buildUserPrompt(mockInput, 100)
    // "Description:" plus some text
    const descIndex = userPrompt.indexOf('Description:')
    const nextSectionIndex = userPrompt.indexOf('QUESTIONS:')
    const descLen = nextSectionIndex - descIndex - 'Description:\n'.length
    
    // It shouldn't be the full 8000 character length, should be around 100
    // Account for newlines
    expect(descLen).toBeLessThan(105)
  })

  it('buildUserPrompt includes hint if provided', () => {
    const inputWithHint = { ...mockInput, hint: 'make it technical' }
    const userPrompt = buildUserPrompt(inputWithHint)
    expect(userPrompt).toContain('USER HINT: make it technical')
  })
})
