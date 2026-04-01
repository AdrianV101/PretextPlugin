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
    expect(result.version).toBe('0.0.3')
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

  test('loadPretext returns cached module for same projectDir', async () => {
    const { loadPretext } = await import('./version.js')
    const mod1 = await loadPretext('/nonexistent/project')
    const mod2 = await loadPretext('/nonexistent/project')
    expect(mod1).toBe(mod2)
  })
})
