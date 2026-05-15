import { describe, test, expect, beforeAll, mock, beforeEach, afterEach } from 'bun:test'
import { installCanvasShim } from '../canvas-shim.js'
import { handleRun, handleMeasure } from './execute.js'
import { __setPoolForTesting, __resetPoolForTesting } from '../browser.js'
import type { RunInput } from './execute.js'

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

describe('pretext_run v0.0.5+ options', () => {
  test('accepts wordBreak: keep-all option', async () => {
    const { handleRun } = await import('./execute.js')
    const result = await handleRun({
      text: 'hello world',
      font: '16px sans-serif',
      width: 1000,
      lineHeight: 20,
      wordBreak: 'keep-all',
    })
    expect(result.lineCount).toBe(1)
  })

  test('letterSpacing widens text relative to no spacing', async () => {
    const { handleRun } = await import('./execute.js')
    const narrow = await handleRun({
      text: 'hello world hello world hello world',
      font: '16px sans-serif',
      width: 200,
      lineHeight: 20,
      letterSpacing: 0,
    })
    const wide = await handleRun({
      text: 'hello world hello world hello world',
      font: '16px sans-serif',
      width: 200,
      lineHeight: 20,
      letterSpacing: 5,
    })
    // Wider letterSpacing should require at least as many lines.
    expect(wide.lineCount).toBeGreaterThanOrEqual(narrow.lineCount)
  })
})

describe('pretext_run rich-inline mode', () => {
  test('accepts a richInline items array and returns sensible line counts', async () => {
    const { handleRun } = await import('./execute.js')
    const result = await handleRun({
      richInline: [
        { text: 'Hello ', font: '16px sans-serif' },
        { text: '@alice', font: '16px sans-serif', break: 'never' },
        { text: ' how are you?', font: '16px sans-serif' },
      ],
      font: '16px sans-serif',
      width: 1000,
      lineHeight: 20,
    } as any)
    expect(result.lineCount).toBe(1)
    expect(result.height).toBe(20)
  })

  test('rich: true on rich-inline path returns [item N] synthesized line text', async () => {
    const { handleRun } = await import('./execute.js')
    const result = await handleRun({
      richInline: [
        { text: 'Hi ', font: '16px sans-serif' },
        { text: '@alice', font: '16px sans-serif', break: 'never' },
        { text: ' how are you?', font: '16px sans-serif' },
      ],
      font: '16px sans-serif',
      width: 1000,
      lineHeight: 20,
      rich: true,
    } as any)
    expect(result.lines).toBeDefined()
    expect(result.lines).toHaveLength(1)
    expect(result.lines![0]!.text).toBe('[item 0] [item 1] [item 2]')
    expect(result.lines![0]!.width).toBeGreaterThan(0)
  })

  test('rich: true on rich-inline path partitions items across multiple lines', async () => {
    const { handleRun } = await import('./execute.js')
    // Narrow width forces wrapping; the per-line synthesized text should
    // mention only the items present on that line.
    const result = await handleRun({
      richInline: [
        { text: 'one two ', font: '16px sans-serif' },
        { text: '@alice', font: '16px sans-serif', break: 'never' },
        { text: ' three four five six', font: '16px sans-serif' },
      ],
      font: '16px sans-serif',
      width: 60,
      lineHeight: 20,
      rich: true,
    } as any)
    expect(result.lines).toBeDefined()
    expect(result.lineCount).toBeGreaterThan(1)
    // Every emitted line text must be a `[item N] ...` pattern only
    // referencing items 0–2; nothing else may leak in.
    for (const line of result.lines!) {
      expect(line.text).toMatch(/^(?:\[item [0-2]\])(?: \[item [0-2]\])*$/)
      expect(line.width).toBeGreaterThan(0)
    }
  })

  test('rich-inline with narrow width wraps onto multiple lines', async () => {
    const { handleRun } = await import('./execute.js')
    const result = await handleRun({
      richInline: [
        { text: 'one two three four five six seven eight nine ten', font: '16px sans-serif' },
      ],
      font: '16px sans-serif',
      width: 50,
      lineHeight: 20,
    } as any)
    expect(result.lineCount).toBeGreaterThan(1)
  })
})

