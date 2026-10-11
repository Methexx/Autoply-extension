import { describe, expect, it } from 'vitest'
import { buildPlaygroundRequest } from '../../src/options/playground'

describe('buildPlaygroundRequest', () => {
  it('uses the standard draft message without profile or key data', () => {
    const request = buildPlaygroundRequest({
      question: ' Why this role? ',
      jobTitle: ' Developer ',
      company: ' Acme ',
      jobDescription: ' Build useful things. ',
    })

    expect(request).toEqual({
      type: 'DRAFT_REQUEST',
      job: {
        title: 'Developer',
        company: 'Acme',
        description: 'Build useful things.',
        url: 'autoply://dev-playground',
      },
      questions: [{ id: 'playground-question', label: 'Why this role?', kind: 'textarea' }],
    })
    expect(JSON.stringify(request)).not.toContain('geminiApiKey')
    expect(JSON.stringify(request)).not.toContain('profile')
  })

  it('does not create a request for a blank question', () => {
    expect(buildPlaygroundRequest({ question: '  ', jobTitle: '', company: '', jobDescription: '' })).toBeNull()
  })
})
