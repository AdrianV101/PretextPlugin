// PretextPlugin MCP Server — exposes pretext tools via Model Context Protocol.
// Runs as a stdio subprocess launched by Claude Code.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { installCanvasShim } from './canvas-shim.js'
import { handleRun, handleMeasure, narrowRunInput } from './tools/execute.js'
import { handleValidate } from './tools/validate.js'
import { handleExplain, handleSource } from './tools/knowledge.js'
import { BROWSER_TYPES } from './browser-pool.js'

// Install canvas shim before any pretext import
installCanvasShim()

const server = new McpServer({
  name: 'pretext',
  version: '0.2.0',
})

// --- pretext_run ---

server.registerTool(
  'pretext_run',
  {
    title: 'Run Pretext Layout',
    description:
      'Run pretext text layout. Pass `text` for plain layout or `richInline` for chip/mention/atom inline layout (v0.0.5+). Returns line count and height. With rich=true, returns per-line widths. Default mode=structural is fast and deterministic but uses approximate widths. Set mode=accurate to run in a real headless browser for pixel-precise font metrics.',
    inputSchema: z.object({
      text: z.string().optional().describe('Text to lay out (plain layout). Mutually exclusive with richInline.'),
      richInline: z
        .array(
          z.object({
            text: z.string(),
            font: z.string(),
            letterSpacing: z.number().optional(),
            break: z.enum(['normal', 'never']).optional(),
            extraWidth: z.number().optional(),
          }),
        )
        .optional()
        .describe('Rich-inline items (v0.0.5+). Each item has its own font; use break:"never" for atomic chips/mentions. Mutually exclusive with text.'),
      font: z.string().optional().describe('CSS font string, e.g. "16px Inter". Required when using `text`; ignored for richInline.'),
      width: z.number().positive().describe('Available width in pixels'),
      lineHeight: z.number().positive().describe('Line height in pixels'),
      whiteSpace: z.enum(['normal', 'pre-wrap']).optional().describe('Whitespace mode (default: normal)'),
      wordBreak: z.enum(['normal', 'keep-all']).optional().describe('v0.0.5+. keep-all only affects CJK/Hangul; no-op on Latin.'),
      letterSpacing: z.number().optional().describe('v0.0.6+. Extra space between graphemes in CSS pixels (not em).'),
      locale: z.string().optional().describe('Locale for Intl.Segmenter (e.g. "th" for Thai)'),
      rich: z.boolean().optional().describe('Return per-line text and widths'),
      mode: z.enum(['structural', 'accurate']).optional().describe('Execution mode. structural (default): fast, deterministic, approximate widths from a canvas shim. accurate: runs pretext in a real headless browser for pixel-precise font metrics. Use accurate for debugging cross-browser divergence or shaping-context issues.'),
      browser: z.enum(BROWSER_TYPES).optional().describe('Browser engine for accurate mode (default: chromium). Ignored in structural mode.'),
    }),
  },
  async (input) => {
    const result = await handleRun(narrowRunInput(input))
    return {
      content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
    }
  }
)

// --- pretext_measure ---

server.registerTool(
  'pretext_measure',
  {
    title: 'Measure Text Segments',
    description:
      'Analyze text segmentation and widths. Returns segment breakdown with per-segment text, width, and break kind. Default mode=structural uses canvas-shim widths; mode=accurate uses real browser font metrics.',
    inputSchema: z.object({
      text: z.string().describe('Text to measure'),
      font: z.string().describe('CSS font string, e.g. "16px Inter"'),
      whiteSpace: z.enum(['normal', 'pre-wrap']).optional().describe('Whitespace mode'),
      wordBreak: z.enum(['normal', 'keep-all']).optional().describe('v0.0.5+. keep-all only affects CJK/Hangul.'),
      letterSpacing: z.number().optional().describe('v0.0.6+. CSS pixels between graphemes.'),
      locale: z.string().optional().describe('Locale for Intl.Segmenter'),
      mode: z.enum(['structural', 'accurate']).optional().describe('Execution mode. structural (default): fast canvas-shim widths. accurate: real browser font metrics.'),
      browser: z.enum(BROWSER_TYPES).optional().describe('Browser engine for accurate mode (default: chromium). Ignored in structural mode.'),
    }),
  },
  async (input) => {
    const result = await handleMeasure(input)
    return {
      content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
    }
  }
)

// --- pretext_validate ---

server.registerTool(
  'pretext_validate',
  {
    title: 'Validate Pretext Code',
    description:
      'Check code for common pretext anti-patterns: system-ui font, prepare() on resize, inlined prepare, DOM measurement alongside pretext, missing pre-wrap option, wordBreak: keep-all on Latin-only text (v0.0.5+), excessive letterSpacing values (v0.0.6+), prepare() use on chip-shaped strings (suggesting prepareRichInline).',
    inputSchema: z.object({
      code: z.string().describe('Code string to validate'),
    }),
  },
  async (input) => {
    const result = handleValidate(input)
    if (result.issues.length === 0) {
      return {
        content: [{ type: 'text' as const, text: 'No issues found. Code follows pretext best practices.' }],
      }
    }
    return {
      content: [{
        type: 'text' as const,
        text: result.issues
          .map(i => `[${i.severity.toUpperCase()}] ${i.pattern}\n${i.explanation}\nFix: ${i.fix}`)
          .join('\n\n'),
      }],
    }
  }
)

// --- pretext_explain ---

server.registerTool(
  'pretext_explain',
  {
    title: 'Explain Pretext Concepts',
    description:
      'Search the pretext knowledge base for explanations of concepts, APIs, architecture, browser compatibility, script support, edge cases, and common mistakes.',
    inputSchema: z.object({
      query: z.string().describe('What to explain (e.g. "two phase design", "Arabic accuracy", "emoji correction")'),
    }),
  },
  async (input) => {
    const result = await handleExplain(input)
    return {
      content: [{ type: 'text' as const, text: result.content }],
    }
  }
)

// --- pretext_source ---

server.registerTool(
  'pretext_source',
  {
    title: 'Read Pretext Source',
    description:
      'Read pretext source code. Specify a module (layout, analysis, measurement, line-break, line-text, rich-inline, bidi) and optionally a function name.',
    inputSchema: z.object({
      module: z.string().describe('Module name: layout, analysis, measurement, line-break, line-text (v0.0.6+), rich-inline (v0.0.5+), bidi'),
      functionName: z.string().optional().describe('Specific function to extract'),
    }),
  },
  async (input) => {
    const result = await handleSource(input)
    if (result.error) {
      return {
        content: [{ type: 'text' as const, text: `Error: ${result.error}` }],
      }
    }
    return {
      content: [{
        type: 'text' as const,
        text: result.path
          ? `// Source: ${result.path}\n\n${result.source}`
          : result.source,
      }],
    }
  }
)

// --- Start server ---

const transport = new StdioServerTransport()
try {
  await server.connect(transport)
} catch (error) {
  process.stderr.write(`pretext MCP server failed to start: ${error}\n`)
  process.exit(1)
}
