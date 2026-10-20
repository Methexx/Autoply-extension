import { afterEach, describe, expect, it, vi } from 'vitest'
import { openaiProvider } from '../../src/background/llm/openai'
import { DraftInput } from '../../src/background/llm/provider'

const input: DraftInput = {
  profile: { fullName: '', summary: '', skills: [], education: [], experience: [], projects: [] },
  job: { title: 'Engineer', company: 'Example', description: '', url: 'https://example.com' },
  questions: [{ id: 'q1', label: 'Why?', kind: 'textarea' }],
}

afterEach(() => vi.unstubAllGlobals())

describe('OpenAI provider', () => {
  it('uses a bearer key and parses structured drafts without storing responses', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ output: [{ content: [{ type: 'output_text', text: JSON.stringify({ drafts: [{ id: 'q1', status: 'ok', answer: 'A draft' }] }) }] }] }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const drafts = await openaiProvider.draftAnswers(input, 'test-secret')
    expect(drafts[0]?.answer).toBe('A draft')
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.openai.com/v1/responses')
    expect(options.headers).toMatchObject({ authorization: 'Bearer test-secret' })
    expect(options.body).not.toContain('test-secret')
    expect(typeof options.body).toBe('string')
    expect(JSON.parse(options.body as string)).toMatchObject({ store: false, model: 'gpt-4.1-mini' })
  })

  it('maps provider failures without revealing response contents', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('secret raw response', { status: 401 })))
    await expect(openaiProvider.testKey('test-secret')).rejects.toMatchObject({ code: 'INVALID_KEY' })
  })
})
