import { describe, test, expect, beforeAll } from 'bun:test'
import { installCanvasShim } from './canvas-shim.js'

// Must install shim before importing version module (which imports pretext)
beforeAll(() => {
  installCanvasShim()
})

describe('version detection', () => {
  test('locatePretext returns bundled path when no user installation exists', async () => {
    const { locatePretext } = await import('./version.js')
    const result = await locatePretext('/nonexistent/project')
    expect(result.source).toBe('bundled')
    expect(result.version).toBe('0.0.6')
    expect(result.warning).toBeUndefined()
  })

  test('loadPretext returns a module with prepare and layout functions', async () => {
    const { loadPretext } = await import('./version.js')
    const mod = await loadPretext('/nonexistent/project')
    expect(typeof mod.prepare).toBe('function')
    expect(typeof mod.layout).toBe('function')
    expect(typeof mod.prepareWithSegments).toBe('function')
    expect(typeof mod.layoutWithLines).toBe('function')
    expect(typeof mod.clearCache).toBe('function')
  })

  test('loadPretext module can prepare and layout text', async () => {
    const { loadPretext } = await import('./version.js')
    const mod = await loadPretext('/nonexistent/project')
    const prepared = mod.prepare('hello world', '16px sans-serif')
    const result = mod.layout(prepared, 1000, 20)
    expect(result.lineCount).toBe(1)
    expect(result.height).toBe(20)
  })

  test('loadPretext exposes setLocale and walkLineRanges', async () => {
    const { loadPretext } = await import('./version.js')
    const mod = await loadPretext('/nonexistent/project')
    expect(typeof mod.setLocale).toBe('function')
    expect(typeof mod.walkLineRanges).toBe('function')
  })

  test('loadPretext exposes v0.0.5+ geometry helpers', async () => {
    const { loadPretext } = await import('./version.js')
    const mod = await loadPretext('/nonexistent/project')
    expect(typeof mod.measureLineStats).toBe('function')
    expect(typeof mod.measureNaturalWidth).toBe('function')
    expect(typeof mod.layoutNextLineRange).toBe('function')
    expect(typeof mod.materializeLineRange).toBe('function')
  })

  test('loadPretext accepts v0.0.5+ wordBreak option', async () => {
    const { loadPretext } = await import('./version.js')
    const mod = await loadPretext('/nonexistent/project')
    const prepared = mod.prepare('hello world', '16px sans-serif', { wordBreak: 'keep-all' })
    const result = mod.layout(prepared, 1000, 20)
    expect(result.lineCount).toBe(1)
  })

  test('loadPretext accepts v0.0.6 letterSpacing option', async () => {
    const { loadPretext } = await import('./version.js')
    const mod = await loadPretext('/nonexistent/project')
    const a = mod.prepare('hello world', '16px sans-serif', { letterSpacing: 0 })
    const b = mod.prepare('hello world', '16px sans-serif', { letterSpacing: 5 })
    const layoutA = mod.layout(a, 1000, 20)
    const layoutB = mod.layout(b, 1000, 20)
    expect(layoutA.lineCount).toBe(1)
    expect(layoutB.lineCount).toBe(1)
  })

  test('loadPretextRichInline exposes the v0.0.5+ rich-inline surface', async () => {
    const { loadPretextRichInline } = await import('./version.js')
    const mod = await loadPretextRichInline('/nonexistent/project')
    expect(typeof mod.prepareRichInline).toBe('function')
    expect(typeof mod.layoutNextRichInlineLineRange).toBe('function')
    expect(typeof mod.walkRichInlineLineRanges).toBe('function')
    expect(typeof mod.materializeRichInlineLineRange).toBe('function')
    expect(typeof mod.measureRichInlineStats).toBe('function')
  })

  test('rich-inline module measures a simple item', async () => {
    const { loadPretextRichInline } = await import('./version.js')
    const mod = await loadPretextRichInline('/nonexistent/project')
    const prepared = mod.prepareRichInline([{ text: 'hello world', font: '16px sans-serif' }])
    const stats = mod.measureRichInlineStats(prepared, 1000)
    expect(stats.lineCount).toBe(1)
    expect(stats.maxLineWidth).toBeGreaterThan(0)
  })

  test('loadPretext returns cached module for same projectDir', async () => {
    const { loadPretext } = await import('./version.js')
    const mod1 = await loadPretext('/nonexistent/project')
    const mod2 = await loadPretext('/nonexistent/project')
    expect(mod1).toBe(mod2)
  })
})

describe('requireVersioned', () => {
  const loc = { path: '/x/@chenglou/pretext/dist/layout.js', version: '0.0.4', source: 'user' as const }

  test('delegates to the underlying function when present', async () => {
    const { requireVersioned } = await import('./version.js')
    const real = (a: number, b: number) => a + b
    const wrapped = requireVersioned<(a: number, b: number) => number>('measureLineStats', '0.0.5', loc, real)
    expect(wrapped(2, 3)).toBe(5)
  })

  test('throws a versioned error naming the helper when the export is absent', async () => {
    const { requireVersioned } = await import('./version.js')
    const wrapped = requireVersioned<() => number>('measureLineStats', '0.0.5', loc, undefined)
    expect(() => wrapped()).toThrow(/measureLineStats requires pretext >=0\.0\.5/)
    expect(() => wrapped()).toThrow(/detected v0\.0\.4/)
  })

  test('treats a non-function export as absent', async () => {
    const { requireVersioned } = await import('./version.js')
    const wrapped = requireVersioned<() => number>('measureNaturalWidth', '0.0.5', loc, 42 as unknown)
    expect(() => wrapped()).toThrow(/measureNaturalWidth requires pretext >=0\.0\.5/)
  })
})
