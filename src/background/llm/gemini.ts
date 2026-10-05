import { DraftInput, LlmProvider } from './provider'
import { buildSystemPrompt, buildUserPrompt } from './prompt'
import { parseDrafts } from './parse'
import { Draft, AppError, ErrorCode } from '../../shared/schemas'

export class AppErrorImpl extends Error implements AppError {
  constructor(public code: ErrorCode, message: string, public retryable: boolean) {
    super(message)
    this.name = 'AppError'
  }
}

const DRAFT_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    drafts: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          id: { type: 'STRING' },
          status: { type: 'STRING', enum: ['ok', 'needs_input'] },
          answer: { type: 'STRING' }
        },
        required: ['id', 'status', 'answer']
      }
    }
  },
  required: ['drafts']
}

export const geminiProvider: LlmProvider = {
  async draftAnswers(input: DraftInput, apiKey: string, model: string): Promise<Draft[]> {
    if (!apiKey) throw new AppErrorImpl('NO_KEY', 'Add your Gemini API key in options.', false)
    
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30000)
    
    let res: Response
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-goog-api-key': apiKey
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: buildSystemPrompt() }] },
          contents: [{ role: 'user', parts: [{ text: buildUserPrompt(input) }] }],
          generationConfig: {
            temperature: 0.4,
            responseMimeType: 'application/json',
            responseSchema: DRAFT_RESPONSE_SCHEMA
          }
        }),
        signal: controller.signal
      })
    } catch {
      clearTimeout(timeout)
      throw new AppErrorImpl('NETWORK', "Couldn't reach Gemini. Check your connection.", true)
    }
    
    clearTimeout(timeout)
    
    if (!res.ok) {
      if (res.status === 400 || res.status === 401 || res.status === 403) {
        throw new AppErrorImpl('INVALID_KEY', 'Your Gemini API key was rejected. Check it in Autoply options.', false)
      }
      if (res.status === 429) {
        throw new AppErrorImpl('RATE_LIMITED', "Gemini rate limit reached. Wait a minute and try again.", true)
      }
      throw new AppErrorImpl('NETWORK', "Couldn't reach Gemini. Check your connection.", true)
    }
    
    let data: unknown
    try {
      data = await res.json()
    } catch {
      throw new AppErrorImpl('BAD_MODEL_OUTPUT', "The model returned an unusable answer. Try again.", true)
    }

    interface GeminiResponse {
      candidates?: { content?: { parts?: { text?: string }[] } }[]
    }
    const typedData = data as GeminiResponse
    const text = typedData?.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text || typeof text !== 'string') {
      throw new AppErrorImpl('BAD_MODEL_OUTPUT', "The model returned an unusable answer. Try again.", true)
    }
    
    try {
      return parseDrafts(text, input.questions.map(q => q.id))
    } catch {
      throw new AppErrorImpl('BAD_MODEL_OUTPUT', "The model returned an unusable answer. Try again.", true)
    }
  },

  async testKey(apiKey: string, model: string): Promise<void> {
    if (!apiKey) throw new AppErrorImpl('NO_KEY', 'Add your Gemini API key in options.', false)

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)
    
    let res: Response
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-goog-api-key': apiKey
        },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: "Hello" }] }],
          generationConfig: { maxOutputTokens: 5 }
        }),
        signal: controller.signal
      })
    } catch {
      clearTimeout(timeout)
      throw new AppErrorImpl('NETWORK', "Couldn't reach Gemini. Check your connection.", true)
    }
    
    clearTimeout(timeout)
    
    if (!res.ok) {
      if (res.status === 400 || res.status === 401 || res.status === 403) {
        throw new AppErrorImpl('INVALID_KEY', 'Your Gemini API key was rejected. Check it in Autoply options.', false)
      }
      if (res.status === 429) {
        throw new AppErrorImpl('RATE_LIMITED', "Gemini rate limit reached. Wait a minute and try again.", true)
      }
      throw new AppErrorImpl('NETWORK', "Couldn't reach Gemini. Check your connection.", true)
    }
  }
}
