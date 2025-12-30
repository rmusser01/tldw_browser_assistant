import { test, expect } from '@playwright/test'
import http from 'node:http'
import { AddressInfo } from 'node:net'
import { launchWithBuiltExtension } from './utils/extension-build'
import {
  waitForConnectionStore,
  forceConnected
} from './utils/connection'

function startMediaMockServer(options?: { delayMs?: number }) {
  const items = [
    { id: 1, title: 'Demo recording', snippet: 'Transcript', type: 'video', keywords: ['demo', 'test'] },
    { id: 2, title: 'Demo doc', snippet: 'PDF content', type: 'document', keywords: ['pdf'] },
    { id: 3, title: 'Another video', snippet: 'More content', type: 'video', keywords: ['video'] }
  ]
  const details: Record<number, any> = {
    1: { id: 1, title: 'Demo recording', type: 'video', content: { text: 'Transcript body' }, keywords: ['demo', 'test'] },
    2: { id: 2, title: 'Demo doc', type: 'document', content: { text: 'Document body' }, keywords: ['pdf'] },
    3: { id: 3, title: 'Another video', type: 'video', content: { text: 'More content here' }, keywords: ['video'] }
  }

  const server = http.createServer((req, res) => {
    const url = req.url || ''
    const method = (req.method || 'GET').toUpperCase()

    const writeJson = (code: number, body: any) => {
      res.writeHead(code, {
        'content-type': 'application/json',
        'access-control-allow-origin': 'http://127.0.0.1',
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
        'access-control-allow-origin': 'http://127.0.0.1',
        'access-control-allow-credentials': 'true',
        'access-control-allow-headers': 'content-type, x-api-key, authorization'
      })
      return res.end()
    }

    if (url === '/api/v1/health' && method === 'GET') {
      return respond(200, { status: 'ok' })
    }

    if (url === '/api/v1/llm/models' && method === 'GET') {
      return respond(200, ['mock/model'])
    }

    if (url.startsWith('/api/v1/media/') && !url.includes('search') && method === 'GET') {
      const idStr = url.split('/').filter(Boolean).pop() || ''
      const id = Number(idStr)
      const d = details[id]
      if (d) return respond(200, d)
      return respond(404, { detail: 'not found' })
    }

    if (url.startsWith('/api/v1/media/search') && method === 'POST') {
      return respond(200, { items, pagination: { total_items: items.length } })
    }

    if (url.startsWith('/api/v1/media') && method === 'GET') {
      return respond(200, { items, pagination: { total_items: items.length } })
    }

    if (url === '/openapi.json' && method === 'GET') {
      return respond(200, {
        openapi: '3.0.0',
        paths: {
          '/api/v1/media/': {},
          '/api/v1/media/search': {},
          '/api/v1/health': {},
          '/api/v1/llm/models': {}
        }
      })
    }

    respond(404, { detail: 'not found' })
  })

  return server
}

