import { describe, it, expect, vi, beforeEach } from 'vitest'
import { handleAppMessage } from '../../src/background/messaging'
import { geminiProvider } from '../../src/background/llm/gemini'
import { openaiProvider } from '../../src/background/llm/openai'
import * as storage from '../../src/shared/storage'
import { Profile, Settings, Question, JobContext } from '../../src/shared/schemas'

vi.mock('../../src/background/llm/gemini', () => ({
  geminiProvider: {
    testKey: vi.fn(),
    draftAnswers: vi.fn(),
    extractProfileFromCv: vi.fn(),
  },
}))
vi.mock('../../src/background/llm/openai', () => ({ openaiProvider: { testKey: vi.fn(), draftAnswers: vi.fn() } }))

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

  it('uses OpenAI when it is the only configured key', async () => {
    vi.spyOn(storage, 'getSettings').mockResolvedValue({ ...mockSettings, geminiApiKey: '', openaiApiKey: 'openai-test' })
    vi.spyOn(storage, 'getProfile').mockResolvedValue(mockProfile)
    vi.mocked(openaiProvider.draftAnswers).mockResolvedValue([{ id: 'q1', status: 'needs_input', answer: '' }])
    const result = await handleAppMessage({ type: 'DRAFT_REQUEST', job: mockJob, questions: mockQuestions }, validSender)
    expect(result.ok).toBe(true)
    expect(openaiProvider.draftAnswers).toHaveBeenCalledOnce()
    expect(geminiProvider.draftAnswers).not.toHaveBeenCalled()
  })

  it('falls back on failure only when explicitly enabled', async () => {
    vi.spyOn(storage, 'getSettings').mockResolvedValue({ ...mockSettings, openaiApiKey: 'openai-test', fallbackEnabled: true })
    vi.spyOn(storage, 'getProfile').mockResolvedValue(mockProfile)
    vi.mocked(geminiProvider.draftAnswers).mockRejectedValueOnce({ code: 'RATE_LIMITED', message: 'Limited', retryable: true })
    vi.mocked(openaiProvider.draftAnswers).mockResolvedValueOnce([{ id: 'q1', status: 'ok', answer: 'Draft' }])
    const result = await handleAppMessage({ type: 'DRAFT_REQUEST', job: mockJob, questions: mockQuestions }, validSender)
    expect(result.ok).toBe(true)
    expect(openaiProvider.draftAnswers).toHaveBeenCalledOnce()
  })

  it('does not fall back for a valid needs_input answer', async () => {
    vi.spyOn(storage, 'getSettings').mockResolvedValue({ ...mockSettings, openaiApiKey: 'openai-test', fallbackEnabled: true })
    vi.spyOn(storage, 'getProfile').mockResolvedValue(mockProfile)
    vi.mocked(geminiProvider.draftAnswers).mockResolvedValueOnce([{ id: 'q1', status: 'needs_input', answer: '' }])
    await handleAppMessage({ type: 'DRAFT_REQUEST', job: mockJob, questions: mockQuestions }, validSender)
    expect(openaiProvider.draftAnswers).not.toHaveBeenCalled()
  })

  it('does not send data to the other provider when fallback is disabled', async () => {
    vi.spyOn(storage, 'getSettings').mockResolvedValue({ ...mockSettings, openaiApiKey: 'openai-test', fallbackEnabled: false })
    vi.spyOn(storage, 'getProfile').mockResolvedValue(mockProfile)
    vi.mocked(geminiProvider.draftAnswers).mockRejectedValueOnce({ code: 'RATE_LIMITED', message: 'Limited', retryable: true })
    const result = await handleAppMessage({ type: 'DRAFT_REQUEST', job: mockJob, questions: mockQuestions }, validSender)
    expect(result.ok).toBe(false)
    expect(openaiProvider.draftAnswers).not.toHaveBeenCalled()
  })

  it('sends selected text, bounded context and follow-ups to the chosen provider without contact details', async () => {
    vi.spyOn(storage, 'getSettings').mockResolvedValue(mockSettings)
    vi.spyOn(storage, 'getProfile').mockResolvedValue(mockProfile)
    vi.mocked(geminiProvider.draftAnswers).mockResolvedValueOnce([{ id: 'chat', status: 'ok', answer: 'A response' }])
    const result = await handleAppMessage({ type: 'ASK_REQUEST', selection: 'Why this role?', context: 'Example context', pageTitle: 'Job', conversation: [{ role: 'user', text: 'Make it short' }] }, validSender)
    expect(result.ok).toBe(true)
    const input = vi.mocked(geminiProvider.draftAnswers).mock.calls[0]?.[0]
    expect(input?.chat?.conversation[0]?.text).toBe('Make it short')
    expect(input?.job.description).toBe('Example context')
    expect(input?.profile).not.toHaveProperty('email')
    expect(input?.profile).not.toHaveProperty('phone')
  })

  it('rejects unbounded Ask Autoply requests', async () => {
    const result = await handleAppMessage({ type: 'ASK_REQUEST', selection: 'x'.repeat(4001), context: '', pageTitle: '', conversation: [] }, validSender)
    expect(result.ok).toBe(false)
    expect(geminiProvider.draftAnswers).not.toHaveBeenCalled()
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
        expect(res.error.code).toBe('NO_KEY')
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

    it('serializes an Error diagnostic as a plain response object', async () => {
      vi.spyOn(storage, 'getSettings').mockResolvedValue(mockSettings)
      vi.mocked(geminiProvider.testKey).mockRejectedValue(Object.assign(
        new Error('The selected Gemini model is unavailable.'),
        { code: 'BAD_MODEL_OUTPUT', retryable: false },
      ))
      const res = await handleAppMessage({ type: 'TEST_KEY' }, validSender)
      expect(res).toEqual({
        ok: false,
        error: { code: 'BAD_MODEL_OUTPUT', message: 'The selected Gemini model is unavailable.', retryable: false },
      })
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
        expect(res.error.code).toBe('NO_KEY')
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
        expect(res.error.code).toBe('NO_PROFILE')
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

  describe('CV_EXTRACT_REQUEST handling', () => {
    it('uses the service worker to extract a validated CV profile', async () => {
      vi.spyOn(storage, 'getSettings').mockResolvedValue(mockSettings)
      const extracted = { ...mockProfile, links: { linkedin: '', github: '', website: '' } }
      vi.mocked(geminiProvider.extractProfileFromCv).mockResolvedValue(extracted)
      const res = await handleAppMessage(
        { type: 'CV_EXTRACT_REQUEST', file: { mimeType: 'text/plain', data: 'QWxpY2UgRGV2' } },
        validSender,
      )
      expect(res).toEqual({ ok: true, profile: extracted })
      expect(geminiProvider.extractProfileFromCv).toHaveBeenCalledWith(
        { mimeType: 'text/plain', data: 'QWxpY2UgRGV2' }, 'test-api-key', 'gemini-1.5-flash',
      )
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
