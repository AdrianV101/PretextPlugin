import { describe, test, expect, beforeAll } from 'bun:test'
import { installCanvasShim } from '../canvas-shim.js'

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
})
