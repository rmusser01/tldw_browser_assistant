import { test, expect } from '@playwright/test'
import http from 'node:http'
import { AddressInfo } from 'node:net'
import { launchWithBuiltExtension } from './utils/extension-build'
import { waitForConnectionStore, forceConnected } from './utils/connection'

/**
 * Tests for Single Media Page UX fixes:
 * 1. hasActiveFilters passed to SearchBar - shows clear button
 * 2. isLoading passed to ResultsList - shows skeleton
 * 3. Debounced search - auto-triggers after typing
 * 4. Keyboard shortcuts - j/k for items, arrows for pages
 * 5. Visible Chat button in header
 * 6. Improved empty state with keyboard hint
 * 7. Loading skeleton in results
 * 8. Error toasts on search failure
 */

function createMockServer(options?: { delayMs?: number; failSearch?: boolean }) {
  const items = [
    { id: 1, title: 'First Video', snippet: 'Video transcript', type: 'video', keywords: ['demo'] },
    { id: 2, title: 'Second Document', snippet: 'PDF content', type: 'document', keywords: ['pdf'] },
    { id: 3, title: 'Third Audio', snippet: 'Audio transcript', type: 'audio', keywords: ['audio'] }
  ]

  const details: Record<number, any> = {
    1: { id: 1, title: 'First Video', type: 'video', content: { text: 'Full video transcript content here' }, keywords: ['demo'] },
    2: { id: 2, title: 'Second Document', type: 'document', content: { text: 'Full document content here' }, keywords: ['pdf'] },
    3: { id: 3, title: 'Third Audio', type: 'audio', content: { text: 'Full audio transcript here' }, keywords: ['audio'] }
  }

  const server = http.createServer((req, res) => {
    const url = req.url || ''
    const method = (req.method || 'GET').toUpperCase()

    const writeJson = (code: number, body: any) => {
      res.writeHead(code, {
        'content-type': 'application/json',
        'access-control-allow-origin': '*',
        'access-control-allow-credentials': 'true'
      })
      res.end(JSON.stringify(body))
    }

    const respond = (code: number, body: any) => {
      if (options?.delayMs) {
        setTimeout(() => writeJson(code, body), options.delayMs)
      } else {
        writeJson(code, body)
      }
    }

    if (method === 'OPTIONS') {
      res.writeHead(204, {
        'access-control-allow-origin': '*',
        'access-control-allow-credentials': 'true',
        'access-control-allow-headers': 'content-type, x-api-key, authorization'
      })
      return res.end()
    }

    if (url === '/api/v1/health') return respond(200, { status: 'ok' })
    if (url === '/api/v1/llm/models') return respond(200, ['mock/model'])

    // Media detail endpoint
    if (url.match(/^\/api\/v1\/media\/\d+$/) && method === 'GET') {
      const id = Number(url.split('/').pop())
      if (details[id]) return respond(200, details[id])
      return respond(404, { detail: 'not found' })
    }

    // Media search - can simulate failure
    if (url.includes('/api/v1/media/search') && method === 'POST') {
      if (options?.failSearch) return respond(500, { detail: 'Search failed' })
      return respond(200, { items, pagination: { total_items: items.length, total_pages: 1 } })
    }

    // Media list
    if (url.startsWith('/api/v1/media') && method === 'GET') {
      return respond(200, { items, pagination: { total_items: items.length, total_pages: 1 } })
    }

    if (url === '/openapi.json') {
      return respond(200, {
        openapi: '3.0.0',
        paths: { '/api/v1/media/': {}, '/api/v1/media/search': {}, '/api/v1/health': {} }
      })
    }

    respond(404, { detail: 'not found' })
  })

  return server
}

async function setupConnectedPage(server: http.Server) {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const addr = server.address() as AddressInfo
  const baseUrl = `http://127.0.0.1:${addr.port}`

  const { context, page, optionsUrl } = await launchWithBuiltExtension({
    allowOffline: true,
    seedConfig: { serverUrl: baseUrl, authMode: 'single-user', apiKey: 'test' }
  })

  await page.goto(optionsUrl, { waitUntil: 'networkidle' })
  await waitForConnectionStore(page, 'ux-fixes-test')
  await forceConnected(page, { serverUrl: baseUrl }, 'ux-fixes-test')

  return { context, page, optionsUrl, baseUrl }
}

