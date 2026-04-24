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
  text: string
  font: string
  width: number
  lineHeight: number
  whiteSpace?: 'normal' | 'pre-wrap'
  locale?: string
  rich?: boolean
}

type InPageMeasureArgs = {
  kind: 'measure'
  text: string
  font: string
  whiteSpace?: 'normal' | 'pre-wrap'
  locale?: string
}

function inPageFn(args: InPageRunArgs | InPageMeasureArgs): unknown {
  const p = (globalThis as any).__pretext
  p.setLocale(args.locale)
  const opts = args.whiteSpace ? { whiteSpace: args.whiteSpace } : undefined
  if (args.kind === 'run') {
    if (args.rich) {
      const prep = p.prepareWithSegments(args.text, args.font, opts)
      const r = p.layoutWithLines(prep, args.width, args.lineHeight)
      return {
        lineCount: r.lineCount,
        height: r.height,
        lines: r.lines.map((l: { text: string; width: number }) => ({ text: l.text, width: l.width })),
      }
    }
    const prep = p.prepare(args.text, args.font, opts)
    const r = p.layout(prep, args.width, args.lineHeight)
    return { lineCount: r.lineCount, height: r.height }
  }
  const prep = p.prepareWithSegments(args.text, args.font, opts)
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
    font: input.font,
    width: input.width,
    lineHeight: input.lineHeight,
    whiteSpace: input.whiteSpace,
    locale: input.locale,
    rich: input.rich,
  }
  return (await page.evaluate(inPageFn as any, args)) as RunOutput
}

export async function browserMeasure(input: MeasureInput): Promise<MeasureOutput> {
  const type: BrowserType = input.browser ?? 'chromium'
  const page = await getPool().getPage(type)
  const args: InPageMeasureArgs = {
    kind: 'measure',
    text: input.text,
    font: input.font,
    whiteSpace: input.whiteSpace,
    locale: input.locale,
  }
  return (await page.evaluate(inPageFn as any, args)) as MeasureOutput
}
