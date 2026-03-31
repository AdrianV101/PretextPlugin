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
})