test.describe('Review page UX', () => {
  test('shows helpful offline empty state', async () => {
    const { context, page, optionsUrl } = await launchWithBuiltExtension({
      allowOffline: false
    })

    await page.goto(optionsUrl + '#/review')
    await page.waitForLoadState('networkidle')

    // Offline/unauthenticated: show the inline connect prompt.
    const headline = page.getByText(
      /Connect to use Media|Connect to use Review/i
    )
    await expect(headline).toBeVisible()

    const connectCta = page.getByRole('button', {
      name: /Set up server|Open tldw server settings/i
    })
    await expect(connectCta).toBeVisible()

    await connectCta.click()
    const card = page.locator('#server-connection-card')
    await expect(card).toBeVisible()
    await expect(
      card.getByRole('button', { name: /Back to workspace/i })
    ).toBeVisible()

    await context.close()
  })

  test('exposes core search and a11y affordances when connected', async () => {
    const server = startMediaMockServer()
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve)
    )
    const addr = server.address() as AddressInfo
    const baseUrl = `http://127.0.0.1:${addr.port}`

    const { context, page, optionsUrl } = await launchWithBuiltExtension({
      allowOffline: true,
      seedConfig: {
        serverUrl: baseUrl,
        authMode: 'single-user',
        apiKey: 'test-key'
      }
    })

    // Seed the connection store so useServerOnline() reports "online"
    await page.goto(optionsUrl, { waitUntil: 'networkidle' })
    await waitForConnectionStore(page, 'review-ux-connected')
    await forceConnected(page, { serverUrl: baseUrl }, 'review-ux-connected')

    await page.goto(optionsUrl + '#/review')
    await page.waitForLoadState('networkidle')

    // Left column: search input and Filters toggle
    const searchInput = page.getByPlaceholder(/Search media \(title\/content\)|Search media, notes/i)
    await expect(searchInput).toBeVisible()

    // Result types and generation mode labels should be present
    await expect(page.getByText('Types', { exact: true })).toBeVisible()
    await expect(page.getByText('Keywords', { exact: true })).toBeVisible()

    // Results header shows a count string like "0 items"
    await expect(page.getByText(/results$/i)).toBeVisible()

    await context.close()
    await new Promise<void>((resolve) => server.close(() => resolve()))
  })

  test('shows empty state with keyboard hint when no media selected', async () => {
    const server = startMediaMockServer()
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve)
    )
    const addr = server.address() as AddressInfo
    const baseUrl = `http://127.0.0.1:${addr.port}`

    const { context, page, optionsUrl } = await launchWithBuiltExtension({
      allowOffline: true,
      seedConfig: {
        serverUrl: baseUrl,
        authMode: 'single-user',
        apiKey: 'test-key'
      }
    })

    await page.goto(optionsUrl, { waitUntil: 'networkidle' })
    await waitForConnectionStore(page, 'empty-state-test')
    await forceConnected(page, { serverUrl: baseUrl }, 'empty-state-test')

    await page.goto(optionsUrl + '#/media')
    await page.waitForLoadState('networkidle')

    // Empty state shows keyboard hint
    await expect(page.getByText(/No media item selected/i)).toBeVisible()
    await expect(page.getByText(/Tip: Use j\/k to navigate/i)).toBeVisible()

    await context.close()
    await new Promise<void>((resolve) => server.close(() => resolve()))
  })

  test('shows chat button in header when media is selected', async () => {
    const server = startMediaMockServer()
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve)
    )
    const addr = server.address() as AddressInfo
    const baseUrl = `http://127.0.0.1:${addr.port}`

    const { context, page, optionsUrl } = await launchWithBuiltExtension({
      allowOffline: true,
      seedConfig: {
        serverUrl: baseUrl,
        authMode: 'single-user',
        apiKey: 'test-key'
      }
    })

    await page.goto(optionsUrl, { waitUntil: 'networkidle' })
    await waitForConnectionStore(page, 'chat-button-test')
    await forceConnected(page, { serverUrl: baseUrl }, 'chat-button-test')

    await page.goto(optionsUrl + '#/media')
    await page.waitForLoadState('networkidle')

    // Wait for results to load
    await page.waitForSelector('[aria-label*="Select media"]', { timeout: 5000 })

    // Click first result
    const firstResult = page.locator('[aria-label*="Select media"]').first()
    await firstResult.click()

    // Chat button should be visible in header
    await expect(page.getByRole('button', { name: /Chat with this media/i })).toBeVisible()

    // Actions dropdown should also be visible
    await expect(page.getByRole('button', { name: /Actions/i })).toBeVisible()

    await context.close()
    await new Promise<void>((resolve) => server.close(() => resolve()))
  })

  test('keyboard navigation with j/k keys works', async () => {
    const server = startMediaMockServer()
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve)
    )
    const addr = server.address() as AddressInfo
    const baseUrl = `http://127.0.0.1:${addr.port}`

    const { context, page, optionsUrl } = await launchWithBuiltExtension({
      allowOffline: true,
      seedConfig: {
        serverUrl: baseUrl,
        authMode: 'single-user',
        apiKey: 'test-key'
      }
    })

    await page.goto(optionsUrl, { waitUntil: 'networkidle' })
    await waitForConnectionStore(page, 'keyboard-nav-test')
    await forceConnected(page, { serverUrl: baseUrl }, 'keyboard-nav-test')

    await page.goto(optionsUrl + '#/media')
    await page.waitForLoadState('networkidle')

    // Wait for results to load
    await page.waitForSelector('[aria-label*="Select media"]', { timeout: 5000 })

    // Click first result to select it
    const firstResult = page.locator('[aria-label*="Select media"]').first()
    await firstResult.click()

    // Verify first item is selected (should show title in content area)
    await expect(page.getByText('Demo recording')).toBeVisible()

    // Press 'j' to go to next item
    await page.keyboard.press('j')

    // Should now show second item
    await expect(page.getByText('Demo doc')).toBeVisible()

    // Press 'k' to go back
    await page.keyboard.press('k')

    // Should show first item again
    await expect(page.getByText('Demo recording')).toBeVisible()

    await context.close()
    await new Promise<void>((resolve) => server.close(() => resolve()))
  })

  test('clear filters button appears when filters are active', async () => {
    const server = startMediaMockServer()
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve)
    )
    const addr = server.address() as AddressInfo
    const baseUrl = `http://127.0.0.1:${addr.port}`

    const { context, page, optionsUrl } = await launchWithBuiltExtension({
      allowOffline: true,
      seedConfig: {
        serverUrl: baseUrl,
        authMode: 'single-user',
        apiKey: 'test-key'
      }
    })

    await page.goto(optionsUrl, { waitUntil: 'networkidle' })
    await waitForConnectionStore(page, 'filters-test')
    await forceConnected(page, { serverUrl: baseUrl }, 'filters-test')

    await page.goto(optionsUrl + '#/media')
    await page.waitForLoadState('networkidle')

    // Expand media types filter
    await page.getByText('Media types').click()

    // Check a media type checkbox
    const videoCheckbox = page.getByRole('checkbox', { name: /video/i })
    if (await videoCheckbox.isVisible()) {
      await videoCheckbox.check()

      // Clear all button in filter panel should be visible
      await expect(page.getByRole('button', { name: /Clear all/i })).toBeVisible()
    }

    await context.close()
    await new Promise<void>((resolve) => server.close(() => resolve()))
  })
})