describe('pretext_measure v0.0.5+ options', () => {
  test('accepts wordBreak option without error', async () => {
    const { handleMeasure } = await import('./execute.js')
    const result = await handleMeasure({
      text: '한글 테스트',
      font: '16px sans-serif',
      wordBreak: 'keep-all',
    })
    expect(result.error).toBeUndefined()
    expect(result.segments.length).toBeGreaterThan(0)
  })

  test('letterSpacing changes total width', async () => {
    const { handleMeasure } = await import('./execute.js')
    const a = await handleMeasure({
      text: 'hello',
      font: '16px sans-serif',
      letterSpacing: 0,
    })
    const b = await handleMeasure({
      text: 'hello',
      font: '16px sans-serif',
      letterSpacing: 4,
    })
    expect(b.totalWidth).toBeGreaterThan(a.totalWidth)
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

describe('narrowRunInput', () => {
  test('rejects when both text and richInline are provided', async () => {
    const { narrowRunInput } = await import('./execute.js')
    expect(() =>
      narrowRunInput({
        text: 'hi',
        richInline: [{ text: 'hi', font: '16px sans-serif' }],
        font: '16px sans-serif',
        width: 100,
        lineHeight: 20,
      }),
    ).toThrow(/either `text` or `richInline`/i)
  })

  test('rejects when neither text nor richInline is provided', async () => {
    const { narrowRunInput } = await import('./execute.js')
    expect(() =>
      narrowRunInput({ font: '16px sans-serif', width: 100, lineHeight: 20 }),
    ).toThrow(/one of `text` or `richInline`/i)
  })

  test('rejects text without font', async () => {
    const { narrowRunInput } = await import('./execute.js')
    expect(() =>
      narrowRunInput({ text: 'hi', width: 100, lineHeight: 20 }),
    ).toThrow(/`text` requires `font`/i)
  })

  test('rejects an empty richInline array instead of silently yielding 0 lines', async () => {
    const { narrowRunInput } = await import('./execute.js')
    expect(() =>
      narrowRunInput({ richInline: [], width: 100, lineHeight: 20 }),
    ).toThrow(/`richInline` must contain at least one item/i)
  })

  test('returns the text variant for valid text input', async () => {
    const { narrowRunInput } = await import('./execute.js')
    const r = narrowRunInput({ text: 'hi', font: '16px sans-serif', width: 100, lineHeight: 20 })
    expect(r.text).toBe('hi')
    expect(r.richInline).toBeUndefined()
  })

  test('returns the rich variant for valid richInline input', async () => {
    const { narrowRunInput } = await import('./execute.js')
    const r = narrowRunInput({
      richInline: [{ text: 'hi', font: '16px sans-serif' }],
      width: 100,
      lineHeight: 20,
    })
    expect(r.richInline).toBeDefined()
    expect(r.text).toBeUndefined()
  })

  test('preserves all base fields through the rest spread', async () => {
    const { narrowRunInput } = await import('./execute.js')
    const r = narrowRunInput({
      text: 'hi',
      font: 'f',
      width: 100,
      lineHeight: 20,
      mode: 'accurate',
      browser: 'chromium',
      letterSpacing: 3,
      whiteSpace: 'pre-wrap',
      wordBreak: 'keep-all',
      locale: 'ja',
      rich: true,
    })
    expect(r).toMatchObject({
      text: 'hi',
      font: 'f',
      width: 100,
      lineHeight: 20,
      mode: 'accurate',
      browser: 'chromium',
      letterSpacing: 3,
      whiteSpace: 'pre-wrap',
      wordBreak: 'keep-all',
      locale: 'ja',
      rich: true,
    })
  })

  test('rejects an invalid both-fields call site at compile time', () => {
    // @ts-expect-error - discriminated union forbids text + richInline together
    const bad = { text: 'a', richInline: [{ text: 'b', font: 'f' }], width: 1, lineHeight: 1 } satisfies RunInput
    expect(bad).toBeDefined()
  })

  test('rejects a text-without-font call site at compile time', () => {
    // @ts-expect-error - text variant of the union requires font
    const bad = { text: 'a', width: 1, lineHeight: 1 } satisfies RunInput
    expect(bad).toBeDefined()
  })
})
