// PretextPlugin MCP Server — exposes pretext tools via Model Context Protocol.
// Runs as a stdio subprocess launched by Claude Code.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { installCanvasShim } from './canvas-shim.js'
import { handleRun, handleMeasure } from './tools/execute.js'
import { handleValidate } from './tools/validate.js'
import { handleExplain, handleSource } from './tools/knowledge.js'

// Install canvas shim before any pretext import
installCanvasShim()

const server = new McpServer({
  name: 'pretext',
  version: '0.1.0',
})

// --- pretext_run ---

server.registerTool(
  'pretext_run',
  {
    title: 'Run Pretext Layout',
    description:
      'Run pretext text layout. Returns line count and height. With rich=true, returns per-line text and widths. Default mode=structural is fast and deterministic but uses approximate widths. Set mode=accurate to run in a real headless browser for pixel-precise font metrics.',
    inputSchema: z.object({
      text: z.string().describe('Text to lay out'),
      font: z.string().describe('CSS font string, e.g. "16px Inter"'),
      width: z.number().positive().describe('Available width in pixels'),
      lineHeight: z.number().positive().describe('Line height in pixels'),
      whiteSpace: z.enum(['normal', 'pre-wrap']).optional().describe('Whitespace mode (default: normal)'),
      locale: z.string().optional().describe('Locale for Intl.Segmenter (e.g. "th" for Thai)'),
      rich: z.boolean().optional().describe('Return per-line text and widths'),
      mode: z.enum(['structural', 'accurate']).optional().describe('Execution mode. structural (default): fast, deterministic, approximate widths from a canvas shim. accurate: runs pretext in a real headless browser for pixel-precise font metrics. Use accurate for debugging cross-browser divergence or shaping-context issues.'),
      browser: z.enum(['chromium', 'firefox', 'webkit']).optional().describe('Browser engine for accurate mode (default: chromium). Ignored in structural mode.'),
    }),
  },
  async (input) => {
    const result = await handleRun(input)
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
      locale: z.string().optional().describe('Locale for Intl.Segmenter'),
      mode: z.enum(['structural', 'accurate']).optional().describe('Execution mode. structural (default): fast canvas-shim widths. accurate: real browser font metrics.'),
      browser: z.enum(['chromium', 'firefox', 'webkit']).optional().describe('Browser engine for accurate mode (default: chromium). Ignored in structural mode.'),
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
      'Check code for common pretext anti-patterns: system-ui font, prepare() on resize, inlined prepare, DOM measurement alongside pretext, missing pre-wrap option, etc.',
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
      'Read pretext source code. Specify a module (layout, analysis, measurement, line-break, bidi) and optionally a function name.',
    inputSchema: z.object({
      module: z.string().describe('Module name: layout, analysis, measurement, line-break, bidi'),
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
