import { describe, test, expect, beforeAll } from 'bun:test'
import { installCanvasShim } from './canvas-shim.js'

beforeAll(() => {
  installCanvasShim()
})

describe('end-to-end integration', () => {
  test('full pipeline: prepare, layout, and measure the same text', async () => {
    const { handleRun, handleMeasure } = await import('./tools/execute.js')

    const text = 'Hello world, this is a test of the pretext layout engine.'
    const font = '16px sans-serif'

    // Run basic layout
    const basic = await handleRun({ text, font, width: 200, lineHeight: 20 })
    expect(basic.lineCount).toBeGreaterThan(0)
    expect(basic.height).toBe(basic.lineCount * 20)

    // Run rich layout
    const rich = await handleRun({ text, font, width: 200, lineHeight: 20, rich: true })
    expect(rich.lineCount).toBe(basic.lineCount)
    expect(rich.lines).toBeDefined()
    expect(rich.lines!.length).toBe(rich.lineCount)

    // Measure segments
    const measured = await handleMeasure({ text, font })
    expect(measured.segments.length).toBeGreaterThan(0)
    expect(measured.totalWidth).toBeGreaterThan(0)
  })

  test('validate catches issues and passes clean code', async () => {
    const { handleValidate } = await import('./tools/validate.js')

    // Bad code
    const bad = handleValidate({
      code: `layout(prepare(text, "16px system-ui"), width, 20)`,
    })
    expect(bad.issues.length).toBeGreaterThanOrEqual(2) // system-ui + inlined-prepare

    // Good code
    const good = handleValidate({
      code: `
        const prepared = prepare(text, "16px Inter")
        const { height } = layout(prepared, containerWidth, 20)
      `,
    })
    expect(good.issues.length).toBe(0)
  })

  test('explain returns knowledge for common queries', async () => {
    const { handleExplain } = await import('./tools/knowledge.js')

    const apiResult = await handleExplain({ query: 'prepare layout API' })
    expect(apiResult.content.length).toBeGreaterThan(100)

    const scriptResult = await handleExplain({ query: 'CJK kinsoku' })
    expect(scriptResult.content.length).toBeGreaterThan(50)
  })

  test('source returns pretext module code', async () => {
    const { handleSource } = await import('./tools/knowledge.js')

    const layout = await handleSource({ module: 'layout' })
    expect(layout.source).toContain('export function prepare')
    expect(layout.error).toBeUndefined()

    const bad = await handleSource({ module: 'nonexistent' })
    expect(bad.error).toBeDefined()
  })

  test('pre-wrap mode handles multiline text correctly', async () => {
    const { handleRun } = await import('./tools/execute.js')

    const result = await handleRun({
      text: 'line1\nline2\nline3',
      font: '16px sans-serif',
      width: 1000,
      lineHeight: 20,
      whiteSpace: 'pre-wrap',
    })
    expect(result.lineCount).toBe(3)
    expect(result.height).toBe(60)
  })

  test('CJK text wraps at character boundaries', async () => {
    const { handleRun } = await import('./tools/execute.js')

    // Very narrow width should force per-character wrapping
    const result = await handleRun({
      text: '世界你好测试',
      font: '16px sans-serif',
      width: 20, // narrower than 2 CJK chars at 16px
      lineHeight: 20,
    })
    expect(result.lineCount).toBeGreaterThan(1)
  })
})
