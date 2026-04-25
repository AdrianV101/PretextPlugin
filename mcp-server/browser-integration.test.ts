// End-to-end tests against a real chromium browser.
// Gated behind PRETEXT_ACCURATE_TESTS=1 because:
//   1. playwright is an optional peer dep — may not be installed
//   2. the chromium binary may not be installed
//   3. launching a real browser is slow (~1s) and we want CI to stay fast
//
// To run:
//   cd mcp-server
//   bun add playwright                # if not already installed
//   bunx playwright install chromium
//   PRETEXT_ACCURATE_TESTS=1 bun test browser-integration.test.ts

import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { browserRun, browserMeasure, __setPoolForTesting, __resetPoolForTesting } from './browser.js'
import { BrowserPool } from './browser-pool.js'

const ENABLED = process.env.PRETEXT_ACCURATE_TESTS === '1'
const d = ENABLED ? describe : describe.skip

// Use a single shared pool across the whole file for speed.
// Resetting between files would relaunch the browser.
let sharedPool: BrowserPool | null = null

d('accurate mode — real chromium', () => {
  beforeAll(() => {
    sharedPool = new BrowserPool()
    __setPoolForTesting(sharedPool)
  })
  afterAll(async () => {
    if (sharedPool) await sharedPool.close()
    __resetPoolForTesting()
  })

  test('layout short ASCII returns sensible line count and height', async () => {
    const out = await browserRun({
      text: 'The quick brown fox jumps over the lazy dog',
      font: '16px sans-serif',
      width: 200,
      lineHeight: 20,
      browser: 'chromium',
    })
    expect(out.lineCount).toBeGreaterThanOrEqual(1)
    expect(out.lineCount).toBeLessThanOrEqual(6)
    expect(out.height).toBeGreaterThan(0)
  }, 30_000)

  test('rich run returns per-line widths as real numbers', async () => {
    const out = await browserRun({
      text: 'alpha beta gamma delta',
      font: '16px sans-serif',
      width: 80,
      lineHeight: 20,
      rich: true,
      browser: 'chromium',
    })
    expect(out.lines).toBeDefined()
    for (const line of out.lines!) {
      expect(line.width).toBeGreaterThan(0)
      expect(line.width).toBeLessThanOrEqual(80)
    }
  }, 30_000)

  test('measure returns segments with non-zero widths', async () => {
    const out = await browserMeasure({
      text: 'hello world',
      font: '16px sans-serif',
      browser: 'chromium',
    })
    expect(out.error).toBeUndefined()
    expect(out.segments.length).toBeGreaterThan(0)
    expect(out.totalWidth).toBeGreaterThan(0)
    for (const seg of out.segments) {
      expect(seg.width).toBeGreaterThan(0)
    }
  }, 30_000)

  test('repeated calls reuse the same browser (no relaunch)', async () => {
    const t0 = Date.now()
    await browserRun({ text: 'a', font: '16px sans-serif', width: 100, lineHeight: 20 })
    const firstCall = Date.now() - t0
    const t1 = Date.now()
    await browserRun({ text: 'b', font: '16px sans-serif', width: 100, lineHeight: 20 })
    const secondCall = Date.now() - t1
    // Rough sanity: second call should be much faster than first (no launch cost).
    // Allow generous margin for CI flakiness.
    expect(secondCall).toBeLessThan(Math.max(200, firstCall / 2))
  }, 30_000)
})
