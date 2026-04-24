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
const BUNDLED_DIR = resolve(__dirname, '..', 'pretext-bundled')

const fileCache = new Map<string, string>()

export function clearBundleCache(): void {
  fileCache.clear()
}

async function getModuleSource(filename: string): Promise<string | null> {
  if (!ALLOWED_MODULES.has(filename)) return null
  const cached = fileCache.get(filename)
  if (cached !== undefined) return cached
  try {
    const body = await readFile(resolve(BUNDLED_DIR, filename), 'utf-8')
    fileCache.set(filename, body)
    return body
  } catch {
    return null
  }
}

export async function registerPretextRoute(page: Page): Promise<void> {
  await page.route(PRETEXT_HOST_PATTERN, async (route: Route) => {
    const url = new URL(route.request().url())
    const filename = url.pathname.replace(/^\//, '')
    const source = await getModuleSource(filename)
    if (source === null) {
      await route.abort()
      return
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: source,
    })
  })
}
