import { describe, test, expect, mock, beforeEach } from 'bun:test'
import { browserRun, browserMeasure, __setPoolForTesting, __resetPoolForTesting } from './browser.js'

function makeFakePool(evaluateImpl: (fn: Function, args: unknown) => unknown) {
  const evaluate = mock(async (fn: Function, args: unknown) => evaluateImpl(fn, args))
  const page = { evaluate }
  return {
    getPage: mock(async (_type: string) => page),
    close: mock(async () => {}),
    _evaluate: evaluate,
  }
}

describe('browserRun', () => {
  beforeEach(() => __resetPoolForTesting())

  test('delegates to pool.getPage with the requested browser type', async () => {
    const pool = makeFakePool(() => ({ lineCount: 2, height: 40 }))
    __setPoolForTesting(pool as any)
    await browserRun({
      text: 'hello world',
      font: '16px sans-serif',
      width: 100,
      lineHeight: 20,
      browser: 'firefox',
    })
    expect(pool.getPage).toHaveBeenCalledWith('firefox')
  })

  test('defaults to chromium when browser unspecified', async () => {
    const pool = makeFakePool(() => ({ lineCount: 1, height: 20 }))
    __setPoolForTesting(pool as any)
    await browserRun({
      text: 'hi',
      font: '16px sans-serif',
      width: 100,
      lineHeight: 20,
    })
    expect(pool.getPage).toHaveBeenCalledWith('chromium')
  })

  test('returns the evaluate result unchanged for non-rich', async () => {
    const pool = makeFakePool(() => ({ lineCount: 3, height: 60 }))
    __setPoolForTesting(pool as any)
    const result = await browserRun({
      text: 'abc def ghi',
      font: '16px sans-serif',
      width: 30,
      lineHeight: 20,
    })
    expect(result).toEqual({ lineCount: 3, height: 60 })
  })

  test('returns lines array when rich=true', async () => {
    const pool = makeFakePool(() => ({
      lineCount: 2,
      height: 40,
      lines: [{ text: 'abc', width: 15 }, { text: 'def', width: 15 }],
    }))
    __setPoolForTesting(pool as any)
    const result = await browserRun({
      text: 'abc def',
      font: '16px sans-serif',
      width: 20,
      lineHeight: 20,
      rich: true,
    })
    expect(result.lines).toEqual([{ text: 'abc', width: 15 }, { text: 'def', width: 15 }])
  })

  test('wraps page.evaluate errors as structured errors', async () => {
    const pool = makeFakePool(() => { throw new Error('pretext blew up') })
    __setPoolForTesting(pool as any)
    await expect(browserRun({
      text: 'x',
      font: '16px sans-serif',
      width: 10,
      lineHeight: 10,
    })).rejects.toThrow(/pretext blew up/)
  })
})

describe('browserMeasure', () => {
  beforeEach(() => __resetPoolForTesting())

  test('returns segments and totalWidth from evaluate', async () => {
    const pool = makeFakePool(() => ({
      segments: [{ text: 'hi', width: 10, kind: 'text' }],
      totalWidth: 10,
    }))
    __setPoolForTesting(pool as any)
    const result = await browserMeasure({
      text: 'hi',
      font: '16px sans-serif',
    })
    expect(result.segments).toHaveLength(1)
    expect(result.totalWidth).toBe(10)
  })

  test('propagates an error field from evaluate when pretext internals are inaccessible', async () => {
    const pool = makeFakePool(() => ({
      segments: [],
      totalWidth: 0,
      error: 'PreparedTextWithSegments internals not accessible',
    }))
    __setPoolForTesting(pool as any)
    const result = await browserMeasure({
      text: 'hi',
      font: '16px sans-serif',
    })
    expect(result.error).toMatch(/internals not accessible/)
  })
})
