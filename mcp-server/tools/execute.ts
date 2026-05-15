// pretext_run and pretext_measure tool implementations.

import { loadPretext, loadPretextRichInline } from '../version.js'
import type { PrepareOptions, RichInlineItem } from '../version.js'
import { browserRun, browserMeasure } from '../browser.js'
import type { BrowserType } from '../browser-pool.js'

const PROJECT_DIR = process.cwd()

type RunInputBase = {
  width: number
  lineHeight: number
  whiteSpace?: 'normal' | 'pre-wrap'
  wordBreak?: 'normal' | 'keep-all'
  letterSpacing?: number
  locale?: string
  rich?: boolean
  mode?: 'structural' | 'accurate'
  browser?: BrowserType
}

export type RunInput =
  | (RunInputBase & { text: string; font: string; richInline?: never })
  | (RunInputBase & { richInline: RichInlineItem[]; text?: never; font?: string })

/** Loose shape as parsed by the MCP Zod schema, before exclusivity narrowing. */
export type RawRunInput = RunInputBase & {
  text?: string
  richInline?: RichInlineItem[]
  font?: string
}

/**
 * System-boundary validator: the MCP input is LLM-generated, so exactly-one
 * exclusivity (and font-with-text) is enforced here, not inside handleRun.
 */
export function narrowRunInput(input: RawRunInput): RunInput {
  const { text, richInline, font, ...base } = input
  if (text !== undefined && richInline !== undefined) {
    throw new Error('pretext_run: pass either `text` or `richInline`, not both.')
  }
  if (richInline !== undefined) {
    return { ...base, richInline }
  }
  if (text === undefined) {
    throw new Error('pretext_run: one of `text` or `richInline` is required.')
  }
  if (font === undefined) {
    throw new Error('pretext_run: `text` requires `font`.')
  }
  return { ...base, text, font }
}

export type RunOutput = {
  lineCount: number
  height: number
  lines?: Array<{ text: string; width: number }>
}

function buildPrepareOptions(input: { whiteSpace?: 'normal' | 'pre-wrap'; wordBreak?: 'normal' | 'keep-all'; letterSpacing?: number }): PrepareOptions | undefined {
  const opts: PrepareOptions = {}
  if (input.whiteSpace) opts.whiteSpace = input.whiteSpace
  if (input.wordBreak) opts.wordBreak = input.wordBreak
  if (typeof input.letterSpacing === 'number') opts.letterSpacing = input.letterSpacing
  return Object.keys(opts).length > 0 ? opts : undefined
}

export async function handleRun(input: RunInput): Promise<RunOutput> {
  if (input.mode === 'accurate') {
    return browserRun(input)
  }

  if (input.richInline !== undefined) {
    const richInline = await loadPretextRichInline(PROJECT_DIR)
    const prepared = richInline.prepareRichInline(input.richInline)
    let lineCount = 0
    const lines: Array<{ text: string; width: number }> = []
    richInline.walkRichInlineLineRanges(prepared, input.width, (range) => {
      lineCount += 1
      const text = range.fragments.map((f) => `[item ${f.itemIndex}]`).join(' ')
      lines.push({ text, width: range.width })
    })
    return {
      lineCount,
      height: lineCount * input.lineHeight,
      lines: input.rich ? lines : undefined,
    }
  }

  const pretext = await loadPretext(PROJECT_DIR)

  // Always set locale to prevent leaking state between invocations
  pretext.setLocale(input.locale)

  const options = buildPrepareOptions(input)

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
  wordBreak?: 'normal' | 'keep-all'
  letterSpacing?: number
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

  const options = buildPrepareOptions(input)
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
