import { chromium, expect, test, type BrowserContext, type Page } from '@playwright/test'
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

const REQUEST_TIMEOUT_MS = 20_000

const fetchJson = async (
  url: string,
  init?: RequestInit,
  timeoutMs: number = REQUEST_TIMEOUT_MS
): Promise<any> => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const resp = await fetch(url, { ...init, signal: controller.signal })
    const text = await resp.text()
    const json = text ? JSON.parse(text) : null
    if (!resp.ok) {
      const detail = json?.detail || json?.error || text
      throw new Error(`Request failed (${resp.status}): ${detail}`)
    }
    return json
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs}ms: ${url}`)
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
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

  await seedTableContent(tableUuid)
  const detail = await fetchJson(`${SERVER_URL}/api/v1/data-tables/${tableUuid}`, {
    headers: buildAuthHeaders()
  })
  const columns = detail?.columns || []
  const rows = detail?.rows || []
  if (!columns.length || !rows.length) {
    await seedTableContent(tableUuid)
  }
  return { uuid: tableUuid, name }
}

const waitForDataTablesView = async (
  page: Page,
  opts?: { timeoutMs?: number; offlineGraceMs?: number }
): Promise<'online' | 'offline'> => {
  const timeoutMs = opts?.timeoutMs ?? 30_000
  const offlineGraceMs = opts?.offlineGraceMs ?? 12_000
  const heading = page.getByRole('heading', { name: /Data Tables Studio/i })
  const offline = page.getByText(/Server is offline/i).first()
  const start = Date.now()
  let offlineSeenAt: number | null = null
  let loggedOffline = false

  while (Date.now() - start < timeoutMs) {
    if (await heading.isVisible().catch(() => false)) {
      return 'online'
    }
    const offlineVisible = await offline.isVisible().catch(() => false)
    if (offlineVisible) {
      if (offlineSeenAt === null) {
        offlineSeenAt = Date.now()
      }
      if (!loggedOffline) {
        loggedOffline = true
        console.log('[data-tables-edit] offline banner detected; waiting for recovery')
      }
      if (Date.now() - offlineSeenAt > offlineGraceMs) {
        return 'offline'
      }
    } else {
      offlineSeenAt = null
    }
    await page.waitForTimeout(500)
  }
  return (await offline.isVisible().catch(() => false)) ? 'offline' : 'online'
}

test.describe('Data Tables edit + save', () => {
  test('add column, add row, edit cell, save', async () => {
    test.setTimeout(120000)
    const logStep = (message: string, details?: Record<string, unknown>) => {
      const suffix = details ? ` ${JSON.stringify(details)}` : ''
      console.log(`[data-tables-edit] ${message}${suffix}`)
    }
    const extPath = path.resolve(__dirname, '..', '..', ...EXT_REL_PATH)
    test.skip(!fs.existsSync(extPath), 'Build the extension first: bun run build:chrome')

    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dt-edit-pw-'))
    let context: BrowserContext | null = null

    try {
      await test.step('launch extension context', async () => {
        logStep('launching chromium persistent context', { userDataDir, extPath })
        context = await chromium.launchPersistentContext(userDataDir, {
          headless: false,
          args: [
            `--disable-extensions-except=${extPath}`,
            `--load-extension=${extPath}`
          ]
        })
      })

      let extId = ''
      await test.step('resolve extension id', async () => {
        for (let i = 0; i < 20 && !extId; i += 1) {
          const sw = context?.serviceWorkers()[0]
          if (sw) {
            const m = sw.url().match(/chrome-extension:\/\/([a-z]{32})/)
            if (m) extId = m[1]
          }
          if (!extId) await new Promise((r) => setTimeout(r, 200))
        }
        logStep('resolved extension id', { extId })
      })
      expect(extId, 'extension id resolved').not.toEqual('')

      const page = await context.newPage()
      page.on('console', (msg) => {
        console.log(`[data-tables-edit][page:${msg.type()}] ${msg.text()}`)
      })
      page.on('pageerror', (err) => {
        console.log(`[data-tables-edit][pageerror] ${String(err)}`)
      })

      await test.step('open data tables options', async () => {
        await page.goto(`chrome-extension://${extId}/options.html#/data-tables`, {
          waitUntil: 'domcontentloaded'
        })
        logStep('navigated to data tables route', { url: page.url() })
      })

      await test.step('write config + reload', async () => {
        await page.evaluate(
          ({ key, url }) =>
            new Promise<void>((resolve, reject) => {
              if (
                typeof chrome === 'undefined' ||
                !chrome.storage?.local?.set
              ) {
                reject(new Error('chrome.storage.local unavailable'))
                return
              }
              chrome.storage.local.set(
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
        const status = await waitForDataTablesView(page)
        logStep('data tables view status', { status })
        if (status === 'offline') {
          test.skip(true, 'Server offline; ensure the backend is running.')
          return
        }
      })

      const seeded = await test.step('create + seed table via API', async () => {
        const created = await createSeededTable()
        logStep('seeded table created', created)
        return created
      })

      await test.step('reload after seeding', async () => {
        await page.reload({ waitUntil: 'domcontentloaded' })
        const status = await waitForDataTablesView(page)
        logStep('data tables view status after reload', { status })
        if (status === 'offline') {
          test.skip(true, 'Server offline; ensure the backend is running.')
          return
        }
      })

      await test.step('focus My Tables tab', async () => {
        const tablesTab = page.getByRole('tab', { name: /My Tables/i })
        if (await tablesTab.isVisible().catch(() => false)) {
          await tablesTab.click()
          logStep('clicked My Tables tab')
        } else {
          logStep('My Tables tab not visible, continuing')
        }
      })

      await test.step('refresh list + search', async () => {
        const refreshButton = page.getByRole('button', { name: /Refresh/i }).first()
        await refreshButton.click()
        logStep('clicked refresh')

        const searchInput = page.getByPlaceholder(/Search/i).first()
        await searchInput.fill(seeded.name)
        logStep('filled search input', { search: seeded.name })
        await refreshButton.click()
        logStep('clicked refresh after search')

        const tableButton = page.getByRole('button', { name: seeded.name }).first()
        await expect(tableButton).toBeVisible({ timeout: 20_000 })
        await tableButton.click()
        logStep('opened table detail', { name: seeded.name })
      })

      const drawer = page.locator('.ant-drawer-content').first()
      await test.step('wait for detail drawer', async () => {
        await expect(drawer).toBeVisible({ timeout: 10_000 })
        logStep('drawer visible')
      })

      await test.step('enable edit mode', async () => {
        const editToggle = drawer.getByText(/Edit Mode/i).locator('..').getByRole('switch')
        await editToggle.click()
        logStep('edit mode toggled on')
      })

      await test.step('add column', async () => {
        await drawer.getByRole('button', { name: /Add Column/i }).click()
        const modal = page.locator('.ant-modal').filter({ hasText: /Add Column/i })
        await expect(modal).toBeVisible()
        const columnName = `QA Column ${Date.now()}`
        await modal.getByLabel(/Column Name/i).fill(columnName)
        await modal.getByRole('button', { name: /^Add$/i }).click()
        logStep('column added', { columnName })
      })

      await test.step('add row', async () => {
        await drawer.getByRole('button', { name: /Add Row/i }).click()
        logStep('row added')
      })

      await test.step('edit cell', async () => {
        const editableCells = drawer.locator('.editable-cell')
        await expect(editableCells.first()).toBeVisible({ timeout: 10_000 })
        await editableCells.last().click()

        const input = drawer.locator('.editable-cell-editing input').first()
        await input.fill('QA Value')
        await input.press('Enter')
        logStep('cell edited', { value: 'QA Value' })
      })

      await test.step('save changes', async () => {
        await drawer.getByRole('button', { name: /^Save$/i }).click()
        await expect(page.getByText(/Changes saved successfully/i)).toBeVisible({
          timeout: 15_000
        })
        logStep('save confirmed')
      })
    } finally {
      await context?.close()
      fs.rmSync(userDataDir, { recursive: true, force: true })
    }
  })
})
