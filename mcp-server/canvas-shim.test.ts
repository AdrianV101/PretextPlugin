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
})
