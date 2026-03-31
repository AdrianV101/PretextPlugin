// Version detection and pretext module loading.
// Prefers user's installed @chenglou/pretext, falls back to bundled v0.0.3.

import { installCanvasShim } from './canvas-shim.js'
import { resolve, join } from 'path'
import { existsSync, readFileSync } from 'fs'

const BUNDLED_VERSION = '0.0.3'
const PLUGIN_ROOT = import.meta.dir.replace(/\/mcp-server$/, '')
const BUNDLED_PATH = join(PLUGIN_ROOT, 'pretext-bundled', 'layout.js')

export type PretextLocation = {
  path: string
  version: string
  source: 'user' | 'bundled'
  warning?: string
}

export type PretextModule = {
  prepare: (text: string, font: string, options?: { whiteSpace?: 'normal' | 'pre-wrap' }) => any
  prepareWithSegments: (text: string, font: string, options?: { whiteSpace?: 'normal' | 'pre-wrap' }) => any
  layout: (prepared: any, maxWidth: number, lineHeight: number) => { lineCount: number; height: number }
  layoutWithLines: (prepared: any, maxWidth: number, lineHeight: number) => { lineCount: number; height: number; lines: any[] }
  walkLineRanges: (prepared: any, maxWidth: number, onLine: (line: any) => void) => number
  layoutNextLine: (prepared: any, start: any, maxWidth: number) => any | null
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
