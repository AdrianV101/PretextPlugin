import { describe, test, expect, mock, beforeEach, afterEach } from 'bun:test'
import {
  registerPretextRoute,
  clearBundleCache,
  PRETEXT_ORIGIN,
  __setBundledDirForTesting,
  __resetBundledDirForTesting,
} from './pretext-browser-bundle.js'

type RouteHandler = (route: MockRoute) => Promise<void> | void
type MockRoute = {
  request: () => { url: () => string }
  fulfill: ReturnType<typeof mock>
  abort: ReturnType<typeof mock>
}

function makePage(routeOverride?: Partial<MockRoute>) {
  let registered: { pattern: string | RegExp; handler: RouteHandler } | null = null
  const page = {
    route: mock(async (pattern: string | RegExp, handler: RouteHandler) => {
      registered = { pattern, handler }
    }),
    trigger: async (url: string) => {
      if (!registered) throw new Error('no route registered')
      const route: MockRoute = {
        request: () => ({ url: () => url }),
        fulfill: routeOverride?.fulfill ?? mock(async () => {}),
        abort: routeOverride?.abort ?? mock(async () => {}),
      }
      await registered.handler(route)
      return route
    },
  }
  return page
}

describe('pretext-browser-bundle', () => {
  beforeEach(() => clearBundleCache())
  afterEach(() => __resetBundledDirForTesting())

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

  test('fulfills a request for rich-inline.js (v0.0.5+)', async () => {
    const page = makePage()
    await registerPretextRoute(page as any)
    const route = await page.trigger(`${PRETEXT_ORIGIN}/rich-inline.js`)
    expect(route.fulfill).toHaveBeenCalledTimes(1)
    const [arg] = route.fulfill.mock.calls[0]!
    expect(arg.status).toBe(200)
    expect(arg.body).toContain('export function prepareRichInline')
  })

  test('fulfills a request for line-text.js (v0.0.6 dependency)', async () => {
    const page = makePage()
    await registerPretextRoute(page as any)
    const route = await page.trigger(`${PRETEXT_ORIGIN}/line-text.js`)
    expect(route.fulfill).toHaveBeenCalledTimes(1)
    const [arg] = route.fulfill.mock.calls[0]!
    expect(arg.status).toBe(200)
  })

  test('fulfills a request for generated/bidi-data.js (subdirectory)', async () => {
    const page = makePage()
    await registerPretextRoute(page as any)
    const route = await page.trigger(`${PRETEXT_ORIGIN}/generated/bidi-data.js`)
    expect(route.fulfill).toHaveBeenCalledTimes(1)
    const [arg] = route.fulfill.mock.calls[0]!
    expect(arg.status).toBe(200)
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

  test('fulfills with status 500 when an allowed module cannot be read', async () => {
    __setBundledDirForTesting('/tmp/pretext-bundle-does-not-exist-' + Date.now())
    const page = makePage()
    await registerPretextRoute(page as any)
    const route = await page.trigger(`${PRETEXT_ORIGIN}/layout.js`)
    expect(route.fulfill).toHaveBeenCalledTimes(1)
    expect(route.abort).not.toHaveBeenCalled()
    const [arg] = route.fulfill.mock.calls[0]!
    expect(arg.status).toBe(500)
    expect(arg.body).toMatch(/failed to read layout\.js/)
  })

  test('route handler does not throw when fulfill itself rejects', async () => {
    const failingFulfill = mock(async () => {
      throw new Error('Target page, context or browser has been closed')
    })
    const page = makePage({ fulfill: failingFulfill })
    await registerPretextRoute(page as any)
    // Must not throw — page-closed mid-request is a normal Playwright race.
    await page.trigger(`${PRETEXT_ORIGIN}/layout.js`)
    expect(failingFulfill).toHaveBeenCalledTimes(1)
  })
})
