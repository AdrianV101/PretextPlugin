import { describe, test, expect, mock, beforeEach } from 'bun:test'
import { registerPretextRoute, clearBundleCache, PRETEXT_ORIGIN } from './pretext-browser-bundle.js'

type RouteHandler = (route: MockRoute) => Promise<void> | void
type MockRoute = {
  request: () => { url: () => string }
  fulfill: ReturnType<typeof mock>
  abort: ReturnType<typeof mock>
}

function makePage() {
  let registered: { pattern: string | RegExp; handler: RouteHandler } | null = null
  const page = {
    route: mock(async (pattern: string | RegExp, handler: RouteHandler) => {
      registered = { pattern, handler }
    }),
    trigger: async (url: string) => {
      if (!registered) throw new Error('no route registered')
      const route: MockRoute = {
        request: () => ({ url: () => url }),
        fulfill: mock(async () => {}),
        abort: mock(async () => {}),
      }
      await registered.handler(route)
      return route
    },
  }
  return page
}

describe('pretext-browser-bundle', () => {
  beforeEach(() => clearBundleCache())

  test('registers a route for the pretext origin', async () => {
    const page = makePage()
    await registerPretextRoute(page as any)
    expect(page.route).toHaveBeenCalledTimes(1)
    const [pattern] = page.route.mock.calls[0]!
    expect(String(pattern)).toContain('pretext.local')
  })

  test('fulfills a request for layout.js with file contents and JS content-type', async () => {
    const page = makePage()
    await registerPretextRoute(page as any)
    const route = await page.trigger(`${PRETEXT_ORIGIN}/layout.js`)
    expect(route.fulfill).toHaveBeenCalledTimes(1)
    const [arg] = route.fulfill.mock.calls[0]!
    expect(arg.status).toBe(200)
    expect(arg.contentType).toBe('application/javascript')
    expect(arg.body).toContain('export function prepare')
  })

  test('aborts requests for modules not in pretext-bundled', async () => {
    const page = makePage()
    await registerPretextRoute(page as any)
    const route = await page.trigger(`${PRETEXT_ORIGIN}/does-not-exist.js`)
    expect(route.abort).toHaveBeenCalledTimes(1)
    expect(route.fulfill).not.toHaveBeenCalled()
  })

  test('caches file reads across multiple requests', async () => {
    const page = makePage()
    await registerPretextRoute(page as any)
    await page.trigger(`${PRETEXT_ORIGIN}/layout.js`)
    await page.trigger(`${PRETEXT_ORIGIN}/layout.js`)
    await page.trigger(`${PRETEXT_ORIGIN}/layout.js`)
    const a = await page.trigger(`${PRETEXT_ORIGIN}/layout.js`)
    const b = await page.trigger(`${PRETEXT_ORIGIN}/layout.js`)
    expect(a.fulfill.mock.calls[0]![0].body).toBe(b.fulfill.mock.calls[0]![0].body)
  })
})
