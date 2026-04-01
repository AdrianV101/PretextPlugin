// pretext_run and pretext_measure tool implementations.

import { loadPretext } from '../version.js'

const PROJECT_DIR = process.cwd()

export type RunInput = {
  text: string
  font: string
  width: number
  lineHeight: number
  whiteSpace?: 'normal' | 'pre-wrap'
  locale?: string
  rich?: boolean
}

export type RunOutput = {
  lineCount: number
  height: number
  lines?: Array<{ text: string; width: number }>
}

export async function handleRun(input: RunInput): Promise<RunOutput> {
  const pretext = await loadPretext(PROJECT_DIR)

  if (input.locale) pretext.setLocale(input.locale)

  const options = input.whiteSpace ? { whiteSpace: input.whiteSpace } : undefined

  if (input.rich) {
    const prepared = pretext.prepareWithSegments(input.text, input.font, options)
    const result = pretext.layoutWithLines(prepared, input.width, input.lineHeight)
    return {
      lineCount: result.lineCount,
      height: result.height,
      lines: result.lines.map((line: any) => ({
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
  const pretext = await loadPretext(PROJECT_DIR)

  if (input.locale) pretext.setLocale(input.locale)

  const options = input.whiteSpace ? { whiteSpace: input.whiteSpace } : undefined
  const prepared = pretext.prepareWithSegments(input.text, input.font, options)

  // Access internal parallel arrays to extract segment info
  // PreparedTextWithSegments exposes segments: string[]
  const internal = prepared as any
  const segments: SegmentInfo[] = []
  let totalWidth = 0

  if (!internal.segments || !internal.widths || !internal.kinds) {
    return {
      segments: [],
      totalWidth: 0,
      error: 'PreparedTextWithSegments internals not accessible — pretext version may be incompatible',
    }
  }

  for (let i = 0; i < internal.segments.length; i++) {
    const width = internal.widths[i] ?? 0
    segments.push({
      text: internal.segments[i] ?? '',
      width,
      kind: internal.kinds[i] ?? 'text',
    })
    totalWidth += width
  }

  return { segments, totalWidth }
}
