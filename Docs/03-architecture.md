# 03 — Architecture

## 1. Overview

Autoply is a Manifest V3 Chrome extension with four runtime parts and no backend.

```
┌────────────┐   user click    ┌────────────────────────────┐
│ Toolbar    │ ──────────────► │ Service worker (background)│
│ action     │                 │  - injects content script  │
└────────────┘                 │  - owns API key            │
                               │  - calls Gemini            │
                               └──────▲──────────┬──────────┘
                      runtime messages│          │ HTTPS
┌────────────────────────────┐        │          ▼
│ Job page (any tab)         │        │   ┌──────────────┐
│  ┌──────────────────────┐  │        │   │ Gemini API   │
│  │ Content script       │◄─┼────────┘   └──────────────┘
│  │  detect → fill       │  │
│  │  Overlay (Shadow DOM)│  │        ┌─────────────────────────┐
│  └──────────────────────┘  │        │ Options page (React)    │
└────────────────────────────┘        │  profile + API key      │
                                      └───────────┬─────────────┘
                                                  ▼
                                      chrome.storage.local
```

## 2. Components

### 2.1 Service worker (`src/background/`)
- Handles the toolbar action click: injects the content script into the active tab with `chrome.scripting.executeScript`.
- Receives typed messages from the content script and options page.
- Is the **only** component that reads the API key and calls Gemini.
- Builds prompts, parses and validates responses (`llm/`).
- Stateless between events (MV3 workers can be terminated); anything needed later lives in `chrome.storage`.

### 2.2 Content script (`src/content/`)
- Injected on demand; does nothing until the user clicks the toolbar button.
- **Detect:** finds form fields and labels, picks an adapter (Greenhouse, Lever, or generic).
- **Extract:** reads job title, company, and description text from the page.
- **Fill:** sets values using the safe-fill routine (see `07-form-detection-and-filling.md`).
- **Overlay:** mounts the React review UI inside a Shadow DOM host element.
- Never has access to the API key. Talks to the service worker via messages.

### 2.3 Options page (`src/options/`)
- React page for profile and API key. Reads/writes `chrome.storage.local` directly.
- "Test key" sends a message to the service worker, which makes the Gemini request.

### 2.4 Shared (`src/shared/`)
- `types.ts`: TypeScript types and the message union.
- `schemas.ts`: Zod schemas for profile, settings, messages, LLM responses.
- `storage.ts`: typed wrappers around `chrome.storage.local`.
- `constants.ts`: storage keys, limits, selectors that must never be clicked.

## 3. Main sequence: "Fill this application"

1. User clicks the toolbar button.
2. Service worker checks that a profile and key exist (else opens the options page with a message).
3. Service worker injects the content script into the tab.
4. Content script: detect fields → extract job context → send `DRAFT_REQUEST`.
5. Content script fills **standard fields** locally from the profile (no AI).
6. Service worker builds the prompt for the remaining open-ended questions and calls Gemini once.
7. Service worker validates the JSON and replies `DRAFT_RESPONSE` (or `DRAFT_ERROR`).
8. Content script mounts the overlay with drafts.
9. User edits/approves/skips; may trigger `REGENERATE_REQUEST` for single questions.
10. User clicks "Fill approved"; content script writes only approved answers.
11. Overlay shows "Review the form, then submit it yourself." The extension does nothing further.

```
Content script            Service worker              Gemini
     │  DRAFT_REQUEST         │                          │
     │───────────────────────►│  generateContent         │
     │                        │─────────────────────────►│
     │                        │◄─────────────────────────│
     │  DRAFT_RESPONSE        │  (validate JSON)         │
     │◄───────────────────────│                          │
  overlay → user approves → fill approved → user submits
```

## 4. Message contract

All messages are a discriminated union on `type` (defined in `src/shared/types.ts`, validated with Zod).

| Type | Direction | Payload | Reply |
|------|-----------|---------|-------|
| `DRAFT_REQUEST` | content → SW | `{ job, questions[] }` | `DRAFT_RESPONSE` or `DRAFT_ERROR` |
| `REGENERATE_REQUEST` | content → SW | `{ job, question, hint? }` | `DRAFT_RESPONSE` or `DRAFT_ERROR` |
| `TEST_KEY` | options → SW | `{}` | `{ ok: true }` or `{ ok: false, code, message }` |
| `OPEN_OPTIONS` | content → SW | `{ reason }` | none |

Rules:
- Messages carry only what the receiver needs. Never send the API key in any message.
- Standard-field values (email, phone) are never included in `DRAFT_REQUEST`.

## 5. Data flow and trust boundaries

| Zone | Trusted? | Holds |
|------|----------|-------|
| Page DOM (job site) | **Untrusted** | Labels, job text (could contain injection text) |
| Content script | Semi-trusted | Profile subset in memory while filling; no key |
| Service worker | Trusted | API key, prompt building, network |
| Storage | Local to user's browser profile | Profile, key, settings |
| Gemini API | External | Questions, job text, profile facts needed for drafts |

## 6. Error handling pattern

- Service worker returns structured errors: `{ code, message, retryable }`.
- Codes: `NO_PROFILE`, `NO_KEY`, `INVALID_KEY`, `RATE_LIMITED`, `NETWORK`, `BAD_MODEL_OUTPUT`, `NO_FIELDS`, `UNSUPPORTED_PAGE`.
- Content script maps codes to user-friendly overlay messages (see `08-ui-spec.md`).

## 7. Extensibility points (prepared, not built)

- **LLM provider interface** (`llm/provider.ts`): `draftAnswers(input): Promise<Draft[]>`. MVP implements only Gemini.
- **Adapter interface** (`content/adapters/types.ts`): `matches(url, document)`, `findFields(document)`, `extractJob(document)`.
- **Saved answers store** (v1.1) plugs in before the LLM call.

## 8. Folder structure

See the tree in `AGENTS.md` section 6; it is the canonical layout.

## 9. Known limitations (MVP)

- Forms embedded in cross-origin iframes (some company career pages embedding Greenhouse) are not supported in the MVP.
- Single-page, multi-step wizards are handled one step at a time: the user clicks the button again on each step.
- Workday and other heavily scripted ATS platforms are out of scope for the MVP.
