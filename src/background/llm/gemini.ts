import { DraftInput, LlmProvider } from './provider'
import { buildSystemPrompt, buildUserPrompt } from './prompt'
import { parseDrafts } from './parse'
import { CvFile, Draft, AppError, ErrorCode, ExtractedProfile, ExtractedProfileSchema } from '../../shared/schemas'
import { DRAFT_TIMEOUT_MS } from '../../shared/constants'

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

const CV_PROFILE_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    fullName: { type: 'STRING' }, email: { type: 'STRING' }, phone: { type: 'STRING' }, location: { type: 'STRING' },
    links: { type: 'OBJECT', properties: { linkedin: { type: 'STRING' }, github: { type: 'STRING' }, website: { type: 'STRING' } }, required: ['linkedin', 'github', 'website'] },
    summary: { type: 'STRING' }, skills: { type: 'ARRAY', items: { type: 'STRING' } },
    education: { type: 'ARRAY', items: { type: 'OBJECT', properties: { institution: { type: 'STRING' }, degree: { type: 'STRING' }, field: { type: 'STRING' }, startYear: { type: 'INTEGER' }, endYear: { type: 'INTEGER' }, notes: { type: 'STRING' } }, required: ['institution', 'degree'] } },
    experience: { type: 'ARRAY', items: { type: 'OBJECT', properties: { organization: { type: 'STRING' }, role: { type: 'STRING' }, startDate: { type: 'STRING' }, endDate: { type: 'STRING' }, description: { type: 'STRING' } }, required: ['organization', 'role', 'description'] } },
    projects: { type: 'ARRAY', items: { type: 'OBJECT', properties: { name: { type: 'STRING' }, description: { type: 'STRING' }, technologies: { type: 'ARRAY', items: { type: 'STRING' } }, url: { type: 'STRING' } }, required: ['name', 'description', 'technologies', 'url'] } },
  },
  required: ['fullName', 'email', 'phone', 'location', 'links', 'summary', 'skills', 'education', 'experience', 'projects'],
}

function outputTokenBudget(input: DraftInput): number {
  const coverLetterCount = input.questions.filter(question =>
    /\b(cover\s*letter|letter\s*of\s*interest|message to (the )?(hiring )?team|message)\b/i.test(question.label),
  ).length
  const otherQuestionCount = input.questions.length - coverLetterCount
  return Math.min(1024, Math.max(192, coverLetterCount * 420 + otherQuestionCount * 220))
}

export const geminiProvider: LlmProvider = {
  async draftAnswers(input: DraftInput, apiKey: string, model: string): Promise<Draft[]> {
    if (!apiKey) throw new AppErrorImpl('NO_KEY', 'Add your Gemini API key in options.', false)
    
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), DRAFT_TIMEOUT_MS)
    
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
            maxOutputTokens: outputTokenBudget(input),
            responseMimeType: 'application/json',
            responseSchema: DRAFT_RESPONSE_SCHEMA
          }
        }),
        signal: controller.signal
      })
    } catch (error) {
      clearTimeout(timeout)
      throw mapFetchError(error)
    }
    
    clearTimeout(timeout)
    
    if (!res.ok) throw mapGeminiStatus(res.status)
    
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
    } catch (error) {
      clearTimeout(timeout)
      throw mapFetchError(error)
    }
    
    clearTimeout(timeout)
    
    if (!res.ok) throw mapGeminiStatus(res.status)
  },

  async extractProfileFromCv(file: CvFile, apiKey: string, model: string): Promise<ExtractedProfile> {
    if (!apiKey) throw new AppErrorImpl('NO_KEY', 'Add your Gemini API key in options.', false)
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ parts: [
          { text: 'Extract this CV into the supplied JSON schema. Use only facts explicitly present in the CV. Use empty strings or empty arrays when unknown. Do not invent dates, skills, links, achievements, or contact details.' },
          { inlineData: { mimeType: file.mimeType, data: file.data } },
        ] }],
        generationConfig: { temperature: 0, responseMimeType: 'application/json', responseSchema: CV_PROFILE_RESPONSE_SCHEMA },
      }),
    }).catch(error => { throw mapFetchError(error) })
    if (!response.ok) throw mapGeminiStatus(response.status)
    const data: unknown = await response.json().catch(() => null)
    const text = (data as { candidates?: { content?: { parts?: { text?: string }[] } }[] })?.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text) throw new AppErrorImpl('BAD_MODEL_OUTPUT', "The model returned an unusable answer. Try again.", true)
    const parsed = ExtractedProfileSchema.safeParse(safelyParseJson(text))
    if (!parsed.success) throw new AppErrorImpl('BAD_MODEL_OUTPUT', "The model returned an unusable answer. Try again.", true)
    return parsed.data
  }
}

function safelyParseJson(text: string): unknown {
  try { return JSON.parse(text) } catch { return null }
}

function mapFetchError(error: unknown): AppErrorImpl {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return new AppErrorImpl('NETWORK', 'Gemini did not respond in time. Check your connection and try again.', true)
  }
  return new AppErrorImpl('NETWORK', "Could not reach Gemini. Check your internet connection and try again.", true)
}

function mapGeminiStatus(status: number): AppErrorImpl {
  if (status === 401 || status === 403) return new AppErrorImpl('INVALID_KEY', 'Gemini rejected this API key. Confirm it is active and belongs to this Google project.', false)
  if (status === 429) return new AppErrorImpl('RATE_LIMITED', 'Gemini rate limit reached. Wait a minute, then try again.', true)
  if (status === 404) return new AppErrorImpl('BAD_MODEL_OUTPUT', 'The selected Gemini model is unavailable. Update Autoply and test the key again.', false)
  if (status === 400) return new AppErrorImpl('BAD_MODEL_OUTPUT', 'Gemini rejected the request. Check that the API key has Gemini API access, then try again.', false)
  if (status >= 500) return new AppErrorImpl('NETWORK', 'Gemini is temporarily unavailable. Try again in a few minutes.', true)
  return new AppErrorImpl('NETWORK', `Gemini returned an unexpected service error (${status}). Try again later.`, true)
}
