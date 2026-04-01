import { describe, test, expect, beforeAll } from 'bun:test'
import { installCanvasShim, getShimStats } from './canvas-shim.js'

describe('canvas-shim', () => {
  beforeAll(() => {
    installCanvasShim()
  })

  test('OffscreenCanvas is globally available after install', () => {
    expect(globalThis.OffscreenCanvas).toBeDefined()
  })

  test('creates a 2d context with font and measureText', () => {
    const canvas = new globalThis.OffscreenCanvas(1, 1)
    const ctx = canvas.getContext('2d')
    expect(ctx).not.toBeNull()
    expect(ctx!.font).toBeDefined()
    expect(typeof ctx!.measureText).toBe('function')
  })

  test('measureText returns width based on character classification', () => {
    const canvas = new globalThis.OffscreenCanvas(1, 1)
    const ctx = canvas.getContext('2d')!
    ctx.font = '16px sans-serif'

    // Latin text: 0.6 * fontSize per character
    const latin = ctx.measureText('hello')
    expect(latin.width).toBeCloseTo(5 * 16 * 0.6, 1)

    // Space: 0.33 * fontSize
    const space = ctx.measureText(' ')
    expect(space.width).toBeCloseTo(16 * 0.33, 1)

    // CJK: 1.0 * fontSize per character
    const cjk = ctx.measureText('世界')
    expect(cjk.width).toBeCloseTo(2 * 16 * 1.0, 1)
  })

  test('font property is writable and changes fontSize', () => {
    const canvas = new globalThis.OffscreenCanvas(1, 1)
    const ctx = canvas.getContext('2d')!
    ctx.font = '24px Inter'
    const result = ctx.measureText('a')
    expect(result.width).toBeCloseTo(24 * 0.6, 1)
  })

  test('getShimStats returns measurement count', () => {
    const stats = getShimStats()
    expect(typeof stats.measurementCount).toBe('number')
    expect(stats.measurementCount).toBeGreaterThan(0)
  })

  test('getContext returns null for non-2d context', () => {
    const canvas = new globalThis.OffscreenCanvas(1, 1)
    expect(canvas.getContext('webgl')).toBeNull()
  })

  test('parseFontSize falls back to 16 for unparseable font string', () => {
    const canvas = new globalThis.OffscreenCanvas(1, 1)
    const ctx = canvas.getContext('2d')!
    ctx.font = 'bold sans-serif' // no px value
    const result = ctx.measureText('a')
    expect(result.width).toBeCloseTo(16 * 0.6, 1)
  })

  test('surrogate pair characters are counted as single character', () => {
    const canvas = new globalThis.OffscreenCanvas(1, 1)
    const ctx = canvas.getContext('2d')!
    ctx.font = '16px sans-serif'
    // U+1F600 (grinning face) is a single emoji via surrogate pair
    const result = ctx.measureText('\u{1F600}')
    expect(result.width).toBeCloseTo(16 * 1.0, 1) // EMOJI_RATIO
  })

  test('tab character uses TAB_RATIO', () => {
    const canvas = new globalThis.OffscreenCanvas(1, 1)
    const ctx = canvas.getContext('2d')!
    ctx.font = '16px sans-serif'
    const result = ctx.measureText('\t')
    expect(result.width).toBeCloseTo(16 * 1.32, 1)
  })

  test('empty string returns zero width', () => {
    const canvas = new globalThis.OffscreenCanvas(1, 1)
    const ctx = canvas.getContext('2d')!
    ctx.font = '16px sans-serif'
    const result = ctx.measureText('')
    expect(result.width).toBe(0)
  })

  test('punctuation characters use PUNCTUATION_RATIO', () => {
    const canvas = new globalThis.OffscreenCanvas(1, 1)
    const ctx = canvas.getContext('2d')!
    ctx.font = '16px sans-serif'
    const result = ctx.measureText('!')
    expect(result.width).toBeCloseTo(16 * 0.4, 1)
  })

  test('installCanvasShim is idempotent', () => {
    const ref = globalThis.OffscreenCanvas
    installCanvasShim()
    expect(globalThis.OffscreenCanvas).toBe(ref)
  })
})
