# 04 — Tech Stack

## 1. Summary

| Area | Choice | Why |
|------|--------|-----|
| Language | TypeScript (`strict`) | Safety across contexts and message types |
| Extension platform | Chrome Manifest V3 | Required for the Chrome Web Store |
| Build | Vite + `@crxjs/vite-plugin` | HMR for extensions, simple manifest handling |
| UI | React 18 | Options page and review overlay |
| Styling | Plain CSS modules or a small hand-written stylesheet inside the Shadow DOM | Keeps the overlay isolated; avoids global Tailwind leaking in |
| Validation | Zod | Runtime validation of storage, messages, LLM output |
| LLM | Gemini API via `fetch` from the service worker | Free tier, BYOK |
| Storage | `chrome.storage.local` | No backend needed |
| Unit tests | Vitest + jsdom | Fast, TS-native |
| E2E tests | Playwright (Chromium with the extension loaded) | Tests against local HTML fixtures |
| Package manager | pnpm | Fast, strict |
| Lint/format | ESLint + Prettier | Consistency |

Pin exact versions in `package.json` at project setup and record them in `docs/12-decisions.md`. Do not rely on versions from memory; check current releases when scaffolding.

## 2. Why no framework for the content script?

The content script's detect/fill logic is plain TypeScript with no UI. React is used only for the overlay (mounted inside a Shadow DOM root) and the options page. This keeps the injected bundle small.

## 3. Manifest (target shape)

```ts
// manifest.config.ts (CRXJS)
import { defineManifest } from '@crxjs/vite-plugin'

export default defineManifest({
  manifest_version: 3,
  name: 'Autoply',
  version: '0.1.0',
  description:
    'AI-drafted job application answers, reviewed by you before anything is submitted.',
  action: { default_title: 'Autoply: fill this application' },
  background: { service_worker: 'src/background/index.ts', type: 'module' },
  options_page: 'src/options/index.html',
  permissions: ['storage', 'activeTab', 'scripting'],
  host_permissions: ['https://generativelanguage.googleapis.com/*'],
  icons: { '16': 'icons/16.png', '48': 'icons/48.png', '128': 'icons/128.png' }
})
```

### Permission rationale

| Permission | Why it is needed | Why not broader |
|-----------|------------------|-----------------|
| `storage` | Profile, key, settings | n/a |
| `activeTab` | Grants access to the current tab only after the user clicks the toolbar button | Avoids always-on access to every site |
| `scripting` | Inject the content script on demand | n/a |
| host `generativelanguage.googleapis.com` | Service worker calls Gemini | Only this host |

Not requested: `tabs`, `<all_urls>`, `webRequest`, `cookies`, `history`. Do not add them without a decision-log entry.

## 4. Gemini API usage

- Endpoint pattern: `https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent`
- Auth header: `x-goog-api-key: <user key>` (never in the URL query string, to keep it out of logs).
- Structured output: `generationConfig.responseMimeType = "application/json"` with a `responseSchema`.
- **Model name is a constant** in `src/shared/constants.ts` (`GEMINI_MODEL`). Default to a current fast, low-cost Flash-class model. Verify the current model ID in Google's docs when implementing, because names and free-tier limits change.
- Details and the prompt are in `06-llm-integration.md`.

## 5. Tooling configuration

- `tsconfig.json`: `strict: true`, `noUncheckedIndexedAccess: true`, `target: ES2022`, `moduleResolution: bundler`, `types: ["chrome", "vite/client"]`.
- ESLint: `@typescript-eslint`, `react-hooks`, rule `no-console` (warn) except in dev builds; custom rule or grep test forbidding `.submit(` / `requestSubmit` (see `07` and `11`).
- Prettier: single quotes, no semicolons, 100 columns.

## 6. Scripts (`package.json`)

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "typecheck": "tsc --noEmit",
    "lint": "eslint .",
    "test": "vitest run",
    "test:e2e": "playwright test"
  }
}
```

## 7. Browser support

- Chrome stable and Chromium-based browsers (Edge, Brave) with MV3.
- Firefox and Safari are not targets for the MVP.

## 8. Release and distribution

- MVP: load unpacked from `dist/` (documented in the README).
- After MVP: Chrome Web Store listing. Requires a privacy policy page describing local-only storage and the Gemini call. Keep permissions minimal to ease review.
- Versioning: SemVer; `0.x` until the MVP definition of done is met.
