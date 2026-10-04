import { describe, it, expect } from 'vitest'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

// ─── M0-T4: Submit-safety static guard ───────────────────────────────────────
// This test greps all TypeScript source files in src/ for patterns that would
// violate AGENTS.md hard rule §3.1 (never submit the form).
// It intentionally does NOT live under src/ so the ESLint rule doesn't fire
// on it (tests are excluded from the no-restricted-syntax rule).

const FORBIDDEN_PATTERNS: Array<{ pattern: RegExp; description: string }> = [
  {
    pattern: /\.submit\s*\(/,
    description: '.submit() call (form submission)',
  },
  {
    pattern: /\.requestSubmit\s*\(/,
    description: '.requestSubmit() call (form submission)',
  },
  {
    // Matches .click() on any identifier — the lint rule is more surgical
    // but the test catches it even if lint is suppressed
    pattern: /\bsubmitBtn\s*\.\s*click\s*\(|\bapplyBtn\s*\.\s*click\s*\(/,
    description: '.click() on a submit/apply button variable',
  },
]

/** Recursively collect all .ts/.tsx files under a directory. */
async function collectTsFiles(dir: string): Promise<string[]> {
  const files: string[] = []
  const entries = await readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await collectTsFiles(full)))
    } else if (entry.isFile() && /\.(tsx?)$/.test(entry.name)) {
      files.push(full)
    }
  }
  return files
}

describe('M0-T4 — submit-safety static guard', () => {
  it('src/ contains no forbidden form-submission calls', async () => {
    const srcDir = join(process.cwd(), 'src')
    const files = await collectTsFiles(srcDir)

    const violations: string[] = []

    for (const file of files) {
      const source = await readFile(file, 'utf-8')
      const lines = source.split('\n')
      for (const { pattern, description } of FORBIDDEN_PATTERNS) {
        lines.forEach((line, idx) => {
          if (pattern.test(line)) {
            violations.push(`${file}:${idx + 1} — ${description}\n  > ${line.trim()}`)
          }
        })
      }
    }

    if (violations.length > 0) {
      throw new Error(
        `[Autoply hard rule §3.1] Found forbidden form-submission call(s):\n\n${violations.join('\n\n')}`,
      )
    }

    expect(violations).toHaveLength(0)
  })

  it('rejects a synthetic .submit() call when tested directly', () => {
    // This verifies the pattern itself works — not a live file scan
    const pattern = FORBIDDEN_PATTERNS[0]!.pattern
    expect(pattern.test('form.submit()')).toBe(true)
    expect(pattern.test('// form.submit() was considered')).toBe(true)
    // Safe usage (e.g. a different method) should NOT match
    expect(pattern.test('const result = doSubmitWork()')).toBe(false)
  })

  it('rejects .requestSubmit() pattern', () => {
    const pattern = FORBIDDEN_PATTERNS[1]!.pattern
    expect(pattern.test('form.requestSubmit()')).toBe(true)
    expect(pattern.test('el.requestSubmit(button)')).toBe(true)
    expect(pattern.test('requestSubmitted = true')).toBe(false)
  })
})
