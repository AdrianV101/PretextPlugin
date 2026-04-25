// Browser-accurate mode. Runs pretext in a real headless browser via Playwright.
// See browser-pool.ts for lifecycle; pretext-browser-bundle.ts for how pretext
// gets into the page.
//
// Public API:
//   browserRun(input)     — mirror of handleRun for mode='accurate'
//   browserMeasure(input) — mirror of handleMeasure for mode='accurate'
// Both return the same shape as their structural counterparts.

import { BrowserPool, type BrowserType } from './browser-pool.js'
import type { RunInput, RunOutput, MeasureInput, MeasureOutput } from './tools/execute.js'
import type { RichInlineItem } from './version.js'

let pool: BrowserPool | null = null
let signalsWired = false

function getPool(): BrowserPool {
  if (pool) return pool
  pool = new BrowserPool()
  if (!signalsWired) {
    signalsWired = true
    const cleanupAndExit = async () => {
      let exitCode = 0
      try {
        await pool?.close()
      } catch (err) {
        process.stderr.write(`pretext MCP: cleanup on shutdown failed: ${(err as Error).message}\n`)
        exitCode = 1
      }
      process.exit(exitCode)
    }
    process.on('SIGINT', cleanupAndExit)
    process.on('SIGTERM', cleanupAndExit)
  }
  return pool
}

// --- test helpers ---

export function __setPoolForTesting(p: BrowserPool): void {
  pool = p
}

export function __resetPoolForTesting(): void {
  pool = null
}

// --- public API ---

type InPageRunArgs = {
  kind: 'run'
  text?: string
  richInline?: RichInlineItem[]
  font?: string
  width: number
  lineHeight: number
  whiteSpace?: 'normal' | 'pre-wrap'
  wordBreak?: 'normal' | 'keep-all'
  letterSpacing?: number
  locale?: string
  rich?: boolean
}

type InPageMeasureArgs = {
  kind: 'measure'
  text: string
  font: string
  whiteSpace?: 'normal' | 'pre-wrap'
  wordBreak?: 'normal' | 'keep-all'
  letterSpacing?: number
  locale?: string
}

function inPageFn(args: InPageRunArgs): RunOutput
function inPageFn(args: InPageMeasureArgs): MeasureOutput
function inPageFn(args: InPageRunArgs | InPageMeasureArgs): RunOutput | MeasureOutput {
  const p = (globalThis as any).__pretext
  const ri = (globalThis as any).__pretextRichInline
  p.setLocale(args.locale)
  const opts: Record<string, unknown> = {}
  if (args.whiteSpace) opts.whiteSpace = args.whiteSpace
  if (args.wordBreak) opts.wordBreak = args.wordBreak
  if (typeof args.letterSpacing === 'number') opts.letterSpacing = args.letterSpacing
  const optsArg = Object.keys(opts).length > 0 ? opts : undefined

  if (args.kind === 'run') {
    if (args.richInline) {
      const prep = ri.prepareRichInline(args.richInline)
      let lineCount = 0
      const lines: Array<{ text: string; width: number }> = []
      ri.walkRichInlineLineRanges(prep, args.width, (range: { fragments: Array<{ itemIndex: number }>; width: number }) => {
        lineCount += 1
        const text = range.fragments.map((f) => `[item ${f.itemIndex}]`).join(' ')
        lines.push({ text, width: range.width })
      })
      return {
        lineCount,
        height: lineCount * args.lineHeight,
        lines: args.rich ? lines : undefined,
      }
    }
    if (args.rich) {
      const prep = p.prepareWithSegments(args.text, args.font, optsArg)
      const r = p.layoutWithLines(prep, args.width, args.lineHeight)
      return {
        lineCount: r.lineCount,
        height: r.height,
        lines: r.lines.map((l: { text: string; width: number }) => ({ text: l.text, width: l.width })),
      }
    }
    const prep = p.prepare(args.text, args.font, optsArg)
    const r = p.layout(prep, args.width, args.lineHeight)
    return { lineCount: r.lineCount, height: r.height }
  }
  const prep = p.prepareWithSegments(args.text, args.font, optsArg)
  if (!prep.segments || !prep.widths || !prep.kinds) {
    return {
      segments: [],
      totalWidth: 0,
      error: 'PreparedTextWithSegments internals not accessible — pretext version may be incompatible',
    }
  }
  const segments = prep.segments.map((s: string, i: number) => ({
    text: s,
    width: prep.widths[i] ?? 0,
    kind: prep.kinds[i] ?? 'text',
  }))
  const totalWidth = prep.widths.reduce((a: number, b: number | undefined) => a + (b ?? 0), 0)
  return { segments, totalWidth }
}

export async function browserRun(input: RunInput): Promise<RunOutput> {
  const type: BrowserType = input.browser ?? 'chromium'
  const page = await getPool().getPage(type)
  const args: InPageRunArgs = {
    kind: 'run',
    text: input.text,
    richInline: input.richInline,
    font: input.font,
    width: input.width,
    lineHeight: input.lineHeight,
    whiteSpace: input.whiteSpace,
    wordBreak: input.wordBreak,
    letterSpacing: input.letterSpacing,
    locale: input.locale,
    rich: input.rich,
  }
  return await page.evaluate<RunOutput, InPageRunArgs>(inPageFn as (args: InPageRunArgs) => RunOutput, args)
}

export async function browserMeasure(input: MeasureInput): Promise<MeasureOutput> {
  const type: BrowserType = input.browser ?? 'chromium'
  const page = await getPool().getPage(type)
  const args: InPageMeasureArgs = {
    kind: 'measure',
    text: input.text,
    font: input.font,
    whiteSpace: input.whiteSpace,
    wordBreak: input.wordBreak,
    letterSpacing: input.letterSpacing,
    locale: input.locale,
  }
  return await page.evaluate<MeasureOutput, InPageMeasureArgs>(inPageFn as (args: InPageMeasureArgs) => MeasureOutput, args)
}
