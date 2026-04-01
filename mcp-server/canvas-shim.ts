// Fake OffscreenCanvas shim for structural-mode pretext execution.
// Provides deterministic width estimation without a real font engine.
// Structurally correct (line breaks happen at reasonable places) but
// numerically inaccurate (widths are heuristic, not font-based).

let measurementCount = 0

// Width multipliers relative to fontSize, by character category
const SPACE_RATIO = 0.33
const TAB_RATIO = 1.32  // 4 * SPACE_RATIO
const EMOJI_RATIO = 1.0
const WIDE_RATIO = 1.0  // CJK, Hangul, fullwidth, kana
const PUNCTUATION_RATIO = 0.4
const DEFAULT_RATIO = 0.6  // Latin, Arabic, Hebrew, etc.

function isCJK(code: number): boolean {
  // CJK Unified Ideographs
  if (code >= 0x4E00 && code <= 0x9FFF) return true
  // CJK Extension A
  if (code >= 0x3400 && code <= 0x4DBF) return true
  // CJK Extension B-G (supplementary)
  if (code >= 0x20000 && code <= 0x323AF) return true
  // CJK Compatibility Ideographs
  if (code >= 0xF900 && code <= 0xFAFF) return true
  // Hangul Syllables
  if (code >= 0xAC00 && code <= 0xD7AF) return true
  // Katakana
  if (code >= 0x30A0 && code <= 0x30FF) return true
  // Hiragana
  if (code >= 0x3040 && code <= 0x309F) return true
  // Fullwidth forms
  if (code >= 0xFF01 && code <= 0xFF60) return true
  return false
}

function isEmoji(code: number): boolean {
  // Common emoji ranges
  if (code >= 0x1F600 && code <= 0x1F64F) return true  // Emoticons
  if (code >= 0x1F300 && code <= 0x1F5FF) return true  // Misc Symbols
  if (code >= 0x1F680 && code <= 0x1F6FF) return true  // Transport
  if (code >= 0x1F900 && code <= 0x1F9FF) return true  // Supplemental
  if (code >= 0x1FA00 && code <= 0x1FA6F) return true  // Chess, extended-A
  if (code >= 0x1FA70 && code <= 0x1FAFF) return true  // Extended-A cont.
  if (code >= 0x2600 && code <= 0x26FF) return true    // Misc symbols
  if (code >= 0x2700 && code <= 0x27BF) return true    // Dingbats
  if (code === 0xFE0F || code === 0x200D) return true  // Variation selector, ZWJ
  return false
}

function isPunctuation(code: number): boolean {
  if (code >= 0x21 && code <= 0x2F) return true   // ! " # $ % & ' ( ) * + , - . /
  if (code >= 0x3A && code <= 0x40) return true   // : ; < = > ? @
  if (code >= 0x5B && code <= 0x60) return true   // [ \ ] ^ _ `
  if (code >= 0x7B && code <= 0x7E) return true   // { | } ~
  if (code >= 0x3000 && code <= 0x303F) return true // CJK punctuation
  return false
}

function parseFontSize(font: string): number {
  const match = font.match(/(\d+(?:\.\d+)?)\s*px/)
  return match ? parseFloat(match[1]!) : 16
}

function measureTextWidth(text: string, fontSize: number): number {
  let width = 0
  for (let i = 0; i < text.length; i++) {
    const code = text.codePointAt(i)!
    if (code > 0xFFFF) i++ // skip surrogate pair trail

    if (code === 0x20) {
      width += fontSize * SPACE_RATIO
    } else if (code === 0x09) {
      width += fontSize * TAB_RATIO
    } else if (isEmoji(code)) {
      width += fontSize * EMOJI_RATIO
    } else if (isCJK(code)) {
      width += fontSize * WIDE_RATIO
    } else if (isPunctuation(code)) {
      width += fontSize * PUNCTUATION_RATIO
    } else {
      width += fontSize * DEFAULT_RATIO
    }
  }
  return width
}

class FakeCanvasContext {
  private _font = '10px sans-serif'
  private _fontSize = 10

  get font(): string {
    return this._font
  }
  set font(value: string) {
    this._font = value
    this._fontSize = parseFontSize(value)
  }

  measureText(text: string): { width: number } {
    measurementCount++
    return { width: measureTextWidth(text, this._fontSize) }
  }
}

class FakeOffscreenCanvas {
  width: number
  height: number

  constructor(width: number, height: number) {
    this.width = width
    this.height = height
  }

  getContext(contextId: string): FakeCanvasContext | null {
    if (contextId === '2d') {
      return new FakeCanvasContext()
    }
    return null
  }
}

export function installCanvasShim(): void {
  if (typeof globalThis.OffscreenCanvas === 'undefined') {
    ;(globalThis as { OffscreenCanvas?: unknown }).OffscreenCanvas = FakeOffscreenCanvas
  }
}

export function getShimStats(): { measurementCount: number } {
  return { measurementCount }
}
