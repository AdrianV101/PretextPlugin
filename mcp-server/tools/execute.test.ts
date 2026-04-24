import { describe, test, expect, beforeAll, mock, beforeEach, afterEach } from 'bun:test'
import { installCanvasShim } from '../canvas-shim.js'
import { handleRun, handleMeasure } from './execute.js'
import { __setPoolForTesting, __resetPoolForTesting } from '../browser.js'

beforeAll(() => {
  installCanvasShim()
})

describe('pretext_run', () => {
  test('returns lineCount and height for simple text', async () => {
    const { handleRun } = await import('./execute.js')
    const result = await handleRun({
      text: 'hello world',
      font: '16px sans-serif',
      width: 1000,
      lineHeight: 20,
    })
    expect(result.lineCount).toBe(1)
    expect(result.height).toBe(20)
  })

  test('wraps text when width is narrow', async () => {
    const { handleRun } = await import('./execute.js')
    const result = await handleRun({
      text: 'hello world this is a test',
      font: '16px sans-serif',
      width: 50,
      lineHeight: 20,
    })
    expect(result.lineCount).toBeGreaterThan(1)
    expect(result.height).toBe(result.lineCount * 20)
  })

  test('returns rich output with lines when rich=true', async () => {
    const { handleRun } = await import('./execute.js')
    const result = await handleRun({
      text: 'hello world',
      font: '16px sans-serif',
      width: 1000,
      lineHeight: 20,
      rich: true,
    })
    expect(result.lines).toBeDefined()
    expect(result.lines!.length).toBe(1)
    expect(result.lines![0]!.text).toBe('hello world')
    expect(typeof result.lines![0]!.width).toBe('number')
  })

  test('handles pre-wrap mode', async () => {
    const { handleRun } = await import('./execute.js')
    const result = await handleRun({
      text: 'line1\nline2\nline3',
      font: '16px sans-serif',
      width: 1000,
      lineHeight: 20,
      whiteSpace: 'pre-wrap',
    })
    expect(result.lineCount).toBe(3)
  })
})

describe('pretext_measure', () => {
  test('returns segment breakdown', async () => {
    const { handleMeasure } = await import('./execute.js')
    const result = await handleMeasure({
      text: 'hello world',
      font: '16px sans-serif',
    })
    expect(result.segments).toBeDefined()
    expect(result.segments.length).toBeGreaterThan(0)
    expect(typeof result.segments[0]!.text).toBe('string')
    expect(typeof result.segments[0]!.width).toBe('number')
    expect(typeof result.segments[0]!.kind).toBe('string')
  })

  test('totalWidth equals sum of segment widths', async () => {
    const { handleMeasure } = await import('./execute.js')
    const result = await handleMeasure({
      text: 'hello world',
      font: '16px sans-serif',
    })
    const sum = result.segments.reduce((acc, seg) => acc + seg.width, 0)
    expect(result.totalWidth).toBeCloseTo(sum, 5)
  })

  test('handles locale parameter without error', async () => {
    const { handleMeasure } = await import('./execute.js')
    const result = await handleMeasure({
      text: 'some text',
      font: '16px sans-serif',
      locale: 'th',
    })
    expect(result.segments.length).toBeGreaterThan(0)
    expect(result.error).toBeUndefined()
  })
})

describe('pretext_run edge cases', () => {
  test('handles empty string', async () => {
    const { handleRun } = await import('./execute.js')
    const result = await handleRun({
      text: '',
      font: '16px sans-serif',
      width: 200,
      lineHeight: 20,
    })
    expect(typeof result.lineCount).toBe('number')
    expect(result.height).toBe(result.lineCount * 20)
  })

  test('handles locale parameter without error', async () => {
    const { handleRun } = await import('./execute.js')
    const result = await handleRun({
      text: 'some text',
      font: '16px sans-serif',
      width: 200,
      lineHeight: 20,
      locale: 'ja',
    })
    expect(result.lineCount).toBeGreaterThanOrEqual(1)
  })
})

describe('handleRun mode dispatch', () => {
  beforeEach(() => __resetPoolForTesting())
  afterEach(() => __resetPoolForTesting())

  test("mode='structural' runs through loadPretext (unchanged path)", async () => {
    const getPage = mock(async () => { throw new Error('pool should not be touched') })
    __setPoolForTesting({ getPage, close: async () => {} } as any)
    const out = await handleRun({
      text: 'hello',
      font: '16px sans-serif',
      width: 200,
      lineHeight: 20,
      mode: 'structural',
    })
    expect(out.lineCount).toBeGreaterThanOrEqual(1)
    expect(out.height).toBeGreaterThan(0)
    expect(getPage).not.toHaveBeenCalled()
  })

  test("mode omitted defaults to structural", async () => {
    const getPage = mock(async () => { throw new Error('pool should not be touched') })
    __setPoolForTesting({ getPage, close: async () => {} } as any)
    const out = await handleRun({
      text: 'hello',
      font: '16px sans-serif',
      width: 200,
      lineHeight: 20,
    })
    expect(out.lineCount).toBeGreaterThanOrEqual(1)
    expect(getPage).not.toHaveBeenCalled()
  })

  test("mode='accurate' delegates to browserRun via the pool", async () => {
    const evaluate = mock(async () => ({ lineCount: 9, height: 180 }))
    const fakePool = {
      getPage: async () => ({ evaluate }),
      close: async () => {},
    }
    __setPoolForTesting(fakePool as any)
    const out = await handleRun({
      text: 'x',
      font: '16px sans-serif',
      width: 100,
      lineHeight: 20,
      mode: 'accurate',
    })
    expect(out.lineCount).toBe(9)
    expect(out.height).toBe(180)
    expect(evaluate).toHaveBeenCalledTimes(1)
  })
})

describe('handleMeasure mode dispatch', () => {
  beforeEach(() => __resetPoolForTesting())
  afterEach(() => __resetPoolForTesting())

  test("mode='accurate' delegates to browserMeasure via the pool", async () => {
    const evaluate = mock(async () => ({ segments: [{ text: 'hi', width: 7, kind: 'text' }], totalWidth: 7 }))
    const fakePool = {
      getPage: async () => ({ evaluate }),
      close: async () => {},
    }
    __setPoolForTesting(fakePool as any)
    const out = await handleMeasure({
      text: 'hi',
      font: '16px sans-serif',
      mode: 'accurate',
    })
    expect(out.totalWidth).toBe(7)
    expect(out.segments).toHaveLength(1)
  })
})
