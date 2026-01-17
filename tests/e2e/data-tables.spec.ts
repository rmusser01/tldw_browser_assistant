import { test, expect } from "@playwright/test"
import path from "path"

import { launchWithExtension } from "./utils/extension"

test.describe("Data Tables", () => {
  test("generates a table from documents and exports CSV", async () => {
    const extPath = path.resolve("build/chrome-mv3")
    const { context, page: basePage, optionsUrl } = await launchWithExtension(extPath, {
      seedConfig: {
        __tldw_first_run_complete: true,
        __tldw_allow_offline: true
      }
    })

    await context.addInitScript(() => {
      const now = () => new Date().toISOString()
      const mediaItems = [
        { id: 101, title: "Product Spec", type: "document", url: "/api/v1/media/101" },
        { id: 102, title: "Price Sheet", type: "pdf", url: "/api/v1/media/102" }
      ]
      let latestTableDetail = null
      let latestJobId = 100
      const tables = []

      const toPagination = (items) => ({
        page: 1,
        results_per_page: 50,
        total_pages: 1,
        total_items: items.length
      })

      const buildTableDetail = (body) => {
        const uuid = "tbl-123"
        const createdAt = now()
        const summary = {
          uuid,
          name: body?.name || "Generated Table",
          description: body?.description || null,
          prompt: body?.prompt || "",
          status: "ready",
          row_count: 2,
          column_count: 2,
          source_count: Array.isArray(body?.sources) ? body.sources.length : 0,
          generation_model: "test-model",
          created_at: createdAt,
          updated_at: createdAt
        }
        return {
          table: summary,
          columns: [
            { column_id: "col-1", name: "Product", type: "text", position: 0 },
            { column_id: "col-2", name: "Price", type: "number", position: 1 }
          ],
          rows: [
            { row_id: "row-1", row_index: 0, data: { "col-1": "Widget", "col-2": 10 } },
            { row_id: "row-2", row_index: 1, data: { "col-1": "Gadget", "col-2": 20 } }
          ],
          sources: (body?.sources || []).map((src) => ({
            source_type: src.source_type || src.type,
            source_id: src.source_id || src.id,
            title: src.title || null
          }))
        }
      }

      const handleRequest = (payload) => {
        const path = payload?.path || ""
        const method = (payload?.method || "GET").toUpperCase()
        const body = payload?.body || null
        const [pathname] = path.split("?")

        if (pathname === "/api/v1/data-tables" && method === "GET") {
          return { tables, count: tables.length, limit: 50, offset: 0 }
        }

        if (pathname === "/api/v1/data-tables/generate" && method === "POST") {
          latestTableDetail = buildTableDetail(body)
          latestJobId += 1
          return {
            job_id: latestJobId,
            status: "queued",
            table: { ...latestTableDetail.table, status: "queued" }
          }
        }

        const jobMatch = pathname.match(/^\/api\/v1\/data-tables\/jobs\/(\d+)$/)
        if (jobMatch && method === "GET") {
          return {
            id: Number(jobMatch[1]),
            status: "completed",
            table_uuid: latestTableDetail?.table?.uuid
          }
        }

        const detailMatch = pathname.match(/^\/api\/v1\/data-tables\/([^/]+)$/)
        if (detailMatch && method === "GET") {
          const tableId = detailMatch[1]
          if (latestTableDetail?.table?.uuid === tableId) {
            return latestTableDetail
          }
          return {
            table: {
              uuid: tableId,
              name: "Unknown Table",
              prompt: "",
              status: "ready",
              row_count: 0,
              column_count: 0,
              source_count: 0,
              created_at: now(),
              updated_at: now()
            },
            columns: [],
            rows: [],
            sources: []
          }
        }

        if (detailMatch && method === "PATCH") {
          const tableId = detailMatch[1]
          if (latestTableDetail && latestTableDetail.table.uuid === tableId) {
            if (body?.name) latestTableDetail.table.name = body.name
            if (body?.description !== undefined) {
              latestTableDetail.table.description = body.description
            }
            latestTableDetail.table.updated_at = now()
            const summary = {
              uuid: latestTableDetail.table.uuid,
              name: latestTableDetail.table.name,
              description: latestTableDetail.table.description,
              row_count: latestTableDetail.table.row_count,
              column_count: latestTableDetail.table.column_count,
              created_at: latestTableDetail.table.created_at,
              updated_at: latestTableDetail.table.updated_at,
              source_count: latestTableDetail.table.source_count
            }
            const idx = tables.findIndex((t) => t.uuid === summary.uuid)
            if (idx === -1) {
              tables.push(summary)
            } else {
              tables[idx] = summary
            }
          }
          return latestTableDetail?.table || { uuid: tableId }
        }

        if (pathname === "/api/v1/media" && method === "GET") {
          return {
            items: mediaItems,
            pagination: toPagination(mediaItems)
          }
        }

        if (pathname === "/api/v1/media/search" && method === "POST") {
          const query = String(body?.query || "").toLowerCase()
          const filtered = query
            ? mediaItems.filter((item) => item.title.toLowerCase().includes(query))
            : mediaItems
          return {
            items: filtered,
            results: filtered,
            pagination: toPagination(filtered)
          }
        }

        return {}
      }

      const patchRuntime = (runtime) => {
        if (!runtime?.sendMessage) return
        const original = runtime.sendMessage.bind(runtime)
        const handler = (message, options, callback) => {
          const cb = typeof options === "function" ? options : callback
          const respond = (payload) => {
            if (cb) {
              cb(payload)
              return undefined
            }
            return Promise.resolve(payload)
          }

          if (message?.type === "tldw:request") {
            const payload = message.payload || {}
            const method = (payload?.method || "GET").toUpperCase()
            const path = payload?.path || ""
            try {
              const data = handleRequest(payload)
              return respond({ ok: true, status: 200, data })
            } catch (error) {
              return respond({
                ok: false,
                status: 500,
                error: String(error || "")
              })
            }
          }
          if (original) {
            return original(message, options, callback)
          }
          return respond({ ok: true, status: 200, data: {} })
        }
        try {
          runtime.sendMessage = handler
          return
        } catch {}
        try {
          Object.defineProperty(runtime, "sendMessage", {
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

      window.__dataTablesStubbed = true
    })

    const page = await context.newPage()
    await page.goto(optionsUrl + "?e2e=1#/data-tables", {
      waitUntil: "domcontentloaded"
    })
    await page.waitForFunction(() => window.__dataTablesStubbed === true)
    await basePage.close().catch(() => {})

    await expect(page.getByRole("heading", { name: "Data Tables Studio" })).toBeVisible()
    await page.getByRole("tab", { name: /Create Table/i }).click()

    await page.getByText("Documents", { exact: true }).click()
    await page.getByText("Product Spec").click()
    await page.getByRole("button", { name: /^Next$/i }).click()

    await page
      .getByPlaceholder(/Enter a name for your table/i)
      .fill("Pricing Table")
    await page
      .getByPlaceholder(/Create a table comparing/i)
      .fill("List products with their prices")
    await page.getByRole("button", { name: /^Next$/i }).click()

    await expect(page.getByText("Widget")).toBeVisible()
    await page.getByRole("button", { name: /^Next$/i }).click()

    await page.getByRole("button", { name: "Save to Library" }).click()
    await expect(page.getByText("Table Saved!")).toBeVisible()

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "CSV" }).click()
    ])
    expect(await download.path()).not.toBeNull()
  })
})
