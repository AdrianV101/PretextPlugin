// pretext_explain and pretext_source tool implementations.
// Serves knowledge base sections and pretext source code.

import { readFileSync, existsSync, readdirSync } from 'fs'
import { join } from 'path'

const PLUGIN_ROOT = import.meta.dir.replace(/\/mcp-server\/tools$/, '')
const KNOWLEDGE_DIR = join(PLUGIN_ROOT, 'knowledge')
const BUNDLED_SRC_DIR = join(PLUGIN_ROOT, 'pretext-bundled')
const LOCAL_SRC_DIR = join(PLUGIN_ROOT, 'pretext', 'src')

// --- pretext_explain ---

export type ExplainInput = {
  query: string
}

export type ExplainOutput = {
  content: string
  sources: string[]
}

type Section = {
  heading: string
  content: string
  file: string
}

let sectionCache: Section[] | null = null

function loadKnowledgeBase(): Section[] {
  if (sectionCache) return sectionCache

  const sections: Section[] = []

  function scanDir(dir: string): void {
    if (!existsSync(dir)) return
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        scanDir(join(dir, entry.name))
      } else if (entry.name.endsWith('.md')) {
        const filePath = join(dir, entry.name)
        const content = readFileSync(filePath, 'utf-8')
        const relativePath = filePath.replace(KNOWLEDGE_DIR + '/', '')

        // Split by ## headings into sections
        const lines = content.split('\n')
        let currentHeading = ''
        let currentContent: string[] = []

        for (const line of lines) {
          if (line.startsWith('## ')) {
            if (currentHeading && currentContent.length > 0) {
              sections.push({
                heading: currentHeading,
                content: currentContent.join('\n').trim(),
                file: relativePath,
              })
            }
            currentHeading = line.replace(/^##\s+/, '')
            currentContent = []
          } else if (line.startsWith('# ') && !currentHeading) {
            currentHeading = line.replace(/^#\s+/, '')
          } else {
            currentContent.push(line)
          }
        }
        // Push last section
        if (currentHeading && currentContent.length > 0) {
          sections.push({
            heading: currentHeading,
            content: currentContent.join('\n').trim(),
            file: relativePath,
          })
        }
      }
    }
  }

  scanDir(KNOWLEDGE_DIR)
  sectionCache = sections
  return sections
}

function scoreSection(section: Section, queryTerms: string[]): number {
  let score = 0
  const headingLower = section.heading.toLowerCase()
  const contentLower = section.content.toLowerCase()

  for (const term of queryTerms) {
    // Heading match is weighted 3x
    if (headingLower.includes(term)) score += 3
    // Content match
    if (contentLower.includes(term)) score += 1
  }
  return score
}

export async function handleExplain(input: ExplainInput): Promise<ExplainOutput> {
  const sections = loadKnowledgeBase()
  const queryTerms = input.query.toLowerCase().split(/\s+/).filter(t => t.length > 1)

  const scored = sections
    .map(s => ({ section: s, score: scoreSection(s, queryTerms) }))
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)

  if (scored.length === 0) {
    return {
      content: `No specific sections found for "${input.query}". Try searching for: API functions (prepare, layout), concepts (two phase, segment, cache), scripts (Arabic, CJK, Thai), or issues (mismatch, tolerance, emoji).`,
      sources: [],
    }
  }

  const content = scored
    .map(s => `## ${s.section.heading}\n(from ${s.section.file})\n\n${s.section.content}`)
    .join('\n\n---\n\n')

  const sources = [...new Set(scored.map(s => s.section.file))]

  return { content, sources }
}

// --- pretext_source ---

export type SourceInput = {
  module: string
  functionName?: string
}

export type SourceOutput = {
  source: string
  path?: string
  error?: string
}

const MODULE_FILES: Record<string, string> = {
  layout: 'layout.ts',
  analysis: 'analysis.ts',
  measurement: 'measurement.ts',
  'line-break': 'line-break.ts',
  bidi: 'bidi.ts',
}

function findSourceDir(): { dir: string; ext: 'ts' | 'js' } {
  // Prefer local pretext source (development — .ts files)
  if (existsSync(LOCAL_SRC_DIR)) return { dir: LOCAL_SRC_DIR, ext: 'ts' }
  // Fall back to bundled dist (.js files)
  return { dir: BUNDLED_SRC_DIR, ext: 'js' }
}

export async function handleSource(input: SourceInput): Promise<SourceOutput> {
  const baseFileName = MODULE_FILES[input.module]
  if (!baseFileName) {
    return {
      source: '',
      error: `Unknown module "${input.module}". Available: ${Object.keys(MODULE_FILES).join(', ')}`,
    }
  }

  const { dir, ext } = findSourceDir()
  // Strip the hardcoded .ts extension and re-apply the correct one for this src dir
  const fileName = baseFileName.replace(/\.ts$/, `.${ext}`)
  const filePath = join(dir, fileName)

  if (!existsSync(filePath)) {
    return {
      source: '',
      error: `Source file not found at ${filePath}`,
    }
  }

  const fullSource = readFileSync(filePath, 'utf-8')

  if (!input.functionName) {
    return { source: fullSource, path: filePath }
  }

  // Extract specific function
  const funcPattern = new RegExp(
    `(?:export\\s+)?function\\s+${input.functionName}\\b[^]*?(?=\\n(?:export\\s+)?(?:function|class|const|let|type|interface)\\b|\\n\\/\\/\\s*---|\$)`,
    's'
  )
  const match = fullSource.match(funcPattern)
  if (match) {
    return { source: match[0], path: filePath }
  }

  return {
    source: '',
    error: `Function "${input.functionName}" not found in ${fileName}. Try without functionName to see the full module.`,
  }
}
