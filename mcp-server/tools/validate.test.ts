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
})
