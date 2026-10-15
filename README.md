# Autoply

> AI-drafted job application answers, reviewed by you before anything is submitted.
> Chrome extension · bring-your-own Gemini API key · local-first.

Autoply fills the repetitive parts of job applications and drafts answers to open-ended questions using your own profile. **You review and approve every answer, and you always click Submit yourself.** Autoply never submits an application.

## Why it exists

Every job application asks the same questions again and again: contact details, links, "Why do you want to work here?", "Describe a project you're proud of". Autoply removes the copy-paste work while keeping a human in control of what is actually sent.

## How it works

1. Upload a PDF/plain-text CV to Gemini for extraction, or complete your profile manually. Review the editable suggestions and save them locally.
2. Open a supported application form and click the Autoply toolbar button.
3. Standard fields (name, email, links) are filled from your profile, with no AI involved.
4. For open-ended questions, Autoply sends only the question, the job description, and the relevant profile facts to Gemini and shows you drafts.
5. You edit and approve each draft. Only approved answers are written into the form.
6. You review the form and click Submit yourself.

## Status

MVP in progress. Greenhouse and Lever hosted forms are the supported targets; load the built
extension unpacked while development continues.

## Principles

- **Human gate:** nothing is filled from AI output until approved; Submit is never clicked by the extension.
- **Local-first:** profile and answers live in `chrome.storage.local`. There is no Autoply backend.
- **Bring your own key:** you supply your own Gemini API key.
- **No fabrication:** the model may only use facts from your profile; otherwise it must return `NEEDS_INPUT`.

## Documentation

Read in this order:

| # | Document | What it covers |
|---|----------|----------------|
| 1 | [Product overview](docs/01-product-overview.md) | Problem, users, goals, non-goals |
| 2 | [MVP scope](docs/02-mvp-scope.md) | Feature list with IDs and acceptance criteria |
| 3 | [Architecture](docs/03-architecture.md) | Components, message flow, folder structure |
| 4 | [Tech stack](docs/04-tech-stack.md) | Tools, versions, manifest, permissions |
| 5 | [Data models](docs/05-data-models.md) | Types, storage keys, validation |
| 6 | [LLM integration](docs/06-llm-integration.md) | Gemini call, prompt, JSON contract, errors |
| 7 | [Form detection & filling](docs/07-form-detection-and-filling.md) | Field detection, adapters, safe filling |
| 8 | [UI spec](docs/08-ui-spec.md) | Options page and review overlay |
| 9 | [Security & privacy](docs/09-security-and-privacy.md) | Threat model, data handling, hard rules |
| 10 | [Roadmap](docs/10-roadmap.md) | Milestones and task list |
| 11 | [Testing](docs/11-testing.md) | Test strategy, fixtures, manual checklist |
| 12 | [Decisions](docs/12-decisions.md) | Decision log and open questions |

AI coding agents: start with [`AGENTS.md`](AGENTS.md).

## Development quick start

```bash
pnpm install
pnpm dev          # Vite + CRXJS, outputs to dist/
# Chrome → chrome://extensions → Developer mode → Load unpacked → select dist/
pnpm test         # unit tests (Vitest)
pnpm test:e2e     # Playwright against local HTML fixtures
pnpm build        # production build
```

## Install the unpacked extension

1. Run `pnpm build`.
2. Open `chrome://extensions`, enable **Developer mode**, then select **Load unpacked**.
3. Choose this repository's `dist/` directory.
4. Open Autoply's options page from the extension card, save a profile and Gemini API key, then
   use **Test key** before visiting a supported application page.

## Privacy

Autoply stores your profile and API key only in your browser. When you choose **Import CV with Gemini**,
the selected PDF or plain-text CV (including any contact details it contains) is sent directly to Gemini for one-time extraction and is not stored by
Autoply. When you request drafts, it sends
the application questions, job description, and profile summary, skills, education, experience,
and projects to Google's Gemini API using your own key. Contact details are not sent for draft generation. Autoply has
no servers, analytics, or automatic submission.

Gemini free-tier terms may permit submitted content to be used to improve Google's products.
Review Google's current Gemini API terms before using a free key with sensitive material.

## Terms-of-service note

Some job sites restrict automated interaction. Autoply is designed as an assistive tool: it acts only on the page you have open, only after you click it, one application at a time, and never submits. You are responsible for following the terms of the sites you use.

## License

[MIT](LICENSE)
