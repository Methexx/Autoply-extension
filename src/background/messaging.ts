import { AppMessageSchema, AppError, Draft } from '../shared/schemas'
import { getProfile, getSettings } from '../shared/storage'
import { toLlmProfile } from '../shared/profile'
import { GEMINI_MODEL } from '../shared/constants'
import { geminiProvider } from './llm/gemini'
import { DraftInput } from './llm/provider'
import { ParseError } from './llm/parse'

export type MessageResponse =
  | { ok: true; drafts?: Draft[] }
  | { ok: false; error: AppError }

function toAppError(err: unknown): AppError {
  if (err && typeof err === 'object' && 'code' in err && 'message' in err) {
    return err as AppError
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
    message: err instanceof Error ? err.message : 'Unknown error occurred.',
    retryable: true,
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
      if (!settings?.geminiApiKey) {
        return {
          ok: false,
          error: {
            code: 'INVALID_KEY',
            message: 'No Gemini API key stored. Please enter and save your key first.',
            retryable: false,
          },
        }
      }

      try {
        await geminiProvider.testKey(settings.geminiApiKey, settings.model || GEMINI_MODEL)
        return { ok: true }
      } catch (err) {
        return {
          ok: false,
          error: toAppError(err),
        }
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
      if (!settings?.geminiApiKey) {
        return {
          ok: false,
          error: {
            code: 'INVALID_KEY',
            message: 'Add your Gemini API key in options.',
            retryable: false,
          },
        }
      }

      const profile = await getProfile()
      if (!profile) {
        return {
          ok: false,
          error: {
            code: 'NO_FIELDS',
            message: 'No profile found. Please set up your profile in options first.',
            retryable: false,
          },
        }
      }

      const maxChars = settings.jobTextMaxChars || 4000
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

      // Drafting pipeline with 1 retry for BAD_MODEL_OUTPUT or retryable errors
      let attempts = 0
      while (attempts < 2) {
        attempts++
        try {
          const drafts = await geminiProvider.draftAnswers(
            draftInput,
            settings.geminiApiKey,
            settings.model || GEMINI_MODEL,
          )
          return { ok: true, drafts }
        } catch (err) {
          const appErr = toAppError(err)
          if (attempts === 1 && (appErr.code === 'BAD_MODEL_OUTPUT' || appErr.retryable)) {
            if (appErr.code === 'RATE_LIMITED') {
              // Rule: For 429 RATE_LIMITED, do NOT auto-retry
              return { ok: false, error: appErr }
            }
            continue
          }
          return { ok: false, error: appErr }
        }
      }

      return {
        ok: false,
        error: {
          code: 'BAD_MODEL_OUTPUT',
          message: 'The model returned an unusable answer after retry. Try again.',
          retryable: true,
        },
      }
    }

    case 'REGENERATE_REQUEST': {
      const settings = await getSettings()
      if (!settings?.geminiApiKey) {
        return {
          ok: false,
          error: {
            code: 'INVALID_KEY',
            message: 'Add your Gemini API key in options.',
            retryable: false,
          },
        }
      }

      const profile = await getProfile()
      if (!profile) {
        return {
          ok: false,
          error: {
            code: 'NO_FIELDS',
            message: 'No profile found. Please set up your profile in options first.',
            retryable: false,
          },
        }
      }

      const maxChars = settings.jobTextMaxChars || 4000
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

      let attempts = 0
      while (attempts < 2) {
        attempts++
        try {
          const drafts = await geminiProvider.draftAnswers(
            draftInput,
            settings.geminiApiKey,
            settings.model || GEMINI_MODEL,
          )
          return { ok: true, drafts }
        } catch (err) {
          const appErr = toAppError(err)
          if (attempts === 1 && (appErr.code === 'BAD_MODEL_OUTPUT' || appErr.retryable)) {
            if (appErr.code === 'RATE_LIMITED') {
              return { ok: false, error: appErr }
            }
            continue
          }
          return { ok: false, error: appErr }
        }
      }

      return {
        ok: false,
        error: {
          code: 'BAD_MODEL_OUTPUT',
          message: 'The model returned an unusable answer after retry. Try again.',
          retryable: true,
        },
      }
    }
  }
}

export function registerMessageHandlers(): void {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    void handleAppMessage(message, sender).then(sendResponse)
    return true // Keep channel open for async response
  })
}
