import { chromium, expect, test, type BrowserContext } from '@playwright/test'
import fs from 'fs'
import os from 'os'
import path from 'path'

const EXT_REL_PATH = ['build', 'chrome-mv3']
const SERVER_URL = process.env.TLDW_URL || 'http://127.0.0.1:8000'
const API_KEY = process.env.TLDW_API_KEY || 'THIS-IS-A-SECURE-KEY-123-FAKE-KEY'

const buildAuthHeaders = (): Record<string, string> => ({
  'Content-Type': 'application/json',
  ...(API_KEY ? { 'X-API-KEY': API_KEY } : {})
})

const fetchJson = async (url: string, init?: RequestInit): Promise<any> => {
  const resp = await fetch(url, init)
  const text = await resp.text()
  const json = text ? JSON.parse(text) : null
  if (!resp.ok) {
    const detail = json?.detail || json?.error || text
    throw new Error(`Request failed (${resp.status}): ${detail}`)
  }
  return json
}

const waitForJob = async (jobId: number, timeoutMs = 120000): Promise<void> => {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const status = await fetchJson(`${SERVER_URL}/api/v1/data-tables/jobs/${jobId}`, {
      headers: buildAuthHeaders()
    })
    const state = String(status?.status || '').toLowerCase()
    if (state === 'completed') return
    if (['failed', 'cancelled', 'quarantined'].includes(state)) {
      throw new Error(`Job ${jobId} ended with status ${state}`)
    }
    await new Promise((r) => setTimeout(r, 2000))
  }
  throw new Error(`Job ${jobId} timed out`)
}

const seedTableContent = async (tableUuid: string): Promise<void> => {
  const suffix = Date.now().toString(36)
  const nameId = `col-name-${suffix}`
  const scoreId = `col-score-${suffix}`
  const payload = {
    columns: [
      { column_id: nameId, name: 'Name', type: 'text', position: 0 },
      { column_id: scoreId, name: 'Score', type: 'number', position: 1 }
    ],
    rows: [
      { [nameId]: 'Alpha', [scoreId]: 1 },
      { [nameId]: 'Beta', [scoreId]: 2 }
    ]
  }
  await fetchJson(`${SERVER_URL}/api/v1/data-tables/${tableUuid}/content`, {
    method: 'PUT',
    headers: buildAuthHeaders(),
    body: JSON.stringify(payload)
  })
}

const createSeededTable = async (): Promise<{ uuid: string; name: string }> => {
  const name = `QA Table ${Date.now()}`
  const payload = {
    name,
    prompt: 'Create a simple table with two rows and columns Name and Score.',
    sources: [
      {
        source_type: 'rag_query',
        source_id: `qa-data-tables-seed-${Date.now()}`,
        title: 'QA Seed',
        snapshot: { query: 'qa data tables seed' }
      }
    ],
    max_rows: 2
  }

  const created = await fetchJson(`${SERVER_URL}/api/v1/data-tables/generate`, {
    method: 'POST',
    headers: buildAuthHeaders(),
    body: JSON.stringify(payload)
  })
  const tableUuid = created?.table?.uuid || ''
  if (!tableUuid) {
    throw new Error('Failed to create data table')
  }

  await seedTableContent(tableUuid)
  const detail = await fetchJson(`${SERVER_URL}/api/v1/data-tables/${tableUuid}`, {
    headers: buildAuthHeaders()
  })
  const columns = detail?.columns || []
  const rows = detail?.rows || []
  if (!columns.length || !rows.length) {
    await seedTableContent(tableUuid)
  }

  if (typeof created?.job_id === 'number') {
    try {
      await fetchJson(`${SERVER_URL}/api/v1/data-tables/jobs/${created.job_id}`, {
        method: 'DELETE',
        headers: buildAuthHeaders()
      })
    } catch {
      await waitForJob(created.job_id, 30000).catch(() => undefined)
    }
  }
  return { uuid: tableUuid, name }
}

test.describe('Data Tables edit + save', () => {
  test('add column, add row, edit cell, save', async () => {
    test.setTimeout(120000)
    const extPath = path.resolve(__dirname, '..', '..', ...EXT_REL_PATH)
    test.skip(!fs.existsSync(extPath), 'Build the extension first: bun run build:chrome')

    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dt-edit-pw-'))
    let context: BrowserContext | null = null

    try {
      context = await chromium.launchPersistentContext(userDataDir, {
        headless: false,
        args: [
          `--disable-extensions-except=${extPath}`,
          `--load-extension=${extPath}`
        ]
      })

      let extId = ''
      for (let i = 0; i < 20 && !extId; i += 1) {
        const sw = context.serviceWorkers()[0]
        if (sw) {
          const m = sw.url().match(/chrome-extension:\/\/([a-z]{32})/)
          if (m) extId = m[1]
        }
        if (!extId) await new Promise((r) => setTimeout(r, 200))
      }
      expect(extId, 'extension id resolved').not.toEqual('')

      const page = await context.newPage()
      await page.goto(`chrome-extension://${extId}/options.html#/data-tables`, {
        waitUntil: 'domcontentloaded'
      })
      await page.waitForLoadState('networkidle')

      await page.evaluate(
        ({ key, url }) =>
          new Promise<void>((resolve) => {
            // @ts-ignore
            chrome.storage?.local?.set(
              {
                tldwConfig: {
                  serverUrl: url,
                  authMode: 'single-user',
                  apiKey: key
                },
                __tldw_allow_offline: false
              },
              () => resolve()
            )
          }),
        { key: API_KEY, url: SERVER_URL }
      )
      await page.reload({ waitUntil: 'domcontentloaded' })
      await page.waitForLoadState('networkidle')

      if (await page.getByText(/Server is offline/i).first().isVisible().catch(() => false)) {
        test.skip(true, 'Server offline; ensure the backend is running.')
        return
      }

      const seeded = await createSeededTable()
      await page.reload({ waitUntil: 'domcontentloaded' })
      await page.waitForLoadState('networkidle')

      const searchInput = page.getByPlaceholder(/Search tables/i).first()
      await searchInput.fill(seeded.name)
      const tableButton = page.getByRole('button', { name: seeded.name }).first()
      await expect(tableButton).toBeVisible({ timeout: 10_000 })
      await tableButton.click()

      const drawer = page.locator('.ant-drawer-content').first()
      await expect(drawer).toBeVisible({ timeout: 10_000 })

      const editToggle = drawer.getByText(/Edit Mode/i).locator('..').getByRole('switch')
      await editToggle.click()

      await drawer.getByRole('button', { name: /Add Column/i }).click()
      const modal = page.locator('.ant-modal').filter({ hasText: /Add Column/i })
      await expect(modal).toBeVisible()
      const columnName = `QA Column ${Date.now()}`
      await modal.getByLabel(/Column Name/i).fill(columnName)
      await modal.getByRole('button', { name: /^Add$/i }).click()

      await drawer.getByRole('button', { name: /Add Row/i }).click()

      const editableCells = drawer.locator('.editable-cell')
      await expect(editableCells.first()).toBeVisible({ timeout: 10_000 })
      await editableCells.last().click()

      const input = drawer.locator('.editable-cell-editing input').first()
      await input.fill('QA Value')
      await input.press('Enter')

      await drawer.getByRole('button', { name: /^Save$/i }).click()
      await expect(page.getByText(/Changes saved successfully/i)).toBeVisible({
        timeout: 15_000
      })
    } finally {
      await context?.close()
      fs.rmSync(userDataDir, { recursive: true, force: true })
    }
  })
})