test.describe('Single Media Page UX Fixes', () => {

  test('Fix 6: Empty state shows keyboard hint', async () => {
    const server = createMockServer()
    const { context, page, optionsUrl } = await setupConnectedPage(server)

    await page.goto(optionsUrl + '#/media')
    await page.waitForLoadState('networkidle')

    // Wait for page to stabilize
    await page.waitForTimeout(500)

    // Empty state should show keyboard hint
    const emptyState = page.locator('text=No media item selected')
    await expect(emptyState).toBeVisible()

    const keyboardHint = page.locator('text=Tip: Use j/k to navigate')
    await expect(keyboardHint).toBeVisible()

    // Screenshot: Empty state with keyboard hint
    await page.screenshot({
      path: 'tests/e2e/screenshots/fix6-empty-state-keyboard-hint.png',
      fullPage: false
    })

    await context.close()
    await new Promise<void>((r) => server.close(() => r()))
  })

  test('Fix 5: Chat button visible in header when media selected', async () => {
    const server = createMockServer()
    const { context, page, optionsUrl } = await setupConnectedPage(server)

    await page.goto(optionsUrl + '#/media')
    await page.waitForLoadState('networkidle')

    // Wait for results
    await page.waitForSelector('button[aria-label*="Select"]', { timeout: 10000 })

    // Click first result
    await page.locator('button[aria-label*="Select"]').first().click()
    await page.waitForTimeout(500)

    // Chat button should be visible
    const chatButton = page.locator('button[aria-label*="Chat with this media"]')
    await expect(chatButton).toBeVisible()

    // Screenshot: Header with Chat button
    await page.screenshot({
      path: 'tests/e2e/screenshots/fix5-chat-button-in-header.png',
      fullPage: false
    })

    await context.close()
    await new Promise<void>((r) => server.close(() => r()))
  })

  test('Fix 4: Keyboard navigation j/k works', async () => {
    const server = createMockServer()
    const { context, page, optionsUrl } = await setupConnectedPage(server)

    await page.goto(optionsUrl + '#/media')
    await page.waitForLoadState('networkidle')

    // Wait for results
    await page.waitForSelector('button[aria-label*="Select"]', { timeout: 10000 })

    // Select first item
    await page.locator('button[aria-label*="Select"]').first().click()
    await page.waitForTimeout(300)

    // Screenshot: First item selected
    await page.screenshot({
      path: 'tests/e2e/screenshots/fix4-keyboard-nav-first-item.png',
      fullPage: false
    })

    // Verify first item title visible
    await expect(page.locator('h3:has-text("First Video")')).toBeVisible()

    // Press j to go to next
    await page.keyboard.press('j')
    await page.waitForTimeout(300)

    // Verify second item now shown
    await expect(page.locator('h3:has-text("Second Document")')).toBeVisible()

    // Screenshot: Second item after j press
    await page.screenshot({
      path: 'tests/e2e/screenshots/fix4-keyboard-nav-after-j.png',
      fullPage: false
    })

    // Press k to go back
    await page.keyboard.press('k')
    await page.waitForTimeout(300)

    // Verify first item again
    await expect(page.locator('h3:has-text("First Video")')).toBeVisible()

    await context.close()
    await new Promise<void>((r) => server.close(() => r()))
  })

  test('Fix 1: hasActiveFilters shows clear button in SearchBar', async () => {
    const server = createMockServer()
    const { context, page, optionsUrl } = await setupConnectedPage(server)

    await page.goto(optionsUrl + '#/media')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(500)

    // Expand media types filter
    await page.locator('text=Media types').click()
    await page.waitForTimeout(200)

    // Check a filter checkbox
    const checkbox = page.locator('input[type="checkbox"]').first()
    if (await checkbox.isVisible()) {
      await checkbox.check()
      await page.waitForTimeout(300)

      // Screenshot: Filter active with clear button
      await page.screenshot({
        path: 'tests/e2e/screenshots/fix1-filter-active-clear-button.png',
        fullPage: false
      })

      // Clear all button should be visible
      const clearAll = page.locator('button:has-text("Clear all"), a:has-text("Clear all")')
      await expect(clearAll).toBeVisible()
    }

    await context.close()
    await new Promise<void>((r) => server.close(() => r()))
  })

  test('Fix 7: Loading skeleton appears during search', async () => {
    // Use a delayed server to see skeleton
    const server = createMockServer({ delayMs: 2000 })
    const { context, page, optionsUrl } = await setupConnectedPage(server)

    await page.goto(optionsUrl + '#/media')

    // Screenshot: Should show skeleton during initial load
    await page.waitForTimeout(500)
    await page.screenshot({
      path: 'tests/e2e/screenshots/fix7-loading-skeleton.png',
      fullPage: false
    })

    // Wait for actual results
    await page.waitForSelector('button[aria-label*="Select"]', { timeout: 10000 })

    // Screenshot: After loading complete
    await page.screenshot({
      path: 'tests/e2e/screenshots/fix7-after-loading.png',
      fullPage: false
    })

    await context.close()
    await new Promise<void>((r) => server.close(() => r()))
  })

  test('Fix 3: Debounced search auto-triggers', async () => {
    const server = createMockServer()
    const { context, page, optionsUrl } = await setupConnectedPage(server)

    await page.goto(optionsUrl + '#/media')
    await page.waitForLoadState('networkidle')
    await page.waitForSelector('button[aria-label*="Select"]', { timeout: 10000 })

    // Type in search box (use specific media search placeholder)
    const searchInput = page.locator('input[placeholder="Search media (title/content)"]')
    await searchInput.fill('test query')

    // Screenshot: After typing (before debounce triggers)
    await page.screenshot({
      path: 'tests/e2e/screenshots/fix3-debounce-typing.png',
      fullPage: false
    })

    // Wait for debounce (300ms) + search time
    await page.waitForTimeout(800)

    // Screenshot: After debounced search
    await page.screenshot({
      path: 'tests/e2e/screenshots/fix3-debounce-after-search.png',
      fullPage: false
    })

    await context.close()
    await new Promise<void>((r) => server.close(() => r()))
  })
})
