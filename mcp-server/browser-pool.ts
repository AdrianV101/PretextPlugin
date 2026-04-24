// BrowserPool — manages a lazy, per-type cache of Playwright browsers + pages.
// One browser per type (chromium/firefox/webkit). One reusable Page per browser,
// with the pretext route handler registered and window.__pretext available.
//
// Lifecycle:
//   - getPage(type) launches on first call for that type; returns cache thereafter.
//   - Concurrent getPage(type) calls dedupe via pagePromises — only one launch.
//   - close() closes every launched browser; idempotent; race-safe with in-flight launches.
//   - Signal handlers (SIGINT/SIGTERM) are wired by the consumer, not here.

import type { Browser, Page } from 'playwright'
import { registerPretextRoute, PRETEXT_ORIGIN } from './pretext-browser-bundle.js'

export const BROWSER_TYPES = ['chromium', 'firefox', 'webkit'] as const
export type BrowserType = typeof BROWSER_TYPES[number]

type PlaywrightModule = {
  chromium: { launch: (opts?: unknown) => Promise<Browser> }
  firefox: { launch: (opts?: unknown) => Promise<Browser> }
  webkit: { launch: (opts?: unknown) => Promise<Browser> }
}

export type BrowserPoolOptions = {
  loadPlaywright?: () => Promise<PlaywrightModule>
}

const DEFAULT_LOAD_PLAYWRIGHT = async () => {
  return (await import('playwright')) as unknown as PlaywrightModule
}

const PAGE_HTML = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head><body>
<script type="module">
  import * as p from '${PRETEXT_ORIGIN}/layout.js'
  window.__pretext = p
</script>
</body></html>`

export class BrowserPool {
  private browsers = new Map<BrowserType, Browser>()
  private pages = new Map<BrowserType, Page>()
  private pagePromises = new Map<BrowserType, Promise<Page>>()
  private closed = false
  private loadPlaywright: () => Promise<PlaywrightModule>

  constructor(opts: BrowserPoolOptions = {}) {
    this.loadPlaywright = opts.loadPlaywright ?? DEFAULT_LOAD_PLAYWRIGHT
  }

  async getPage(type: BrowserType): Promise<Page> {
    if (this.closed) throw new Error('BrowserPool is closed')

    const cached = this.pages.get(type)
    if (cached) return cached

    const inFlight = this.pagePromises.get(type)
    if (inFlight) return inFlight

    const promise = this._launchPage(type)
    this.pagePromises.set(type, promise)
    try {
      return await promise
    } catch (err) {
      this.pagePromises.delete(type)
      throw err
    }
  }

  private async _launchPage(type: BrowserType): Promise<Page> {
    let playwright: PlaywrightModule
    try {
      playwright = await this.loadPlaywright()
    } catch (err) {
      throw new Error(
        'Playwright is not installed. Install in your project:\n' +
        '  bun add playwright && bunx playwright install chromium\n' +
        `Underlying error: ${(err as Error).message}`
      )
    }

    let browser: Browser
    try {
      browser = await playwright[type].launch({ headless: true })
    } catch (err) {
      const msg = (err as Error).message
      if (msg.includes("Executable doesn't exist")) {
        throw new Error(
          `Browser binary for "${type}" is not installed. Run:\n` +
          `  bunx playwright install ${type}`
        )
      }
      throw err
    }

    // If the pool was closed while we were launching, don't leak the browser.
    if (this.closed) {
      await browser.close().catch(() => {})
      throw new Error('BrowserPool is closed')
    }

    let page: Page
    try {
      page = await browser.newPage()
      await registerPretextRoute(page)
      await page.setContent(PAGE_HTML)
      await page.waitForFunction(() => (globalThis as any).__pretext !== undefined, null, { timeout: 5000 })
    } catch (err) {
      await browser.close().catch(() => {})
      throw err
    }

    if (this.closed) {
      await browser.close().catch(() => {})
      throw new Error('BrowserPool is closed')
    }

    this.browsers.set(type, browser)
    this.pages.set(type, page)
    return page
  }

  async close(): Promise<void> {
    if (this.closed) return
    this.closed = true
    const all = Array.from(this.browsers.values())
    this.browsers.clear()
    this.pages.clear()
    this.pagePromises.clear()
    await Promise.all(all.map(async (b) => {
      try { await b.close() } catch { /* best effort */ }
    }))
  }
}
