import { describe, it, expect } from 'vitest'
import { toLlmProfile } from '../../src/shared/profile'
import { Profile } from '../../src/shared/schemas'

describe('toLlmProfile', () => {
  it('excludes email, phone, location, and links from the output', () => {
    const profile: Profile = {
      fullName: 'Jane Doe',
      email: 'jane@example.com',
      phone: '+1234567890',
      location: 'Earth',
      links: {
        linkedin: 'https://linkedin.com/in/jane'
      },
      summary: 'A developer',
      skills: ['JS'],
      education: [],
      experience: [],
      projects: []
    }

    const llmProfile = toLlmProfile(profile)

    expect(llmProfile.fullName).toBe('Jane Doe')
    expect(llmProfile.summary).toBe('A developer')
    expect(llmProfile.skills).toEqual(['JS'])
    
    // Check that excluded fields are completely absent
    expect('email' in llmProfile).toBe(false)
    expect('phone' in llmProfile).toBe(false)
    expect('location' in llmProfile).toBe(false)
    expect('links' in llmProfile).toBe(false)
  })
})
