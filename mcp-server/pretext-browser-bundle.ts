// Serves pretext-bundled/*.js to a Playwright page via route interception.
// The browser's module resolver handles relative imports (./bidi.js etc.)
// against the same fake origin, so the single route handler covers all 5 files.

import { readFile } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Page, Route } from 'playwright'

export const PRETEXT_ORIGIN = 'https://pretext.local'
const PRETEXT_HOST_PATTERN = '**/pretext.local/**'

const ALLOWED_MODULES = new Set([
  'layout.js',
  'analysis.js',
  'bidi.js',
  'line-break.js',
  'measurement.js',
])

const __dirname = dirname(fileURLToPath(import.meta.url))
const DEFAULT_BUNDLED_DIR = resolve(__dirname, '..', 'pretext-bundled')
let bundledDir = DEFAULT_BUNDLED_DIR

const fileCache = new Map<string, string>()

export function clearBundleCache(): void {
  fileCache.clear()
}

export function __setBundledDirForTesting(dir: string): void {
  bundledDir = dir
  fileCache.clear()
}

export function __resetBundledDirForTesting(): void {
  bundledDir = DEFAULT_BUNDLED_DIR
  fileCache.clear()
}

type ModuleResult =
  | { ok: true; body: string }
  | { ok: false; reason: 'denied' }
  | { ok: false; reason: 'read_failed'; error: Error }

async function getModuleSource(filename: string): Promise<ModuleResult> {
  if (!ALLOWED_MODULES.has(filename)) return { ok: false, reason: 'denied' }
  const cached = fileCache.get(filename)
  if (cached !== undefined) return { ok: true, body: cached }
  try {
    const body = await readFile(resolve(bundledDir, filename), 'utf-8')
    fileCache.set(filename, body)
    return { ok: true, body }
  } catch (err) {
    return { ok: false, reason: 'read_failed', error: err as Error }
  }
}

export async function registerPretextRoute(page: Page): Promise<void> {
  await page.route(PRETEXT_HOST_PATTERN, async (route: Route) => {
    try {
      const url = new URL(route.request().url())
      const filename = url.pathname.replace(/^\//, '')
      const result = await getModuleSource(filename)
      if (result.ok) {
        await route.fulfill({
          status: 200,
          contentType: 'application/javascript',
          body: result.body,
        })
        return
      }
      if (result.reason === 'denied') {
        await route.abort()
        return
      }
      // Surface fs errors as a 500 so the in-page import rejects with the real
      // cause rather than the page hanging until waitForFunction times out.
      await route.fulfill({
        status: 500,
        contentType: 'text/plain',
        body: `pretext bundle: failed to read ${filename} from ${bundledDir}: ${result.error.message}`,
      })
    } catch (err) {
      // Page closed mid-request, or fulfill/abort itself rejected. Nothing
      // useful to recover; log so the failure isn't fully invisible.
      process.stderr.write(`pretext route handler: ${(err as Error).message}\n`)
    }
  })
}
