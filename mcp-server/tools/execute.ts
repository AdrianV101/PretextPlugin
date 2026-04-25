// pretext_run and pretext_measure tool implementations.

import { loadPretext } from '../version.js'
import { browserRun, browserMeasure } from '../browser.js'
import type { BrowserType } from '../browser-pool.js'

const PROJECT_DIR = process.cwd()

export type RunInput = {
  text: string
  font: string
  width: number
  lineHeight: number
  whiteSpace?: 'normal' | 'pre-wrap'
  locale?: string
  rich?: boolean
  mode?: 'structural' | 'accurate'
  browser?: BrowserType
}

export type RunOutput = {
  lineCount: number
  height: number
  lines?: Array<{ text: string; width: number }>
}

export async function handleRun(input: RunInput): Promise<RunOutput> {
  if (input.mode === 'accurate') {
    return browserRun(input)
  }
  const pretext = await loadPretext(PROJECT_DIR)

  // Always set locale to prevent leaking state between invocations
  pretext.setLocale(input.locale)

  const options = input.whiteSpace ? { whiteSpace: input.whiteSpace } : undefined

  if (input.rich) {
    const prepared = pretext.prepareWithSegments(input.text, input.font, options)
    const result = pretext.layoutWithLines(prepared, input.width, input.lineHeight)
    return {
      lineCount: result.lineCount,
      height: result.height,
      lines: result.lines.map((line) => ({
        text: line.text,
        width: line.width,
      })),
    }
  }

  const prepared = pretext.prepare(input.text, input.font, options)
  const result = pretext.layout(prepared, input.width, input.lineHeight)
  return { lineCount: result.lineCount, height: result.height }
}

export type MeasureInput = {
  text: string
  font: string
  whiteSpace?: 'normal' | 'pre-wrap'
  locale?: string
  mode?: 'structural' | 'accurate'
  browser?: BrowserType
}

export type SegmentInfo = {
  text: string
  width: number
  kind: string
}

export type MeasureOutput = {
  segments: SegmentInfo[]
  totalWidth: number
  error?: string
}

export async function handleMeasure(input: MeasureInput): Promise<MeasureOutput> {
  if (input.mode === 'accurate') {
    return browserMeasure(input)
  }
  const pretext = await loadPretext(PROJECT_DIR)

  // Always set locale to prevent leaking state between invocations
  pretext.setLocale(input.locale)

  const options = input.whiteSpace ? { whiteSpace: input.whiteSpace } : undefined
  const prepared = pretext.prepareWithSegments(input.text, input.font, options)

  const segments: SegmentInfo[] = []
  let totalWidth = 0

  if (!prepared.segments || !prepared.widths || !prepared.kinds) {
    return {
      segments: [],
      totalWidth: 0,
      error: 'PreparedTextWithSegments internals not accessible — pretext version may be incompatible',
    }
  }

  for (let i = 0; i < prepared.segments.length; i++) {
    const width = prepared.widths[i] ?? 0
    segments.push({
      text: prepared.segments[i] ?? '',
      width,
      kind: prepared.kinds[i] ?? 'text',
    })
    totalWidth += width
  }

  return { segments, totalWidth }
}
