// Browser-accurate mode using Playwright.
// This module provides accurate text measurement via a real browser engine.
// It is opt-in and requires Playwright + a browser to be installed.
//
// Usage: The pretext_run and pretext_measure tools accept a `mode: 'accurate'`
// parameter that routes through this module instead of the canvas shim.
//
// Implementation: Launches a headless browser, loads a minimal HTML page with
// pretext, and executes measurements in the real browser environment.

export type BrowserOptions = {
  browser?: 'chromium' | 'firefox' | 'webkit'
}

export type BrowserMeasureResult = {
  lineCount: number
  height: number
  lines?: Array<{ text: string; width: number }>
}

let playwrightAvailable: boolean | null = null

export async function isPlaywrightAvailable(): Promise<boolean> {
  if (playwrightAvailable !== null) return playwrightAvailable
  try {
    await import('playwright')
    playwrightAvailable = true
  } catch {
    playwrightAvailable = false
  }
  return playwrightAvailable
}

export async function browserRun(
  text: string,
  font: string,
  width: number,
  lineHeight: number,
  options?: BrowserOptions & { whiteSpace?: 'normal' | 'pre-wrap'; rich?: boolean },
): Promise<BrowserMeasureResult> {
  const available = await isPlaywrightAvailable()
  if (!available) {
    throw new Error(
      'Playwright is not installed. Install with: bunx playwright install chromium\n' +
      'Accurate mode requires a real browser for font-accurate measurements.'
    )
  }

  // Full Playwright implementation deferred to follow-up plan.
  // When implemented, this will:
  // 1. Launch a headless browser (lazy, cached between calls)
  // 2. Navigate to a minimal HTML page that loads pretext
  // 3. Call prepare() + layout()/layoutWithLines() in the browser context
  // 4. Return the results

  throw new Error('Accurate mode not yet implemented. Use structural mode (default).')
}
