import { test, expect, type Page } from '@playwright/test'
import http from 'node:http'
import { AddressInfo } from 'node:net'
import { launchWithBuiltExtension } from './utils/extension-build'

test.describe('Quick ingest file upload', () => {
  let server: http.Server
  let baseUrl = ''
  let mediaAddCount = 0
  let mediaAddBytes = 0

  const readBodyBytes = (req: http.IncomingMessage) =>
    new Promise<number>((resolve) => {
      let size = 0
      req.on('data', (chunk) => {
        size += chunk.length
      })
      req.on('end', () => resolve(size))
      req.on('error', () => resolve(size))
    })

  const openQuickIngestModal = async (page: Page, optionsUrl: string) => {
    await page.goto(optionsUrl + '#/media', { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle')
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('tldw:check-connection'))
    })

    await page
      .waitForFunction(() => {
        const state = window.__tldw_useConnectionStore?.getState?.().state
        return Boolean(state?.isConnected) && !state?.offlineBypass
      })
      .catch(() => {})

    const trigger = page.getByTestId('open-quick-ingest').first()
    await expect(trigger).toBeVisible({ timeout: 10_000 })
    await trigger.click()

    const modal = page.locator('.quick-ingest-modal .ant-modal-content')
    await expect(modal).toBeVisible({ timeout: 10_000 })
    return modal
  }

  test.beforeAll(async () => {
    server = http.createServer(async (req, res) => {
      const url = req.url || ''
      const method = (req.method || 'GET').toUpperCase()

      const json = (code: number, body: Record<string, any>) => {
        res.writeHead(code, {
          'content-type': 'application/json',
          'access-control-allow-origin': '*',
          'access-control-allow-credentials': 'true'
        })
        res.end(JSON.stringify(body))
      }

      if (method === 'OPTIONS') {
        res.writeHead(204, {
          'access-control-allow-origin': '*',
          'access-control-allow-credentials': 'true',
          'access-control-allow-headers': 'content-type, x-api-key, authorization'
        })
        return res.end()
      }

      if (url === '/api/v1/health' && method === 'GET') {
        return json(200, { status: 'ok' })
      }
      if (url === '/api/v1/rag/health' && method === 'GET') {
        return json(200, {
          status: 'ok',
          components: {
            search_index: {
              status: 'healthy',
              message: '',
              fts_table_count: 1
            }
          }
        })
      }
      if (url === '/api/v1/media/add' && method === 'POST') {
        mediaAddCount += 1
        mediaAddBytes += await readBodyBytes(req)
        return json(200, { id: `media-${mediaAddCount}` })
      }
      if (url.startsWith('/api/v1/media/process-') && method === 'POST') {
        await readBodyBytes(req)
        return json(200, { id: 'processed-1' })
      }
      if (url === '/api/v1/media/process-web-scraping' && method === 'POST') {
        await readBodyBytes(req)
        return json(200, { id: 'scrape-1' })
      }

      res.writeHead(404)
      res.end('not found')
    })

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const addr = server.address() as AddressInfo
    baseUrl = `http://127.0.0.1:${addr.port}`
  })

  test.afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()))
  })

  test('uploads a text file and shows success summary', async () => {
    const { context, page, optionsUrl } = await launchWithBuiltExtension({
      seedConfig: {
        serverUrl: baseUrl,
        authMode: 'single-user',
        apiKey: 'test-key'
      }
    })

    try {
      const modal = await openQuickIngestModal(page, optionsUrl)

      await page.setInputFiles('[data-testid="qi-file-input"]', {
        name: 'sample.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('hello from playwright')
      })

      await expect(modal.getByText('sample.txt')).toBeVisible({ timeout: 10_000 })

      const runButton = modal.getByRole('button', {
        name: /Run quick ingest|Ingest|Process/i
      }).first()
      await expect(runButton).toBeEnabled()
      await runButton.click()

      await expect(
        modal.getByText(/Quick ingest completed (successfully|with some errors)/i)
      ).toBeVisible({ timeout: 30_000 })

      expect(mediaAddCount).toBeGreaterThan(0)
      expect(mediaAddBytes).toBeGreaterThan(0)
    } finally {
      await context.close()
    }
  })

  test('exposes dropzone a11y attributes', async () => {
    const { context, page, optionsUrl } = await launchWithBuiltExtension({
      seedConfig: {
        serverUrl: baseUrl,
        authMode: 'single-user',
        apiKey: 'test-key'
      }
    })

    try {
      await openQuickIngestModal(page, optionsUrl)

      const dropzone = page.getByTestId('qi-file-dropzone')
      await expect(dropzone).toHaveAttribute('role', 'button')
      await expect(dropzone).toHaveAttribute('tabindex', '0')
      await expect(dropzone).toHaveAttribute('aria-label', /File upload zone/i)
      await expect(
        dropzone.locator('[aria-live="polite"]')
      ).toHaveCount(1)
    } finally {
      await context.close()
    }
  })
})
