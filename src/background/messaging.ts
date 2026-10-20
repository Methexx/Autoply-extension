import { AppMessageSchema, AppError, AppErrorSchema, Draft, ExtractedProfile, Settings } from '../shared/schemas'
import { getProfile, getSettings } from '../shared/storage'
import { toLlmProfile } from '../shared/profile'
import { GEMINI_MODEL, JOB_DESCRIPTION_MAX_CHARS } from '../shared/constants'
import { geminiProvider } from './llm/gemini'
import { openaiProvider } from './llm/openai'
import { DraftInput } from './llm/provider'
import { ParseError } from './llm/parse'

export type MessageResponse =
  | { ok: true; drafts?: Draft[]; profile?: ExtractedProfile }
  | { ok: false; error: AppError }

function toAppError(err: unknown): AppError {
  if (err && typeof err === 'object' && 'code' in err && 'message' in err && 'retryable' in err) {
    // Error.message is non-enumerable. Return a plain object so Chrome message
    // serialization preserves the safe, user-facing diagnostic.
    const parsed = AppErrorSchema.safeParse(err)
    if (parsed.success) return parsed.data
  }
  if (err instanceof ParseError) {
    return {
      code: 'BAD_MODEL_OUTPUT',
      message: err.message,
      retryable: true,
    }
  }
  return {
    code: 'NETWORK',
    message: 'Autoply could not contact the AI provider. Try again.',
    retryable: true,
  }
}

async function draftWithProviders(input: DraftInput, settings: Settings): Promise<MessageResponse> {
  const preferred = settings.primaryProvider ?? 'gemini'
  const other = preferred === 'gemini' ? 'openai' : 'gemini'
  const keys = { gemini: settings.geminiApiKey, openai: settings.openaiApiKey ?? '' }
  const primary = keys[preferred] ? preferred : other
  if (!keys[primary]) return { ok: false, error: { code: 'NO_KEY', message: 'Add a Gemini or OpenAI API key in options.', retryable: false } }
  const run = (provider: 'gemini' | 'openai') => provider === 'gemini'
    ? geminiProvider.draftAnswers(input, keys.gemini, settings.model || GEMINI_MODEL)
    : openaiProvider.draftAnswers(input, keys.openai)
  try {
    return { ok: true, drafts: await run(primary) }
  } catch (err) {
    const error = toAppError(err)
    const fallback = primary === 'gemini' ? 'openai' : 'gemini'
    if (settings.fallbackEnabled && keys[fallback] && (error.retryable || error.code === 'INVALID_KEY')) {
      try { return { ok: true, drafts: await run(fallback) } }
      catch (fallbackError) { return { ok: false, error: toAppError(fallbackError) } }
    }
    if (error.retryable && error.code !== 'RATE_LIMITED') {
      try { return { ok: true, drafts: await run(primary) } }
      catch (retryError) { return { ok: false, error: toAppError(retryError) } }
    }
    return { ok: false, error }
  }
}

export async function handleAppMessage(
  message: unknown,
  sender: chrome.runtime.MessageSender,
): Promise<MessageResponse> {
  // Validate sender security
  if (sender.id !== chrome.runtime.id) {
    return {
      ok: false,
      error: {
        code: 'NETWORK',
        message: 'Unauthorized message sender',
        retryable: false,
      },
    }
  }

  const parsed = AppMessageSchema.safeParse(message)
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: 'BAD_MODEL_OUTPUT',
        message: 'Invalid message structure',
        retryable: false,
      },
    }
  }

  const msg = parsed.data

  switch (msg.type) {
    case 'TEST_KEY': {
      const settings = await getSettings()
      const provider = msg.provider ?? 'gemini'
      const key = provider === 'gemini' ? settings?.geminiApiKey : settings?.openaiApiKey
      if (!key) {
        return {
          ok: false,
          error: {
            code: 'NO_KEY',
            message: `No ${provider === 'gemini' ? 'Gemini' : 'OpenAI'} API key stored. Please enter and save your key first.`,
            retryable: false,
          },
        }
      }

      try {
        if (provider === 'gemini') await geminiProvider.testKey(key, settings?.model || GEMINI_MODEL)
        else await openaiProvider.testKey(key)
        return { ok: true }
      } catch (err) {
        return {
          ok: false,
          error: toAppError(err),
        }
      }
    }

    case 'CV_EXTRACT_REQUEST': {
      const settings = await getSettings()
      if (!settings?.geminiApiKey) {
        return { ok: false, error: { code: 'NO_KEY', message: 'Add your Gemini API key in options.', retryable: false } }
      }
      try {
        return { ok: true, profile: await geminiProvider.extractProfileFromCv(msg.file, settings.geminiApiKey, settings.model || GEMINI_MODEL) }
      } catch (err) {
        return { ok: false, error: toAppError(err) }
      }
    }

    case 'OPEN_OPTIONS': {
      if (chrome.runtime.openOptionsPage) {
        await chrome.runtime.openOptionsPage()
      }
      return { ok: true }
    }

    case 'DRAFT_REQUEST': {
      const settings = await getSettings()
      if (!settings || !(settings.geminiApiKey || settings.openaiApiKey)) {
        return {
          ok: false,
          error: {
            code: 'NO_KEY',
            message: 'Add a Gemini or OpenAI API key in options.',
            retryable: false,
          },
        }
      }

      const profile = await getProfile()
      if (!profile) {
        return {
          ok: false,
          error: {
            code: 'NO_PROFILE',
            message: 'No profile found. Please set up your profile in options first.',
            retryable: false,
          },
        }
      }

      const maxChars = Math.min(settings.jobTextMaxChars || JOB_DESCRIPTION_MAX_CHARS, JOB_DESCRIPTION_MAX_CHARS)
      const draftInput: DraftInput = {
        profile: toLlmProfile(profile),
        job: {
          title: msg.job.title,
          company: msg.job.company,
          description: msg.job.description.slice(0, maxChars),
          url: msg.job.url,
        },
        questions: msg.questions,
      }

      return draftWithProviders(draftInput, settings)
    }

    case 'REGENERATE_REQUEST': {
      const settings = await getSettings()
      if (!settings || !(settings.geminiApiKey || settings.openaiApiKey)) {
        return {
          ok: false,
          error: {
            code: 'NO_KEY',
            message: 'Add a Gemini or OpenAI API key in options.',
            retryable: false,
          },
        }
      }

      const profile = await getProfile()
      if (!profile) {
        return {
          ok: false,
          error: {
            code: 'NO_PROFILE',
            message: 'No profile found. Please set up your profile in options first.',
            retryable: false,
          },
        }
      }

      const maxChars = Math.min(settings.jobTextMaxChars || JOB_DESCRIPTION_MAX_CHARS, JOB_DESCRIPTION_MAX_CHARS)
      const draftInput: DraftInput = {
        profile: toLlmProfile(profile),
        job: {
          title: msg.job.title,
          company: msg.job.company,
          description: msg.job.description.slice(0, maxChars),
          url: msg.job.url,
        },
        questions: [msg.question],
        ...(msg.hint ? { hint: msg.hint } : {}),
      }

      return draftWithProviders(draftInput, settings)
    }
  }
}

export function registerMessageHandlers(): void {
  if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      void handleAppMessage(message, sender)
        .then(sendResponse)
        .catch(() => sendResponse({
          ok: false,
          error: {
            code: 'NETWORK',
            message: 'Autoply could not process this request. Reload the extension and try again.',
            retryable: true,
          },
        } satisfies MessageResponse))
      return true // Keep channel open for async response
    })
  }
}
