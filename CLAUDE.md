# PretextPlugin

A Claude Code plugin that gives Claude deep understanding of the [pretext](https://github.com/chenglou/pretext) library — a pure TypeScript library for DOM-free multiline text measurement and layout.

## Project Goal

Pretext (by Cheng Lou, released March 28 2026) is too new for LLMs to know about. This plugin bridges that gap with:
- **Skills** — Markdown instruction files injecting deep pretext knowledge into Claude's context
- **MCP Server** — Runtime capabilities: usage validation, code execution, structured documentation serving

Target: browser-first development. No SSR (pretext doesn't support it yet).

## Current Phase

**Phase 1 — Structured Reading**: Building a complete mental model of pretext's internals by reading all source in dependency order. See design spec in PKM at `01-Projects/PretextPlugin/development/designs/2026-03-31-pretext-plugin-design.md`.

## Pretext Source

The pretext library source lives in `pretext/` within this project. Key source files in `pretext/src/`:
- `analysis.ts` — Text normalization, Intl.Segmenter-based segmentation
- `measurement.ts` — Canvas measureText, width caching
- `line-break.ts` — Hot-path line walking core algorithm
- `bidi.ts` — Bidirectional text support
- `layout.ts` — Public API surface
- `layout.test.ts` — Invariant tests
- `test-data.ts` — Shared test corpus

Also see `pretext/CLAUDE.md` for the library's own development guidance (commands, conventions, architecture).

## PKM Integration

- **Vault project**: `01-Projects/PretextPlugin/`
- **MCP Server**: `obsidian-pkm` plugin

Document decisions, research findings, and debugging sessions as you work. The `pkm-capture` agent captures devlog entries and PKM-worthy content in the background (triggered automatically after git commits), or use the `obsidian-pkm:pkm-write` skill for structured notes with linking.

Use `obsidian-pkm:pkm-explore` to research what the vault already knows about a topic before creating new content.

At the end of each session, run `obsidian-pkm:pkm-session-end` to update the devlog and capture undocumented work.
