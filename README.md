[![MIT License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Bun](https://img.shields.io/badge/Bun-1.x-f9f1e1?logo=bun&logoColor=black)](https://bun.sh)
[![Tests](https://img.shields.io/badge/Tests-56%20passing-brightgreen)]()
[![pretext](https://img.shields.io/badge/pretext-v0.0.3-orange)](https://github.com/chenglou/pretext)

# PretextPlugin

A Claude Code plugin that gives Claude deep understanding of [pretext](https://github.com/chenglou/pretext) — a pure TypeScript library for DOM-free multiline text measurement and layout.

Pretext is too new (March 2026) for LLMs to know. This plugin bridges that gap with injectable skills, an MCP server with 5 runtime tools, and a 12-file curated knowledge base.

## How It Works

```
                      Claude Code
                          |
           +--------------+--------------+
           |              |              |
       Skills (3)    Agent (1)    MCP Server (5 tools)
           |              |              |
           v              v              v
     Context injection  Multi-step   Runtime execution
     on activation      reasoning    & validation
           |              |              |
           +--------------+--------------+
                          |
                   Knowledge Base (12 files)
                   API | Architecture | Scripts
                   Edge Cases | Browser Compat
```

**Skills** inject pretext knowledge into Claude's context. The **MCP server** provides runtime tools for code execution, validation, and documentation lookup. The **agent** handles complex multi-step questions by combining both.

## Quick Start

```bash
# Install from source
git clone https://github.com/AdrianV101/PretextPlugin.git
claude plugin install ./PretextPlugin
```

Once installed, ask Claude about pretext and it will automatically activate the plugin's skills and tools:

```
"How do I use pretext to measure text height on resize?"
```

## Features

### Skills

| Skill | Activates When | What It Provides |
|---|---|---|
| `pretext` | User asks about pretext APIs, patterns, usage | Mental model, API decision tree, code patterns, 9 critical pitfalls |
| `pretext-debugging` | User debugs measurement or layout issues | Diagnostic flowchart, mismatch taxonomy, browser-specific fixes |
| `pretext-i18n` | User works with non-Latin text (CJK, Arabic, Thai...) | Per-script accuracy data, locale configuration, known limitations |

Skills activate automatically based on conversation context — no slash commands needed.

### Agent

The `pretext-advisor` agent handles complex architectural questions that span multiple knowledge domains — like designing non-rectangular text wrapping with virtualized rendering, or diagnosing Arabic measurement mismatches across browsers.

### MCP Tools

| Tool | Purpose | Example Use |
|---|---|---|
| `pretext_run` | Execute text layout, get line count and height | Test layout parameters before writing code |
| `pretext_measure` | Analyze text segmentation and per-segment widths | Debug why text wraps at an unexpected point |
| `pretext_validate` | Check code for 6 common anti-patterns | Catch `system-ui` font, inlined `prepare()`, etc. |
| `pretext_explain` | Search the knowledge base by topic | Look up architecture, browser compat, edge cases |
| `pretext_source` | Read pretext source code by module/function | Understand internal behavior |

Tools run in **structural mode** — deterministic width estimates without a real browser. A Playwright-based accurate mode is planned for pixel-precise debugging.

## Knowledge Base

12 curated reference files covering pretext's full surface area, served to Claude via the `pretext_explain` tool:

- `api-reference.md` — Complete API signatures and types
- `architecture.md` — Two-phase design, internal data structures, caching
- `common-mistakes.md` — Anti-patterns with detection and fixes
- `mismatch-taxonomy.md` — Why pretext/browser measurements can differ
- `browser-compat.md` — Chrome, Safari, Firefox behavior differences
- `script-matrix.md` — Per-script accuracy (Latin, CJK, Arabic, Thai, and 8 more)
- `edge-cases.md` — Zero-width chars, long words, empty strings, tabs
- `modules/` — Deep dives into 5 source modules (analysis, measurement, line-break, layout, bidi)

## Development

**Prerequisites:** [Bun](https://bun.sh) >= 1.0

```bash
cd mcp-server && bun install        # Install dependencies
cd mcp-server && bun test           # Run 56 tests
cd mcp-server && bun run index.ts   # Start MCP server (stdio)
```

### Project Structure

```
.claude-plugin/plugin.json   Plugin manifest
skills/                      3 skill definitions
agents/                      1 agent definition (pretext-advisor)
mcp-server/                  Bun MCP server with 5 tools
knowledge/                   12 reference files
pretext-bundled/             Bundled pretext v0.0.3 dist
```

## How It Was Built

PretextPlugin was built through a four-phase process:

1. **Structured Reading** — 8 research notes analyzing pretext's source code, architecture, and API surface
2. **Empirical Validation** — 23,040 browser tests across Chrome, Safari, and Firefox confirming accuracy for 12 scripts. ~92% of Phase 1 findings confirmed; the rest corrected
3. **Knowledge Architecture** — Plugin design spec with 6 architectural decisions (structural vs. accurate mode, knowledge granularity, tool boundaries)
4. **Implementation** — 3 skills, 1 agent, MCP server with 5 tools, 12-file knowledge base, 56 tests

## Contributing

Contributions are welcome. To get started:

1. Fork the repository
2. Create a feature branch
3. Run `cd mcp-server && bun test` to ensure tests pass
4. Open a pull request

For bug reports or feature requests, [open an issue](https://github.com/AdrianV101/PretextPlugin/issues).

## License

MIT — see [LICENSE](LICENSE).
