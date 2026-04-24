import { describe, test, expect, mock, beforeEach } from 'bun:test'
import { BrowserPool } from './browser-pool.js'

type MockPage = { route: ReturnType<typeof mock>; setContent: ReturnType<typeof mock>; waitForFunction: ReturnType<typeof mock>; close: ReturnType<typeof mock> }
type MockBrowser = { newPage: ReturnType<typeof mock>; close: ReturnType<typeof mock>; isConnected: ReturnType<typeof mock> }

function makePage(): MockPage {
  return {
    route: mock(async () => {}),
    setContent: mock(async () => {}),
    waitForFunction: mock(async () => {}),
    close: mock(async () => {}),
  }
}

function makeBrowser(page: MockPage): MockBrowser {
  return {
    newPage: mock(async () => page),
    close: mock(async () => {}),
    isConnected: mock(() => true),
  }
}

function makeFakePlaywright() {
  const pages: MockPage[] = []
  const browsers: MockBrowser[] = []
  const launchMock = mock(async () => {
    const page = makePage()
    const browser = makeBrowser(page)
    pages.push(page)
    browsers.push(browser)
    return browser
  })
  return {
    chromium: { launch: launchMock },
    firefox: { launch: launchMock },
    webkit: { launch: launchMock },
    _pages: pages,
    _browsers: browsers,
    _launch: launchMock,
  }
}

describe('BrowserPool', () => {
  let fake: ReturnType<typeof makeFakePlaywright>
  let pool: BrowserPool

  beforeEach(() => {
    fake = makeFakePlaywright()
    pool = new BrowserPool({ loadPlaywright: async () => fake as any })
  })

  test('getPage launches the requested browser on first call', async () => {
    await pool.getPage('chromium')
    expect(fake._launch).toHaveBeenCalledTimes(1)
  })

  test('getPage reuses the cached page on repeat calls', async () => {
    const page1 = await pool.getPage('chromium')
    const page2 = await pool.getPage('chromium')
    expect(page1).toBe(page2)
    expect(fake._launch).toHaveBeenCalledTimes(1)
  })

  test('different browser types get different browsers', async () => {
    await pool.getPage('chromium')
    await pool.getPage('firefox')
    expect(fake._launch).toHaveBeenCalledTimes(2)
  })

  test('getPage registers route, sets content, and waits for pretext', async () => {
    const page = await pool.getPage('chromium') as unknown as MockPage
    expect(page.route).toHaveBeenCalledTimes(1)
    expect(page.setContent).toHaveBeenCalledTimes(1)
    expect(page.waitForFunction).toHaveBeenCalledTimes(1)
  })

  test('close() closes every launched browser', async () => {
    await pool.getPage('chromium')
    await pool.getPage('firefox')
    await pool.close()
    expect(fake._browsers[0]!.close).toHaveBeenCalledTimes(1)
    expect(fake._browsers[1]!.close).toHaveBeenCalledTimes(1)
  })

  test('close() is idempotent', async () => {
    await pool.getPage('chromium')
    await pool.close()
    await pool.close()
    expect(fake._browsers[0]!.close).toHaveBeenCalledTimes(1)
  })

  test('getPage throws a helpful error when playwright is unavailable', async () => {
    const p = new BrowserPool({
      loadPlaywright: async () => { throw new Error('Cannot find module playwright') },
    })
    await expect(p.getPage('chromium')).rejects.toThrow(/Playwright is not installed/)
  })

  test('getPage surfaces missing-browser-binary as a friendly error', async () => {
    const p = new BrowserPool({
      loadPlaywright: async () => ({
        chromium: { launch: async () => { throw new Error("Executable doesn't exist at /path/to/chromium") } },
        firefox: { launch: async () => ({}) as any },
        webkit: { launch: async () => ({}) as any },
      }) as any,
    })
    await expect(p.getPage('chromium')).rejects.toThrow(/bunx playwright install chromium/)
  })
})
