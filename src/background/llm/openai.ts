import { z } from 'zod'
import { DRAFT_TIMEOUT_MS } from '../../shared/constants'
import { AppErrorImpl } from './gemini'
import { parseDrafts } from './parse'
import { buildSystemPrompt, buildUserPrompt } from './prompt'
import { DraftInput } from './provider'

const MODEL = 'gpt-4.1-mini'
const responseSchema = z.object({
  output: z.array(z.object({ content: z.array(z.object({ type: z.string(), text: z.string().optional() })).optional() })).optional(),
})

async function request(apiKey: string, body: object): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), DRAFT_TIMEOUT_MS)
  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: MODEL, store: false, ...body }),
      signal: controller.signal,
    })
    if (response.status === 401 || response.status === 403) throw new AppErrorImpl('INVALID_KEY', 'OpenAI rejected this API key. Check your key and project access.', false)
    if (response.status === 429) throw new AppErrorImpl('RATE_LIMITED', 'OpenAI rate limit or quota reached. Check your usage and billing, then try again.', true)
    if (!response.ok) throw new AppErrorImpl('NETWORK', 'OpenAI could not process the request. Check your connection and API access.', true)
    return response
  } catch (err) {
    if (err instanceof AppErrorImpl) throw err
    throw new AppErrorImpl('NETWORK', 'Could not reach OpenAI. Check your connection and try again.', true)
  } finally {
    clearTimeout(timeout)
  }
}

export const openaiProvider = {
  async testKey(apiKey: string): Promise<void> {
    await request(apiKey, { input: 'Hello', max_output_tokens: 16 })
  },
  async draftAnswers(input: DraftInput, apiKey: string) {
    const response = await request(apiKey, {
      input: [{ role: 'system', content: buildSystemPrompt(input) }, { role: 'user', content: buildUserPrompt(input) }],
      max_output_tokens: 1024,
      text: { format: { type: 'json_schema', name: 'draft_response', strict: true, schema: {
        type: 'object', additionalProperties: false, required: ['drafts'], properties: {
          drafts: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['id', 'status', 'answer'], properties: {
            id: { type: 'string' }, status: { type: 'string', enum: ['ok', 'needs_input'] }, answer: { type: 'string' },
          } } },
        },
      } } },
    })
    const data = responseSchema.safeParse(await response.json().catch(() => null))
    const content = data.success ? data.data.output?.flatMap(item => item.content ?? []) ?? [] : []
    if (content.some(item => item.type === 'refusal')) throw new AppErrorImpl('BAD_MODEL_OUTPUT', 'OpenAI could not generate an answer for this request.', false)
    const text = content.find(item => item.type === 'output_text')?.text
    try {
      if (!text) throw new Error('Missing output')
      return parseDrafts(text, input.questions.map(question => question.id))
    } catch {
      throw new AppErrorImpl('BAD_MODEL_OUTPUT', 'The AI provider returned an unusable answer. Try again.', true)
    }
  },
}
