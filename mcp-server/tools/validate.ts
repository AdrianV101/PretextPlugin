// pretext_validate — static analysis of user code for common pretext anti-patterns.

export type ValidateInput = {
  code: string
}

export type ValidationIssue = {
  pattern: string
  severity: 'error' | 'warning' | 'info'
  explanation: string
  fix: string
}

export type ValidateOutput = {
  issues: ValidationIssue[]
}

type PatternCheck = {
  pattern: string
  severity: 'error' | 'warning' | 'info'
  test: (code: string) => boolean
  explanation: string
  fix: string
}

const checks: PatternCheck[] = [
  {
    pattern: 'system-ui-font',
    severity: 'warning',
    test: (code) => /system-ui/i.test(code),
    explanation:
      'system-ui font resolves differently in canvas vs DOM on macOS, causing systematic measurement mismatches.',
    fix: 'Use a named font: "16px Inter", "16px Helvetica", "16px -apple-system, Helvetica".',
  },
  {
    pattern: 'prepare-on-resize',
    severity: 'error',
    test: (code) => {
      const resizeContext = /(?:resize|ResizeObserver|onResize|requestAnimationFrame|useLayoutEffect)[^}]*prepare\s*\(/s
      return resizeContext.test(code)
    },
    explanation:
      'prepare() is ~203x more expensive than layout(). Calling it on resize wastes the two-phase performance model.',
    fix: 'Move prepare() to initialization or text-change. Call only layout(prepared, newWidth, lineHeight) on resize.',
  },
  {
    pattern: 'inlined-prepare',
    severity: 'error',
    test: (code) => /layout\s*\(\s*prepare\s*\(/.test(code) || /layout\s*\(\s*prepareWithSegments\s*\(/.test(code),
    explanation:
      'Inlining prepare() inside layout() pays the full prepare cost on every call, defeating the caching model.',
    fix: 'Store the prepare() result: const prepared = prepare(text, font); layout(prepared, width, lh).',
  },
  {
    pattern: 'clearCache-in-loop',
    severity: 'error',
    test: (code) => {
      const loopContext = /(?:requestAnimationFrame|setInterval|forEach|\.map|while|for\s*\(|onResize|resize)[^}]*clearCache\s*\(\s*\)/s
      return loopContext.test(code)
    },
    explanation:
      'clearCache() invalidates all cached measurements. Calling it in a loop forces full re-measurement on every iteration.',
    fix: 'Remove clearCache() from hot paths. Call only on font-family changes or memory pressure.',
  },
  {
    pattern: 'dom-measurement',
    severity: 'warning',
    test: (code) => {
      const hasPretextAPI = /(?:prepare|layout|prepareWithSegments|layoutWithLines)\s*\(/.test(code)
      const hasDOMmeasure = /(?:getBoundingClientRect|offsetHeight|offsetWidth|clientHeight|clientWidth)\b/.test(code)
      return hasPretextAPI && hasDOMmeasure
    },
    explanation:
      'DOM-based measurement (getBoundingClientRect, offsetHeight) forces synchronous layout reflow — the exact problem pretext solves.',
    fix: 'Use pretext layout APIs exclusively for text dimensions. Remove DOM measurement calls.',
  },
  {
    pattern: 'missing-pre-wrap',
    severity: 'warning',
    test: (code) => {
      const hasTabOrMultiNewline = /\\t|\\n.*\\n/s.test(code)
      const hasPrepare = /prepare\s*\(/.test(code)
      const hasPreWrap = /whiteSpace.*pre-wrap|pre-wrap/.test(code)
      return hasPrepare && hasTabOrMultiNewline && !hasPreWrap
    },
    explanation:
      'Text contains tabs or multiple newlines but no whiteSpace: "pre-wrap" option. Default "normal" mode collapses whitespace.',
    fix: 'Pass { whiteSpace: "pre-wrap" } to prepare() for pre-formatted content.',
  },
]

export function handleValidate(input: ValidateInput): ValidateOutput {
  const issues: ValidationIssue[] = []
  for (const check of checks) {
    if (check.test(input.code)) {
      issues.push({
        pattern: check.pattern,
        severity: check.severity,
        explanation: check.explanation,
        fix: check.fix,
      })
    }
  }
  return { issues }
}
