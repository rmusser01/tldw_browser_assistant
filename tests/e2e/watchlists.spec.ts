import { test, expect } from '@playwright/test'
import path from 'path'

import { launchWithExtension } from './utils/extension'

test.describe('Watchlists playground smoke', () => {
  test('loads tabs and key flows', async () => {
    const extPath = path.resolve('build/chrome-mv3')
    const { context, page, optionsUrl } = await launchWithExtension(extPath, {
      seedConfig: {
        __tldw_first_run_complete: true,
        __tldw_allow_offline: true
      }
    })

    await context.addInitScript(() => {
      const now = () => new Date().toISOString()
      const sources = [
        {
          id: 1,
          name: 'Tech Daily',
          url: 'https://example.com/rss.xml',
          source_type: 'rss',
          active: true,
          tags: ['tech'],
          created_at: now(),
          updated_at: now(),
          last_scraped_at: now()
        },
        {
          id: 2,
          name: 'World News',
          url: 'https://example.com/world',
          source_type: 'site',
          active: true,
          tags: ['world'],
          created_at: now(),
          updated_at: now(),
          last_scraped_at: null
        }
      ]

      const tags = [
        { id: 1, name: 'tech' },
        { id: 2, name: 'world' }
      ]

      const groups = [
        { id: 10, name: 'News', description: null, parent_group_id: null }
      ]

      const jobs = [
        {
          id: 11,
          name: 'Morning Brief',
          description: 'Daily scan',
          active: true,
          scope: { sources: [1], groups: [], tags: ['tech'] },
          schedule_expr: '0 9 * * *',
          timezone: 'UTC',
          job_filters: { filters: [] },
          created_at: now(),
          updated_at: now(),
          last_run_at: now(),
          next_run_at: null
        }
      ]

      const runs = [
        {
          id: 101,
          job_id: 11,
          status: 'completed',
          started_at: now(),
          finished_at: now(),
          stats: {
            items_found: 2,
            items_ingested: 2,
            items_filtered: 0,
            items_errored: 0
          }
        }
      ]

      const runDetails = {
        id: 101,
        job_id: 11,
        status: 'completed',
        started_at: now(),
        finished_at: now(),
        stats: {
          items_found: 2,
          items_ingested: 2,
          items_filtered: 0,
          items_errored: 0
        },
        filter_tallies: { include: 2 },
        log_text: 'Processing 2 items\nCompleted successfully',
        log_path: null,
        truncated: false,
        filtered_sample: null,
        error_msg: null
      }

      const items = [
        {
          id: 501,
          run_id: 101,
          job_id: 11,
          source_id: 1,
          url: 'https://example.com/article-1',
          title: 'Example Item One',
          summary: 'Summary of item one',
          published_at: now(),
          tags: ['tech'],
          status: 'ingested',
          reviewed: false,
          created_at: now()
        },
        {
          id: 502,
          run_id: 101,
          job_id: 11,
          source_id: 1,
          url: 'https://example.com/article-2',
          title: 'Example Item Two',
          summary: 'Summary of item two',
          published_at: now(),
          tags: ['tech'],
          status: 'ingested',
          reviewed: true,
          created_at: now()
        }
      ]

      const outputs = [
        {
          id: 201,
          run_id: 101,
          job_id: 11,
          type: 'briefing',
          format: 'html',
          title: 'Morning Brief Output',
          version: 1,
          expired: false,
          created_at: now(),
          expires_at: null
        }
      ]

      const templates = [
        {
          name: 'daily-brief',
          format: 'html',
          description: 'Daily summary template',
          updated_at: now()
        }
      ]

      const templateDetails = {
        name: 'daily-brief',
        format: 'html',
        description: 'Daily summary template',
        updated_at: now(),
        content: '<h1>{{ job.name }}</h1>'
      }

      const preview = {
        items: [
          {
            source_id: 1,
            source_type: 'rss',
            url: 'https://example.com/article-1',
            title: 'Example Item One',
            summary: 'Summary',
            published_at: now(),
            decision: 'ingest',
            matched_action: 'include',
            matched_filter_key: null,
            flagged: false
          },
          {
            source_id: 2,
            source_type: 'site',
            url: 'https://example.com/article-2',
            title: 'Example Item Two',
            summary: 'Summary',
            published_at: now(),
            decision: 'filtered',
            matched_action: 'exclude',
            matched_filter_key: null,
            flagged: false
          }
        ],
        total: 2,
        ingestable: 1,
        filtered: 1
      }

      const clusters = [
        {
          id: 301,
          summary: 'Cluster about solar energy',
          canonical_claim_text: null,
          member_count: 6,
          updated_at: now(),
          watchlist_count: 1
        },
        {
          id: 302,
          summary: 'Cluster about supply chain',
          canonical_claim_text: null,
          member_count: 3,
          updated_at: now(),
          watchlist_count: 0
        }
      ]

      const jobClusters = new Map([[11, [{ cluster_id: 301, created_at: now() }]]])

      const paginate = (list, page, size) => {
        const current = page || 1
        const limit = size || list.length || 1
        const start = (current - 1) * limit
        const end = start + limit
        return {
          items: list.slice(start, end),
          total: list.length,
          page: current,
          size: limit,
          has_more: end < list.length
        }
      }

      const handleRequest = (payload) => {
        const path = payload?.path || ''
        const method = String(payload?.method || 'GET').toUpperCase()
        const body = payload?.body || null
        const [pathname, queryString] = path.split('?')
        const params = new URLSearchParams(queryString || '')
        const page = Number(params.get('page') || 1)
        const size = Number(params.get('size') || 20)

        if (pathname === '/api/v1/watchlists/sources' && method === 'GET') {
          return paginate(sources, page, size)
        }

        if (pathname === '/api/v1/watchlists/tags' && method === 'GET') {
          return paginate(tags, page, size)
        }

        if (pathname === '/api/v1/watchlists/groups' && method === 'GET') {
          return paginate(groups, page, size)
        }

        if (pathname === '/api/v1/watchlists/jobs' && method === 'GET') {
          return paginate(jobs, page, size)
        }

        const jobPreviewMatch = pathname.match(/^\/api\/v1\/watchlists\/jobs\/(\d+)\/preview$/)
        if (jobPreviewMatch && method === 'POST') {
          return preview
        }

        if (pathname === '/api/v1/watchlists/runs' && method === 'GET') {
          const q = params.get('q')
          const filtered = q ? runs.filter((r) => r.status === q) : runs
          return paginate(filtered, page, size)
        }

        const jobRunsMatch = pathname.match(/^\/api\/v1\/watchlists\/jobs\/(\d+)\/runs$/)
        if (jobRunsMatch && method === 'GET') {
          const jobId = Number(jobRunsMatch[1])
          const filtered = runs.filter((r) => r.job_id === jobId)
          return paginate(filtered, page, size)
        }

        const runDetailsMatch = pathname.match(/^\/api\/v1\/watchlists\/runs\/(\d+)\/details$/)
        if (runDetailsMatch && method === 'GET') {
          return runDetails
        }

        if (pathname === '/api/v1/watchlists/items' && method === 'GET') {
          const runId = Number(params.get('run_id'))
          const filtered = Number.isNaN(runId)
            ? items
            : items.filter((item) => item.run_id === runId)
          return paginate(filtered, page, size)
        }

        if (pathname === '/api/v1/watchlists/outputs' && method === 'GET') {
          const jobId = Number(params.get('job_id'))
          const runId = Number(params.get('run_id'))
          let filtered = outputs
          if (!Number.isNaN(jobId)) {
            filtered = filtered.filter((output) => output.job_id === jobId)
          }
          if (!Number.isNaN(runId)) {
            filtered = filtered.filter((output) => output.run_id === runId)
          }
          return paginate(filtered, page, size)
        }

        const downloadMatch = pathname.match(/^\/api\/v1\/watchlists\/outputs\/(\d+)\/download$/)
        if (downloadMatch && method === 'GET') {
          return '<h1>Morning Brief</h1><p>Sample output</p>'
        }

        if (pathname === '/api/v1/watchlists/templates' && method === 'GET') {
          return { items: templates }
        }

        const templateMatch = pathname.match(/^\/api\/v1\/watchlists\/templates\/(.+)$/)
        if (templateMatch && method === 'GET') {
          return templateDetails
        }

        if (pathname === '/api/v1/watchlists/settings' && method === 'GET') {
          return {
            default_output_ttl_seconds: 86400,
            temporary_output_ttl_seconds: 3600
          }
        }

        const watchlistClustersMatch = pathname.match(/^\/api\/v1\/watchlists\/(\d+)\/clusters$/)
        if (watchlistClustersMatch && method === 'GET') {
          const jobId = Number(watchlistClustersMatch[1])
          return {
            watchlist_id: jobId,
            clusters: jobClusters.get(jobId) || []
          }
        }

        if (watchlistClustersMatch && method === 'POST') {
          const jobId = Number(watchlistClustersMatch[1])
          const existing = jobClusters.get(jobId) || []
          const clusterId = Number(body?.cluster_id)
          if (!existing.find((entry) => entry.cluster_id === clusterId)) {
            existing.push({ cluster_id: clusterId, created_at: now() })
            jobClusters.set(jobId, existing)
          }
          return { status: 'added' }
        }

        const watchlistClusterDeleteMatch = pathname.match(
          /^\/api\/v1\/watchlists\/(\d+)\/clusters\/(\d+)$/
        )
        if (watchlistClusterDeleteMatch && method === 'DELETE') {
          const jobId = Number(watchlistClusterDeleteMatch[1])
          const clusterId = Number(watchlistClusterDeleteMatch[2])
          const existing = jobClusters.get(jobId) || []
          jobClusters.set(
            jobId,
            existing.filter((entry) => entry.cluster_id !== clusterId)
          )
          return { status: 'removed' }
        }

        if (pathname === '/api/v1/claims/clusters' && method === 'GET') {
          return clusters
        }

        if (pathname === '/api/v1/watchlists/items/501' && method === 'PATCH') {
          return { ...items[0], reviewed: Boolean(body?.reviewed) }
        }

        return null
      }

      const patchRuntime = (runtime) => {
        if (!runtime?.sendMessage) return
        const original = runtime.sendMessage.bind(runtime)
        const handler = async (message) => {
          if (message?.type === 'tldw:request') {
            try {
              const data = handleRequest(message.payload || {})
              if (data == null) {
                return { ok: false, status: 404, error: 'Not found' }
              }
              return { ok: true, status: 200, data }
            } catch (error) {
              return { ok: false, status: 500, error: String(error || '') }
            }
          }
          return original ? original(message) : { ok: true, status: 200, data: {} }
        }
        try {
          runtime.sendMessage = handler
          return
        } catch {}
        try {
          Object.defineProperty(runtime, 'sendMessage', {
            value: handler,
            configurable: true,
            writable: true
          })
        } catch {}
      }

      if (window.chrome?.runtime) {
        patchRuntime(window.chrome.runtime)
      }

      if (window.browser?.runtime) {
        patchRuntime(window.browser.runtime)
      }
    })

    await page.goto(optionsUrl + '#/watchlists', { waitUntil: 'domcontentloaded' })

    await expect(page.getByRole('heading', { name: 'Watchlists' })).toBeVisible()
    await expect(page.getByText('Tech Daily')).toBeVisible()

    await page.getByRole('tab', { name: 'Jobs' }).click()
    await expect(page.getByText('Morning Brief')).toBeVisible()
    let activePane = page.locator('.ant-tabs-tabpane-active')
    await activePane.locator('tbody tr').first().locator('button').nth(1).click()
    const previewDialog = page.getByRole('dialog', { name: 'Job Preview' })
    await expect(previewDialog).toBeVisible()
    await expect(previewDialog.getByText('candidates')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(previewDialog).toBeHidden()

    await page.getByRole('tab', { name: 'Runs' }).click()
    await expect(page.getByText('Morning Brief')).toBeVisible()
    activePane = page.locator('.ant-tabs-tabpane-active')
    await activePane.locator('tbody tr').first().locator('button').first().click()
    const runDialog = page.getByRole('dialog', { name: 'Run Details' })
    await expect(runDialog).toBeVisible()
    await runDialog.getByRole('tab', { name: 'Logs' }).click()
    await expect(runDialog.getByText('Processing 2 items')).toBeVisible()
    await runDialog.getByRole('tab', { name: 'Scraped Items' }).click()
    await expect(runDialog.getByText('Example Item One')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(runDialog).toBeHidden()

    await page.getByRole('tab', { name: 'Outputs' }).click()
    await expect(page.getByText('Morning Brief Output')).toBeVisible()
    activePane = page.locator('.ant-tabs-tabpane-active')
    await activePane.locator('tbody tr').first().locator('button').first().click()
    const outputDialog = page.getByRole('dialog', { name: 'Morning Brief Output' })
    await expect(outputDialog).toBeVisible()
    await expect(outputDialog.getByText('Morning Brief')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(outputDialog).toBeHidden()

    await page.getByRole('tab', { name: 'Templates' }).click()
    await expect(page.getByText('daily-brief')).toBeVisible()
    activePane = page.locator('.ant-tabs-tabpane-active')
    await activePane.locator('tbody tr').first().locator('button').first().click()
    const templateDialog = page.getByRole('dialog', { name: 'Edit Template' })
    await expect(templateDialog).toBeVisible()
    await templateDialog.getByRole('tab', { name: 'Preview' }).click()
    await expect(
      templateDialog.getByText('Preview shows rendered markup')
    ).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(templateDialog).toBeHidden()

    await page.getByRole('tab', { name: 'Settings' }).click()
    await expect(page.getByText('Claim Clusters')).toBeVisible()
    await expect(page.getByText('Cluster about solar energy')).toBeVisible()

    await context.close()
  })
})
