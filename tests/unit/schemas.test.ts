import { describe, it, expect } from 'vitest'
import {
  ProfileSchema,
  SettingsSchema,
  AppMessageSchema,
  DraftSchema,
  DraftReplySchema,
} from '../../src/shared/schemas'

describe('Zod Schemas', () => {
  describe('ProfileSchema', () => {
    it('validates a complete, correct profile', () => {
      const validProfile = {
        fullName: 'Jane Doe',
        email: 'jane@example.com',
        phone: '+1234567890',
        location: 'Earth',
        links: {
          linkedin: 'https://linkedin.com/in/jane',
          github: 'https://github.com/jane',
          website: '',
        },
        summary: 'A summary',
        skills: ['TypeScript', 'React'],
        education: [
          {
            institution: 'University',
            degree: 'BSc Computer Science',
            startYear: 2018,
            endYear: 2022,
          },
        ],
        experience: [
          {
            organization: 'Company',
            role: 'Developer',
            startDate: '2022-06',
            description: 'Did things',
          },
        ],
        projects: [
          {
            name: 'Autoply',
            description: 'Auto apply tool',
            technologies: ['Vite', 'React'],
            url: 'https://example.com',
          },
        ],
      }
      expect(() => ProfileSchema.parse(validProfile)).not.toThrow()
    })

    it('rejects invalid email', () => {
      const invalidProfile = {
        fullName: 'Jane Doe',
        email: 'not-an-email',
        phone: '',
        location: '',
        links: {},
        summary: '',
        skills: [],
        education: [],
        experience: [],
        projects: [],
      }
      expect(() => ProfileSchema.parse(invalidProfile)).toThrow()
    })
  })

  describe('SettingsSchema', () => {
    it('validates correct settings', () => {
      const settings = {
        geminiApiKey: 'AIzaSyTestKey...',
        model: 'gemini-1.5-flash',
        jobTextMaxChars: 4000,
      }
      expect(() => SettingsSchema.parse(settings)).not.toThrow()
    })
  })

  describe('AppMessageSchema', () => {
    it('validates DRAFT_REQUEST message', () => {
      const msg = {
        type: 'DRAFT_REQUEST',
        job: { title: 'Engineer', company: 'Tech', description: 'Job text', url: 'https://...' },
        questions: [{ id: 'q1', label: 'Why?', kind: 'textarea' }],
      }
      expect(() => AppMessageSchema.parse(msg)).not.toThrow()
    })
  })

  describe('DraftSchema & DraftReplySchema', () => {
    it('validates a draft', () => {
      const draft = { id: 'q1', status: 'ok', answer: 'Because I am great' }
      expect(() => DraftSchema.parse(draft)).not.toThrow()
    })

    it('validates a successful reply', () => {
      const reply = {
        ok: true,
        drafts: [{ id: 'q1', status: 'needs_input', answer: '' }],
      }
      expect(() => DraftReplySchema.parse(reply)).not.toThrow()
    })
  })
})
