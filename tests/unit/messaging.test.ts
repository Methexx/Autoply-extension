import { describe, it, expect, vi, beforeEach } from 'vitest'
import { handleAppMessage } from '../../src/background/messaging'
import { geminiProvider } from '../../src/background/llm/gemini'
import * as storage from '../../src/shared/storage'
import { Profile, Settings, Question, JobContext } from '../../src/shared/schemas'

vi.mock('../../src/background/llm/gemini', () => ({
  geminiProvider: {
    testKey: vi.fn(),
    draftAnswers: vi.fn(),
  },
}))

describe('Background messaging pipeline', () => {
  const validSender = { id: 'test-extension-id' } as chrome.runtime.MessageSender

  const mockSettings: Settings = {
    geminiApiKey: 'test-api-key',
    model: 'gemini-1.5-flash',
    jobTextMaxChars: 4000,
  }

  const mockProfile: Profile = {
    fullName: 'Alice Dev',
    email: 'alice@example.com',
    phone: '+1 555 123 4567',
    location: 'San Francisco, CA',
    links: {},
    summary: 'Experienced engineer with expertise in distributed systems.',
    skills: ['TypeScript', 'Node.js'],
    education: [],
    experience: [],
    projects: [],
  }

  const mockJob: JobContext = {
    title: 'Senior Frontend Engineer',
    company: 'Acme Corp',
    description: 'We are seeking an engineer to build modern web interfaces.',
    url: 'https://example.com/jobs/123',
  }

  const mockQuestions: Question[] = [
    {
      id: 'q1',
      label: 'Why are you interested in this role?',
      kind: 'textarea',
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    global.chrome = {
      runtime: {
        id: 'test-extension-id',
        openOptionsPage: vi.fn().mockResolvedValue(undefined),
      },
    } as unknown as typeof chrome
  })

  it('rejects messages from unauthorized sender', async () => {
    const maliciousSender = { id: 'other-id' } as chrome.runtime.MessageSender
    const res = await handleAppMessage({ type: 'TEST_KEY' }, maliciousSender)
    expect(res.ok).toBe(false)
    if (!res.ok) {
      expect(res.error.code).toBe('NETWORK')
    }
  })

  it('rejects malformed messages', async () => {
    const res = await handleAppMessage({ type: 'UNKNOWN_TYPE' }, validSender)
    expect(res.ok).toBe(false)
    if (!res.ok) {
      expect(res.error.code).toBe('BAD_MODEL_OUTPUT')
    }
  })

  describe('TEST_KEY handling', () => {
    it('returns error if no key is stored', async () => {
      vi.spyOn(storage, 'getSettings').mockResolvedValue(null)
      const res = await handleAppMessage({ type: 'TEST_KEY' }, validSender)
      expect(res.ok).toBe(false)
      if (!res.ok) {
        expect(res.error.code).toBe('INVALID_KEY')
      }
    })

    it('returns ok: true when provider testKey succeeds', async () => {
      vi.spyOn(storage, 'getSettings').mockResolvedValue(mockSettings)
      vi.mocked(geminiProvider.testKey).mockResolvedValue(undefined)

      const res = await handleAppMessage({ type: 'TEST_KEY' }, validSender)
      expect(res.ok).toBe(true)
      expect(geminiProvider.testKey).toHaveBeenCalledWith('test-api-key', 'gemini-1.5-flash')
    })

    it('returns mapped error when provider testKey fails', async () => {
      vi.spyOn(storage, 'getSettings').mockResolvedValue(mockSettings)
      vi.mocked(geminiProvider.testKey).mockRejectedValue({
        code: 'RATE_LIMITED',
        message: 'Rate limit reached',
        retryable: true,
      })

      const res = await handleAppMessage({ type: 'TEST_KEY' }, validSender)
      expect(res.ok).toBe(false)
      if (!res.ok) {
        expect(res.error.code).toBe('RATE_LIMITED')
      }
    })
  })

  describe('DRAFT_REQUEST handling', () => {
    it('returns error if no key stored', async () => {
      vi.spyOn(storage, 'getSettings').mockResolvedValue(null)
      const res = await handleAppMessage(
        { type: 'DRAFT_REQUEST', job: mockJob, questions: mockQuestions },
        validSender,
      )
      expect(res.ok).toBe(false)
      if (!res.ok) {
        expect(res.error.code).toBe('INVALID_KEY')
      }
    })

    it('returns error if no profile stored', async () => {
      vi.spyOn(storage, 'getSettings').mockResolvedValue(mockSettings)
      vi.spyOn(storage, 'getProfile').mockResolvedValue(null)

      const res = await handleAppMessage(
        { type: 'DRAFT_REQUEST', job: mockJob, questions: mockQuestions },
        validSender,
      )
      expect(res.ok).toBe(false)
      if (!res.ok) {
        expect(res.error.code).toBe('NO_FIELDS')
      }
    })

    it('generates drafts successfully', async () => {
      vi.spyOn(storage, 'getSettings').mockResolvedValue(mockSettings)
      vi.spyOn(storage, 'getProfile').mockResolvedValue(mockProfile)

      const mockDrafts = [
        {
          id: 'q1',
          answer: 'I love distributed systems and building modern web apps.',
          status: 'ok' as const,
        },
      ]

      vi.mocked(geminiProvider.draftAnswers).mockResolvedValue(mockDrafts)

      const res = await handleAppMessage(
        { type: 'DRAFT_REQUEST', job: mockJob, questions: mockQuestions },
        validSender,
      )

      expect(res.ok).toBe(true)
      if (res.ok && res.drafts) {
        expect(res.drafts).toHaveLength(1)
        expect(res.drafts[0]?.id).toBe('q1')
        expect(res.drafts[0]?.status).toBe('ok')
      }
    })

    it('retries once if output fails, and succeeds if second attempt passes', async () => {
      vi.spyOn(storage, 'getSettings').mockResolvedValue(mockSettings)
      vi.spyOn(storage, 'getProfile').mockResolvedValue(mockProfile)

      const mockDrafts = [{ id: 'q1', answer: 'Valid response', status: 'ok' as const }]

      vi.mocked(geminiProvider.draftAnswers)
        .mockRejectedValueOnce({
          code: 'BAD_MODEL_OUTPUT',
          message: 'Bad output',
          retryable: true,
        })
        .mockResolvedValueOnce(mockDrafts)

      const res = await handleAppMessage(
        { type: 'DRAFT_REQUEST', job: mockJob, questions: mockQuestions },
        validSender,
      )

      expect(geminiProvider.draftAnswers).toHaveBeenCalledTimes(2)
      expect(res.ok).toBe(true)
    })

    it('does not retry when rate limited', async () => {
      vi.spyOn(storage, 'getSettings').mockResolvedValue(mockSettings)
      vi.spyOn(storage, 'getProfile').mockResolvedValue(mockProfile)

      vi.mocked(geminiProvider.draftAnswers).mockRejectedValue({
        code: 'RATE_LIMITED',
        message: 'Rate limit hit',
        retryable: true,
      })

      const res = await handleAppMessage(
        { type: 'DRAFT_REQUEST', job: mockJob, questions: mockQuestions },
        validSender,
      )

      expect(geminiProvider.draftAnswers).toHaveBeenCalledTimes(1)
      expect(res.ok).toBe(false)
      if (!res.ok) {
        expect(res.error.code).toBe('RATE_LIMITED')
      }
    })
  })

  describe('OPEN_OPTIONS handling', () => {
    it('calls chrome.runtime.openOptionsPage', async () => {
      const res = await handleAppMessage(
        { type: 'OPEN_OPTIONS', reason: 'no_key' },
        validSender,
      )
      expect(res.ok).toBe(true)
      expect(chrome.runtime.openOptionsPage).toHaveBeenCalled()
    })
  })
})
