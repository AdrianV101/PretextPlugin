// Version detection and pretext module loading.
// Prefers user's installed @chenglou/pretext, falls back to bundled v0.0.3.

import { installCanvasShim } from './canvas-shim.js'
import { resolve, join } from 'path'
import { existsSync, readFileSync } from 'fs'

const BUNDLED_VERSION = '0.0.3'
const PLUGIN_ROOT = resolve(import.meta.dir, '..')
const BUNDLED_PATH = join(PLUGIN_ROOT, 'pretext-bundled', 'layout.js')

// Types mirroring pretext's public API surface (layout.d.ts).
// Defined locally because pretext is loaded dynamically at runtime.

declare const preparedBrand: unique symbol

/** Opaque prepared text — treat as black-box input to layout functions. */
export type PreparedText = { readonly [preparedBrand]: true }

/** Prepared text with exposed segment data for measurement analysis. */
export type PreparedTextWithSegments = PreparedText & {
  segments: string[]
  widths: number[]
  kinds: string[]
}

export type PrepareOptions = { whiteSpace?: 'normal' | 'pre-wrap' }
export type LayoutCursor = { segmentIndex: number; graphemeIndex: number }
export type LayoutResult = { lineCount: number; height: number }
export type LayoutLine = { text: string; width: number; start: LayoutCursor; end: LayoutCursor }
export type LayoutLineRange = { width: number; start: LayoutCursor; end: LayoutCursor }
export type LayoutLinesResult = LayoutResult & { lines: LayoutLine[] }

export type PretextLocation = {
  path: string
  version: string
  source: 'user' | 'bundled'
  warning?: string
}

export type PretextModule = {
  prepare: (text: string, font: string, options?: PrepareOptions) => PreparedText
  prepareWithSegments: (text: string, font: string, options?: PrepareOptions) => PreparedTextWithSegments
  layout: (prepared: PreparedText, maxWidth: number, lineHeight: number) => LayoutResult
  layoutWithLines: (prepared: PreparedTextWithSegments, maxWidth: number, lineHeight: number) => LayoutLinesResult
  walkLineRanges: (prepared: PreparedTextWithSegments, maxWidth: number, onLine: (line: LayoutLineRange) => void) => number
  layoutNextLine: (prepared: PreparedTextWithSegments, start: LayoutCursor, maxWidth: number) => LayoutLine | null
  clearCache: () => void
  setLocale: (locale?: string) => void
}

function findUserInstallation(projectDir: string): string | null {
  // Walk up from projectDir looking for node_modules/@chenglou/pretext
  let dir = resolve(projectDir)
  for (let i = 0; i < 10; i++) {
    const candidate = join(dir, 'node_modules', '@chenglou', 'pretext', 'dist', 'layout.js')
    if (existsSync(candidate)) return candidate
    const pkgJson = join(dir, 'node_modules', '@chenglou', 'pretext', 'package.json')
    if (existsSync(pkgJson)) {
      // Found package but maybe different structure
      try {
        const pkg = JSON.parse(readFileSync(pkgJson, 'utf-8'))
        const main = pkg.main || 'dist/layout.js'
        const resolved = join(dir, 'node_modules', '@chenglou', 'pretext', main)
        if (existsSync(resolved)) return resolved
      } catch {
        // Fall through
      }
    }
    const parent = resolve(dir, '..')
    if (parent === dir) break
    dir = parent
  }
  return null
}

function readVersionFromPackageJson(modulePath: string): string {
  const pkgPath = modulePath.replace(/\/dist\/layout\.js$/, '/package.json')
  try {
    if (existsSync(pkgPath)) {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
      return pkg.version || 'unknown'
    }
  } catch {
    // Fall through
  }
  return 'unknown'
}

export async function locatePretext(projectDir: string): Promise<PretextLocation> {
  const userPath = findUserInstallation(projectDir)
  if (userPath) {
    const version = readVersionFromPackageJson(userPath)
    const warning = version !== BUNDLED_VERSION
      ? `User has pretext v${version}, plugin was built for v${BUNDLED_VERSION}. Behavior may differ.`
      : undefined
    return { path: userPath, version, source: 'user', warning }
  }
  return { path: BUNDLED_PATH, version: BUNDLED_VERSION, source: 'bundled' }
}

let cachedModule: PretextModule | null = null
let cachedProjectDir: string | null = null

export async function loadPretext(projectDir: string): Promise<PretextModule> {
  if (cachedModule && cachedProjectDir === projectDir) return cachedModule

  // Ensure shim is installed before importing pretext
  installCanvasShim()

  const location = await locatePretext(projectDir)
  const mod = await import(location.path)

  cachedModule = {
    prepare: mod.prepare,
    prepareWithSegments: mod.prepareWithSegments,
    layout: mod.layout,
    layoutWithLines: mod.layoutWithLines,
    walkLineRanges: mod.walkLineRanges,
    layoutNextLine: mod.layoutNextLine,
    clearCache: mod.clearCache,
    setLocale: mod.setLocale,
  }
  cachedProjectDir = projectDir

  return cachedModule
}
