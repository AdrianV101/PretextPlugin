// Version detection and pretext module loading.
// Prefers user's installed @chenglou/pretext, falls back to bundled v0.0.6.

import { installCanvasShim } from './canvas-shim.js'
import { resolve, join } from 'path'
import { existsSync, readFileSync } from 'fs'

const BUNDLED_VERSION = '0.0.6'
const PLUGIN_ROOT = resolve(import.meta.dir, '..')
const BUNDLED_PATH = join(PLUGIN_ROOT, 'pretext-bundled', 'layout.js')
const BUNDLED_RICH_INLINE_PATH = join(PLUGIN_ROOT, 'pretext-bundled', 'rich-inline.js')

// Types mirroring pretext's public API surface (layout.d.ts, rich-inline.d.ts).
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

export type PrepareOptions = {
  whiteSpace?: 'normal' | 'pre-wrap'
  wordBreak?: 'normal' | 'keep-all'
  letterSpacing?: number
}
export type LayoutCursor = { segmentIndex: number; graphemeIndex: number }
export type LayoutResult = { lineCount: number; height: number }
export type LayoutLine = { text: string; width: number; start: LayoutCursor; end: LayoutCursor }
export type LayoutLineRange = { width: number; start: LayoutCursor; end: LayoutCursor }
export type LayoutLinesResult = LayoutResult & { lines: LayoutLine[] }
export type LineStats = { lineCount: number; maxLineWidth: number }

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
  // v0.0.5+ geometry helpers. Always present on the module object: loadPretext
  // wraps each via requireVersioned so an old user install throws a clear
  // versioned error instead of surfacing `undefined` and crashing with a
  // bare TypeError. Note: `typeof mod.measureLineStats === 'function'` is
  // therefore always true and is NOT an availability probe; check
  // locatePretext().version instead.
  measureLineStats: (prepared: PreparedTextWithSegments, maxWidth: number) => LineStats
  measureNaturalWidth: (prepared: PreparedTextWithSegments) => number
  layoutNextLineRange: (prepared: PreparedTextWithSegments, start: LayoutCursor, maxWidth: number) => LayoutLineRange | null
  materializeLineRange: (prepared: PreparedTextWithSegments, line: LayoutLineRange) => LayoutLine
  clearCache: () => void
  setLocale: (locale?: string) => void
}

// v0.0.5+ rich-inline module — separate sub-module at @chenglou/pretext/rich-inline.

export type RichInlineItem = {
  text: string
  font: string
  letterSpacing?: number
  break?: 'normal' | 'never'
  extraWidth?: number
}

declare const preparedRichInlineBrand: unique symbol
export type PreparedRichInline = { readonly [preparedRichInlineBrand]: true }

export type RichInlineCursor = { itemIndex: number; segmentIndex: number; graphemeIndex: number }
export type RichInlineFragment = {
  itemIndex: number
  text: string
  gapBefore: number
  occupiedWidth: number
  start: LayoutCursor
  end: LayoutCursor
}
export type RichInlineFragmentRange = {
  itemIndex: number
  gapBefore: number
  occupiedWidth: number
  start: LayoutCursor
  end: LayoutCursor
}
export type RichInlineLine = { fragments: RichInlineFragment[]; width: number; end: RichInlineCursor }
export type RichInlineLineRange = { fragments: RichInlineFragmentRange[]; width: number; end: RichInlineCursor }
export type RichInlineStats = { lineCount: number; maxLineWidth: number }

