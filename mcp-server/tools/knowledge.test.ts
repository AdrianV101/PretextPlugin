import { describe, test, expect } from 'bun:test'
import { handleExplain, handleSource } from './knowledge.js'

describe('pretext_explain', () => {
  test('returns relevant sections for API query', async () => {
    const result = await handleExplain({ query: 'prepare function' })
    expect(result.content.length).toBeGreaterThan(0)
    expect(result.content.toLowerCase()).toContain('prepare')
  })

  test('returns relevant sections for architecture query', async () => {
    const result = await handleExplain({ query: 'two phase design' })
    expect(result.content.length).toBeGreaterThan(0)
  })

  test('returns relevant sections for script query', async () => {
    const result = await handleExplain({ query: 'Arabic accuracy' })
    expect(result.content.length).toBeGreaterThan(0)
  })

  test('returns helpful message for no-match query', async () => {
    const result = await handleExplain({ query: 'xyznonexistent123' })
    expect(result.content).toContain('No specific sections found')
  })
})

describe('pretext_source', () => {
  test('returns source code for layout module', async () => {
    const result = await handleSource({ module: 'layout' })
    expect(result.source.length).toBeGreaterThan(0)
    expect(result.source).toContain('export function')
  })

  test('returns source for specific function', async () => {
    const result = await handleSource({ module: 'layout', functionName: 'prepare' })
    expect(result.source.length).toBeGreaterThan(0)
    expect(result.source).toContain('prepare')
  })

  test('returns error for unknown module', async () => {
    const result = await handleSource({ module: 'nonexistent' })
    expect(result.error).toBeDefined()
  })
})
