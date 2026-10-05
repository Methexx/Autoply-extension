import { describe, it, expect, vi, beforeEach } from 'vitest'
import { geminiProvider, AppErrorImpl } from '../../src/background/llm/gemini'
import { DraftInput } from '../../src/background/llm/provider'

const mockFetch = vi.fn()
global.fetch = mockFetch

describe('gemini module', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    vi.useFakeTimers()
  })

  const mockInput: DraftInput = {
    profile: {
      fullName: 'Jane', summary: '', skills: [], education: [], experience: [], projects: []
    },
    job: { title: '', company: '', description: '', url: '' },
    questions: [{ id: 'q1', label: 'Why?', kind: 'text' }]
  }

  describe('testKey', () => {
    it('throws NO_KEY if key is empty', async () => {
      await expect(geminiProvider.testKey('', 'model')).rejects.toThrowError(AppErrorImpl)
    })

    it('throws INVALID_KEY for 403', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 403 })
      await expect(geminiProvider.testKey('key', 'model')).rejects.toMatchObject({ code: 'INVALID_KEY' })
    })

    it('throws RATE_LIMITED for 429', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 429 })
      await expect(geminiProvider.testKey('key', 'model')).rejects.toMatchObject({ code: 'RATE_LIMITED' })
    })

    it('throws NETWORK for other non-ok', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 })
      await expect(geminiProvider.testKey('key', 'model')).rejects.toMatchObject({ code: 'NETWORK' })
    })

    it('throws NETWORK on fetch throw', async () => {
      mockFetch.mockRejectedValueOnce(new Error('fail'))
      await expect(geminiProvider.testKey('key', 'model')).rejects.toMatchObject({ code: 'NETWORK' })
    })

    it('resolves on ok', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true })
      await expect(geminiProvider.testKey('key', 'model')).resolves.toBeUndefined()
    })
  })

  describe('draftAnswers', () => {
    it('throws INVALID_KEY on 401', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 401 })
      await expect(geminiProvider.draftAnswers(mockInput, 'key', 'model')).rejects.toMatchObject({ code: 'INVALID_KEY' })
    })

    it('throws BAD_MODEL_OUTPUT on bad json text in response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: 'not json' }] } }]
        })
      })
      await expect(geminiProvider.draftAnswers(mockInput, 'key', 'model')).rejects.toMatchObject({ code: 'BAD_MODEL_OUTPUT' })
    })

    it('returns drafted answers on success', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: JSON.stringify({ drafts: [{ id: 'q1', status: 'ok', answer: 'Because' }] }) }] } }]
        })
      })
      const drafts = await geminiProvider.draftAnswers(mockInput, 'key', 'model')
      expect(drafts).toHaveLength(1)
      expect(drafts[0]!.answer).toBe('Because')
    })
  })
})