export type RichInlineModule = {
  prepareRichInline: (items: RichInlineItem[]) => PreparedRichInline
  layoutNextRichInlineLineRange: (prepared: PreparedRichInline, maxWidth: number, start?: RichInlineCursor) => RichInlineLineRange | null
  materializeRichInlineLineRange: (prepared: PreparedRichInline, line: RichInlineLineRange) => RichInlineLine
  walkRichInlineLineRanges: (prepared: PreparedRichInline, maxWidth: number, onLine: (line: RichInlineLineRange) => void) => number
  measureRichInlineStats: (prepared: PreparedRichInline, maxWidth: number) => RichInlineStats
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

export const MIN_VERSION_V05 = '0.0.5'

/**
 * Wrap a v0.0.5+ helper export. If the underlying export is absent (older user
 * install), return a function that throws a versioned error rather than caching
 * `undefined` and later crashing with a bare TypeError at the first call site.
 */
export function requireVersioned<F>(
  name: string,
  minVersion: string,
  location: PretextLocation,
  fn: unknown,
): F {
  if (typeof fn === 'function') return fn as F
  const thrower = (): never => {
    throw new Error(
      `pretext.${name} requires pretext >=${minVersion}; detected v${location.version} at ${location.path}. ` +
      `Upgrade @chenglou/pretext or rely on the plugin's bundled mode.`,
    )
  }
  return thrower as F
}

let cachedModule: PretextModule | null = null
let cachedProjectDir: string | null = null
let cachedRichInlineModule: RichInlineModule | null = null
let cachedRichInlineProjectDir: string | null = null

// Required exports for any pretext install. v0.0.5+ helpers (measureLineStats,
// measureNaturalWidth, layoutNextLineRange, materializeLineRange) are NOT in
// this list; loadPretext wraps them via requireVersioned, so an old user
// install gets a versioned error at call time instead of failing here.
const REQUIRED_PRETEXT_EXPORTS: ReadonlyArray<keyof PretextModule> = [
  'prepare',
  'prepareWithSegments',
  'layout',
  'layoutWithLines',
  'walkLineRanges',
  'layoutNextLine',
  'clearCache',
  'setLocale',
]

export async function loadPretext(projectDir: string): Promise<PretextModule> {
  if (cachedModule && cachedProjectDir === projectDir) return cachedModule

  // Ensure shim is installed before importing pretext
  installCanvasShim()

  const location = await locatePretext(projectDir)
  const mod = await import(location.path)

  for (const name of REQUIRED_PRETEXT_EXPORTS) {
    if (typeof mod[name] !== 'function') {
      throw new Error(
        `pretext module at ${location.path} is missing export '${name}'. ` +
        `The install may be corrupted or from an unsupported pretext fork.`,
      )
    }
  }

  cachedModule = {
    prepare: mod.prepare,
    prepareWithSegments: mod.prepareWithSegments,
    layout: mod.layout,
    layoutWithLines: mod.layoutWithLines,
    walkLineRanges: mod.walkLineRanges,
    layoutNextLine: mod.layoutNextLine,
    measureLineStats: requireVersioned<PretextModule['measureLineStats']>('measureLineStats', MIN_VERSION_V05, location, mod.measureLineStats),
    measureNaturalWidth: requireVersioned<PretextModule['measureNaturalWidth']>('measureNaturalWidth', MIN_VERSION_V05, location, mod.measureNaturalWidth),
    layoutNextLineRange: requireVersioned<PretextModule['layoutNextLineRange']>('layoutNextLineRange', MIN_VERSION_V05, location, mod.layoutNextLineRange),
    materializeLineRange: requireVersioned<PretextModule['materializeLineRange']>('materializeLineRange', MIN_VERSION_V05, location, mod.materializeLineRange),
    clearCache: mod.clearCache,
    setLocale: mod.setLocale,
  }
  cachedProjectDir = projectDir

  return cachedModule
}

function richInlinePathFor(layoutPath: string): string {
  // /path/to/dist/layout.js -> /path/to/dist/rich-inline.js
  return layoutPath.replace(/layout\.js$/, 'rich-inline.js')
}

export async function loadPretextRichInline(projectDir: string): Promise<RichInlineModule> {
  if (cachedRichInlineModule && cachedRichInlineProjectDir === projectDir) return cachedRichInlineModule

  installCanvasShim()

  const location = await locatePretext(projectDir)
  const richPath = location.source === 'user' ? richInlinePathFor(location.path) : BUNDLED_RICH_INLINE_PATH
  if (!existsSync(richPath)) {
    throw new Error(
      `rich-inline module not available at ${richPath}. ` +
      `It was added in pretext v0.0.5; user is on v${location.version}.`,
    )
  }
  const mod = await import(richPath)

  const required: ReadonlyArray<keyof RichInlineModule> = [
    'prepareRichInline',
    'layoutNextRichInlineLineRange',
    'materializeRichInlineLineRange',
    'walkRichInlineLineRanges',
    'measureRichInlineStats',
  ]
  for (const name of required) {
    if (typeof mod[name] !== 'function') {
      throw new Error(
        `rich-inline module at ${richPath} is missing export '${name}'. ` +
        `The install may be corrupted or from an unsupported pretext fork.`,
      )
    }
  }

  cachedRichInlineModule = {
    prepareRichInline: mod.prepareRichInline,
    layoutNextRichInlineLineRange: mod.layoutNextRichInlineLineRange,
    materializeRichInlineLineRange: mod.materializeRichInlineLineRange,
    walkRichInlineLineRanges: mod.walkRichInlineLineRanges,
    measureRichInlineStats: mod.measureRichInlineStats,
  }
  cachedRichInlineProjectDir = projectDir

  return cachedRichInlineModule
}
