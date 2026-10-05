import { describe, it, expect } from 'vitest'
import { classifyField, isSensitiveField } from '../../src/content/detect/classify'
import { RawField } from '../../src/content/adapters/types'

function makeMockField(overrides: Partial<RawField> & { label: string }): RawField {
  const input = document.createElement(overrides.kind === 'textarea' ? 'textarea' : 'input')
  if (overrides.kind && overrides.kind !== 'textarea' && overrides.kind !== 'select') {
    (input as HTMLInputElement).type = overrides.kind
  }

  return {
    el: input,
    kind: overrides.kind || 'text',
    required: false,
    ...overrides,
  }
}

describe('Field classification (M4-T5)', () => {
  describe('Sensitive fields are strictly classified as ignore', () => {
    const sensitiveTestCases = [
      { label: 'Gender Identity', reason: 'EEO gender' },
      { label: 'Race / Ethnicity', reason: 'EEO race' },
      { label: 'Veteran Status', reason: 'EEO veteran' },
      { label: 'Disability Status (Form CC-305)', reason: 'EEO disability' },
      { label: 'Are you legally authorized to work in the United States?', reason: 'Visa authorization' },
      { label: 'Will you now or in the future require visa sponsorship?', reason: 'Visa sponsorship' },
      { label: 'Desired Salary (Annual USD)', reason: 'Salary expectations' },
      { label: 'Expected compensation', reason: 'Compensation' },
      { label: 'Hourly rate expectation', reason: 'Rate expectation' },
    ]

    for (const testCase of sensitiveTestCases) {
      it(`ignores sensitive field: "${testCase.label}" (${testCase.reason})`, () => {
        const field = makeMockField({ label: testCase.label })
        expect(isSensitiveField(field)).toBe(true)
        const classification = classifyField(field)
        expect(classification.category).toBe('ignore')
        if (classification.category === 'ignore') {
          expect(classification.reason).toBe('sensitive_field')
        }
      })
    }
  })

  describe('Standard fields are accurately identified', () => {
    const standardTestCases = [
      { label: 'First Name', expected: 'firstName' },
      { label: 'Last Name', expected: 'lastName' },
      { label: 'Full Name', expected: 'fullName' },
      { label: 'Email Address', expected: 'email' },
      { label: 'Phone Number', expected: 'phone' },
      { label: 'Mobile Phone', expected: 'phone' },
      { label: 'City, State, Country', expected: 'location' },
      { label: 'Current Location', expected: 'location' },
      { label: 'LinkedIn Profile', expected: 'linkedin' },
      { label: 'GitHub URL', expected: 'github' },
      { label: 'Personal Website or Portfolio', expected: 'website' },
    ]

    for (const testCase of standardTestCases) {
      it(`classifies "${testCase.label}" as standard (${testCase.expected})`, () => {
        const field = makeMockField({ label: testCase.label })
        const classification = classifyField(field)
        expect(classification.category).toBe('standard')
        if (classification.category === 'standard') {
          expect(classification.standardType).toBe(testCase.expected)
        }
      })
    }

    it('classifies autocomplete attributes even if label differs', () => {
      const field = makeMockField({ label: 'Your Given Name' })
      field.el.setAttribute('autocomplete', 'given-name')
      const classification = classifyField(field)
      expect(classification.category).toBe('standard')
      if (classification.category === 'standard') {
        expect(classification.standardType).toBe('firstName')
      }
    })
  })

  describe('Open-ended questions are identified for LLM drafting', () => {
    const openEndedTestCases = [
      {
        label: 'Why are you interested in joining Acme Corp?',
        kind: 'textarea' as const,
      },
      {
        label: 'Describe a challenging project you built recently.',
        kind: 'textarea' as const,
      },
      {
        label: 'What makes you a strong candidate for this role?',
        kind: 'text' as const,
      },
      {
        label: 'How did you hear about this opportunity?',
        kind: 'select' as const,
        options: ['LinkedIn', 'Friend', 'Twitter'],
      },
      {
        label: 'Tell us about your leadership experience',
        kind: 'text' as const,
        maxLength: 150,
      },
    ]

    for (const testCase of openEndedTestCases) {
      it(`classifies "${testCase.label}" as open_ended`, () => {
        const field = makeMockField(testCase)
        const classification = classifyField(field)
        expect(classification.category).toBe('open_ended')
      })
    }
  })

  describe('Uncertain fields default to ignore', () => {
    it('ignores unknown or ambiguous fields', () => {
      const field = makeMockField({ label: 'Internal Department Code #12' })
      const classification = classifyField(field)
      expect(classification.category).toBe('ignore')
      if (classification.category === 'ignore') {
        expect(classification.reason).toBe('unclassified')
      }
    })
  })
})
