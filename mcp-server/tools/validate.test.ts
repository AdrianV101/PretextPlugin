import { describe, test, expect } from 'bun:test'
import { handleValidate } from './validate.js'

describe('pretext_validate', () => {
  test('detects system-ui font usage', () => {
    const result = handleValidate({
      code: `prepare("hello", "16px system-ui")`,
    })
    expect(result.issues.length).toBeGreaterThan(0)
    expect(result.issues.some(i => i.pattern === 'system-ui-font')).toBe(true)
  })

  test('detects prepare() inside resize handler', () => {
    const result = handleValidate({
      code: `window.addEventListener('resize', () => { prepare(text, font) })`,
    })
    expect(result.issues.some(i => i.pattern === 'prepare-on-resize')).toBe(true)
  })

  test('detects inlined prepare', () => {
    const result = handleValidate({
      code: `layout(prepare(text, font), width, lh)`,
    })
    expect(result.issues.some(i => i.pattern === 'inlined-prepare')).toBe(true)
  })

  test('returns no issues for correct code', () => {
    const result = handleValidate({
      code: `
        const prepared = prepare(text, "16px Inter")
        const result = layout(prepared, width, 20)
      `,
    })
    expect(result.issues.length).toBe(0)
  })

  test('detects clearCache in loop', () => {
    const result = handleValidate({
      code: `requestAnimationFrame(() => { clearCache() })`,
    })
    expect(result.issues.some(i => i.pattern === 'clearCache-in-loop')).toBe(true)
  })

  test('detects DOM measurement alongside pretext', () => {
    const result = handleValidate({
      code: `
        const { height } = layout(prepared, width, 20)
        element.getBoundingClientRect()
      `,
    })
    expect(result.issues.some(i => i.pattern === 'dom-measurement')).toBe(true)
  })

  test('detects missing-pre-wrap for text with newlines', () => {
    const result = handleValidate({
      code: `prepare("line1\\nline2\\n", "16px Inter")`,
    })
    expect(result.issues.some(i => i.pattern === 'missing-pre-wrap')).toBe(true)
  })

  test('returns multiple issues for code with multiple anti-patterns', () => {
    const result = handleValidate({
      code: `layout(prepare(text, "16px system-ui"), width, 20)`,
    })
    expect(result.issues.length).toBeGreaterThanOrEqual(2)
    expect(result.issues.some(i => i.pattern === 'system-ui-font')).toBe(true)
    expect(result.issues.some(i => i.pattern === 'inlined-prepare')).toBe(true)
  })

  test('each issue has severity, explanation, and fix', () => {
    const result = handleValidate({
      code: `prepare("hello", "16px system-ui")`,
    })
    for (const issue of result.issues) {
      expect(issue.severity).toMatch(/^(error|warning|info)$/)
      expect(issue.explanation.length).toBeGreaterThan(0)
      expect(issue.fix.length).toBeGreaterThan(0)
    }
  })

  test('prepare outside resize context does not trigger prepare-on-resize', () => {
    const result = handleValidate({
      code: `const p = prepare(text, font)`,
    })
    expect(result.issues.some(i => i.pattern === 'prepare-on-resize')).toBe(false)
  })

  test('clearCache outside loop does not trigger clearCache-in-loop', () => {
    const result = handleValidate({
      code: `clearCache()`,
    })
    expect(result.issues.some(i => i.pattern === 'clearCache-in-loop')).toBe(false)
  })

  test('detects inlined prepareWithSegments', () => {
    const result = handleValidate({
      code: `layout(prepareWithSegments(text, font), width, lh)`,
    })
    expect(result.issues.some(i => i.pattern === 'inlined-prepare')).toBe(true)
  })

  test('empty code returns no issues', () => {
    const result = handleValidate({ code: '' })
    expect(result.issues.length).toBe(0)
  })

  test('flags wordBreak: keep-all on Latin-only code (no CJK escapes)', () => {
    const result = handleValidate({
      code: `prepare(text, "16px Inter", { wordBreak: 'keep-all' })`,
    })
    expect(result.issues.some(i => i.pattern === 'wordbreak-misuse')).toBe(true)
  })

  test('does not flag wordBreak: keep-all when code references CJK ranges', () => {
    const result = handleValidate({
      code: `
        // Korean: \\uAC00-\\uD7A3 sliding window
        prepare(text, "16px Inter", { wordBreak: 'keep-all' })
      `,
    })
    expect(result.issues.some(i => i.pattern === 'wordbreak-misuse')).toBe(false)
  })

  test('flags excessive letterSpacing values (>=10)', () => {
    const result = handleValidate({
      code: `prepare(text, font, { letterSpacing: 12 })`,
    })
    expect(result.issues.some(i => i.pattern === 'excessive-letterspacing')).toBe(true)
  })

  test('flags fractional excessive letterSpacing (the unit-confusion shape)', () => {
    for (const value of ['10.5', '25.0', '99.9']) {
      const result = handleValidate({
        code: `prepare(text, font, { letterSpacing: ${value} })`,
      })
      expect(
        result.issues.some(i => i.pattern === 'excessive-letterspacing'),
        `expected ${value} to flag`,
      ).toBe(true)
    }
  })

  test('does not flag reasonable letterSpacing values', () => {
    for (const value of ['0', '0.5', '2', '8.5', '9.9']) {
      const result = handleValidate({
        code: `prepare(text, font, { letterSpacing: ${value} })`,
      })
      expect(
        result.issues.some(i => i.pattern === 'excessive-letterspacing'),
        `expected ${value} not to flag`,
      ).toBe(false)
    }
  })

  test('flags prepare() use on text with mention/chip patterns', () => {
    const result = handleValidate({
      code: `
        const prepared = prepare("hi @alice and @bob, see #project-x", font)
        layout(prepared, width, 20)
      `,
    })
    expect(result.issues.some(i => i.pattern === 'prepare-vs-rich-inline-confusion')).toBe(true)
  })

  test('does not flag email addresses inside prepare()', () => {
    const result = handleValidate({
      code: `prepare("contact me at me@example.com", font)`,
    })
    expect(result.issues.some(i => i.pattern === 'prepare-vs-rich-inline-confusion')).toBe(false)
  })

  test('does not flag prepareRichInline use on chip-shaped content', () => {
    const result = handleValidate({
      code: `
        const items = [{ text: '@alice', font, break: 'never' }]
        const prepared = prepareRichInline(items)
      `,
    })
    expect(result.issues.some(i => i.pattern === 'prepare-vs-rich-inline-confusion')).toBe(false)
  })
})
