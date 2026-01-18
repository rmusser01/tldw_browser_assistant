import { test, expect } from "@playwright/test"
import path from "path"

import { launchWithExtension } from "./utils/extension"

test.describe("Collections playground", () => {
  test("supports reading list, highlights, templates, and imports", async () => {
    const log = (message: string, data?: unknown) => {
      const suffix =
        data === undefined ? "" : ` ${typeof data === "string" ? data : JSON.stringify(data)}`
      console.log(`[collections.e2e] ${new Date().toISOString()} ${message}${suffix}`)
    }
    const logStep = async <T>(label: string, fn: () => Promise<T>): Promise<T> => {
      log(`START ${label}`)
      try {
        const result = await fn()
        log(`END ${label}`)
        return result
      } catch (error) {
        log(`ERROR ${label}`, {
          message: error instanceof Error ? error.message : String(error)
        })
        throw error
      }
    }

    const extPath = path.resolve("build/chrome-mv3")
    log("launching extension", { extPath })
    const { context, page: basePage, optionsUrl } = await logStep("launchWithExtension", () =>
      launchWithExtension(extPath, {
        seedConfig: {
          __tldw_first_run_complete: true,
          __tldw_allow_offline: true,
          tldwConfig: {
            serverUrl: "http://127.0.0.1:8000",
            authMode: "single-user",
            apiKey: "test-key"
          }
        }
      })
    )
    log("extension launched", { optionsUrl })

    await logStep("addInitScript", async () => {
      await context.addInitScript(() => {
      const now = () => new Date().toISOString()
      let nextItemId = 1
      let nextHighlightId = 1
      let nextTemplateId = 1
      let nextOutputId = 1

      const readingItems = []
      const highlights = []
      const templates = []
      const outputs = new Map()

      const findItem = (id) => readingItems.find((item) => String(item.id) === String(id))
      const findTemplate = (id) => templates.find((template) => String(template.id) === String(id))

      const handleRequest = (payload) => {
        const path = payload?.path || ""
        const method = String(payload?.method || "GET").toUpperCase()
        const body = payload?.body || null
        const fields = payload?.fields || {}
        const [pathname, queryString] = path.split("?")
        const query = new URLSearchParams(queryString || "")

        if (pathname === "/api/v1/health" && method === "GET") {
          return { status: "ok" }
        }

        if (pathname === "/api/v1/rag/health" && method === "GET") {
          return { components: { search_index: { status: "healthy" } } }
        }

        if (pathname === "/api/v1/reading/items" && method === "GET") {
          return {
            items: readingItems,
            total: readingItems.length,
            page: Number(query.get("page") || 1),
            size: Number(query.get("size") || 20)
          }
        }

        if (pathname === "/api/v1/reading/save" && method === "POST") {
          const url = body?.url || "https://example.com/article"
          const title = body?.title || "Untitled"
          const domain = (() => {
            try {
              return new URL(url).hostname
            } catch {
              return "example.com"
            }
          })()
          const item = {
            id: nextItemId++,
            url,
            canonical_url: url,
            domain,
            title,
            summary: body?.summary || "",
            notes: body?.notes || "",
            status: body?.status || "saved",
            favorite: Boolean(body?.favorite),
            tags: body?.tags || [],
            reading_time_minutes: 5,
            created_at: now(),
            updated_at: now(),
            published_at: now()
          }
          readingItems.unshift(item)
          return item
        }

        if (
          pathname?.startsWith("/api/v1/reading/items/") &&
          method === "GET" &&
          pathname.split("/").length === 6
        ) {
          const itemId = pathname.split("/").pop()
          const item = findItem(itemId)
          if (!item) return {}
          return {
            ...item,
            text: `Full text for ${item.title}`,
            clean_html: `<p>${item.title} content</p>`,
            notes: item.notes || "",
            summary: item.summary || ""
          }
        }

        if (
          pathname?.startsWith("/api/v1/reading/items/") &&
          method === "PATCH" &&
          pathname.split("/").length === 6
        ) {
          const itemId = pathname.split("/").pop()
          const item = findItem(itemId)
          if (!item) return {}
          Object.assign(item, body || {})
          item.updated_at = now()
          return item
        }

        if (
          pathname?.startsWith("/api/v1/reading/items/") &&
          method === "DELETE" &&
          pathname.split("/").length === 6
        ) {
          const itemId = pathname.split("/").pop()
          const idx = readingItems.findIndex((item) => String(item.id) === String(itemId))
          if (idx >= 0) readingItems.splice(idx, 1)
          return { status: "deleted", item_id: Number(itemId), hard: true }
        }

        if (pathname?.endsWith("/highlights") && pathname.includes("/api/v1/reading/items/") && method === "GET") {
          const itemId = pathname.split("/")[5]
          return highlights.filter((highlight) => String(highlight.item_id) === String(itemId))
        }

        if (pathname?.endsWith("/highlight") && pathname.includes("/api/v1/reading/items/") && method === "POST") {
          const itemId = pathname.split("/")[5]
          const item = findItem(itemId)
          const highlight = {
            id: nextHighlightId++,
            item_id: Number(body?.item_id || itemId),
            item_title: item?.title || "Untitled",
            quote: body?.quote || "",
            note: body?.note || "",
            color: body?.color || "yellow",
            state: "active",
            anchor_strategy: body?.anchor_strategy || "fuzzy_quote",
            created_at: now()
          }
          highlights.unshift(highlight)
          return highlight
        }

        if (pathname?.startsWith("/api/v1/reading/highlights/") && method === "PATCH") {
          const highlightId = pathname.split("/").pop()
          const highlight = highlights.find((h) => String(h.id) === String(highlightId))
          if (!highlight) return {}
          if (body?.note !== undefined) highlight.note = body.note
          if (body?.color) highlight.color = body.color
          if (body?.state) highlight.state = body.state
          return highlight
        }

        if (pathname?.startsWith("/api/v1/reading/highlights/") && method === "DELETE") {
          const highlightId = pathname.split("/").pop()
          const idx = highlights.findIndex((h) => String(h.id) === String(highlightId))
          if (idx >= 0) highlights.splice(idx, 1)
          return { success: true }
        }

        if (pathname === "/api/v1/outputs/templates" && method === "GET") {
          return { items: templates, total: templates.length }
        }

        if (pathname === "/api/v1/outputs/templates" && method === "POST") {
          const template = {
            id: nextTemplateId++,
            name: body?.name || "Template",
            description: body?.description || "",
            type: body?.type || "newsletter_markdown",
            format: body?.format || "md",
            body: body?.body || "",
            is_default: false,
            created_at: now(),
            updated_at: now()
          }
          templates.unshift(template)
          return template
        }

        if (pathname?.startsWith("/api/v1/outputs/templates/") && method === "PATCH") {
          const templateId = pathname.split("/").pop()
          const template = templates.find((t) => String(t.id) === String(templateId))
          if (!template) return {}
          if (body?.name) template.name = body.name
          if (body?.description !== undefined) template.description = body.description
          if (body?.body !== undefined) template.body = body.body
          template.updated_at = now()
          return template
        }

        if (pathname?.startsWith("/api/v1/outputs/templates/") && pathname.endsWith("/preview") && method === "POST") {
          const templateId = pathname.split("/")[5]
          const template = findTemplate(templateId)
          const count = Array.isArray(body?.data?.items) ? body.data.items.length : (body?.item_ids || []).length
          return {
            rendered: `Preview for ${count} items`,
            format: template?.format || "md"
          }
        }

        if (pathname?.startsWith("/api/v1/outputs/templates/") && method === "DELETE") {
          const templateId = pathname.split("/").pop()
          const idx = templates.findIndex((t) => String(t.id) === String(templateId))
          if (idx >= 0) templates.splice(idx, 1)
          return { success: true }
        }

        if (pathname === "/api/v1/outputs" && method === "POST") {
          const template = findTemplate(body?.template_id)
          const count = Array.isArray(body?.data?.items) ? body.data.items.length : (body?.item_ids || []).length
          const output = {
            id: Number(nextOutputId++),
            title: body?.title || template?.name || "Output",
            type: template?.type || "newsletter_markdown",
            format: template?.format || "md",
            storage_path: `output-${Date.now()}.${template?.format || "md"}`,
            created_at: now()
          }
          outputs.set(String(output.id), {
            content: `Generated output for ${count} items`,
            format: output.format
          })
          return output
        }

        if (pathname?.startsWith("/api/v1/outputs/") && pathname.endsWith("/download") && method === "GET") {
          const outputId = pathname.split("/")[4]
          const entry = outputs.get(String(outputId))
          const content = entry?.content || "Generated output"
          return new TextEncoder().encode(content).buffer
        }

        if (pathname === "/api/v1/reading/import" && method === "POST") {
          return {
            source: fields?.source || "auto",
            imported: 2,
            updated: 0,
            skipped: 0,
            errors: []
          }
        }

        if (pathname === "/api/v1/reading/export" && method === "GET") {
          const format = query.get("format") || "jsonl"
          if (format === "zip") {
            return {
              __rawResponse: true,
              data: new Uint8Array([0x50, 0x4b, 0x03, 0x04]).buffer,
              headers: {
                "content-disposition": "attachment; filename=reading_export.zip",
                "content-type": "application/zip"
              }
            }
          }
          const payload = readingItems
            .map((item) => JSON.stringify({ url: item.url, title: item.title }))
            .join("\n")
          return {
            __rawResponse: true,
            data: new TextEncoder().encode(payload).buffer,
            headers: {
              "content-disposition": "attachment; filename=reading_export.jsonl",
              "content-type": "application/x-ndjson"
            }
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
            try {
              const result = handleRequest(message.payload || {})
              if (result?.__rawResponse) {
                return respond({
                  ok: true,
                  status: result.status || 200,
                  data: result.data,
                  headers: result.headers || {}
                })
              }
              return respond({ ok: true, status: 200, data: result })
            } catch (error) {
              return respond({ ok: false, status: 500, error: String(error || "") })
            }
          }
          if (message?.type === "tldw:upload") {
            try {
              const result = handleRequest(message.payload || {})
              if (result?.__rawResponse) {
                return respond({
                  ok: true,
                  status: result.status || 200,
                  data: result.data,
                  headers: result.headers || {}
                })
              }
              return respond({ ok: true, status: 200, data: result })
            } catch (error) {
              return respond({ ok: false, status: 500, error: String(error || "") })
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

      window["__clipboard"] = ""
      const clipboardShim = {
        writeText: async (text) => {
          window["__clipboard"] = text
        }
      }
      try {
        Object.defineProperty(navigator, "clipboard", {
          value: clipboardShim,
          configurable: true
        })
      } catch {
        // ignore clipboard override failures
      }

      window.__collectionsStubbed = true
      })
    })

    const page = await logStep("context.newPage", () => context.newPage())
    await logStep("page.goto collections", async () => {
      await page.goto(optionsUrl + "?e2e=1#/collections", { waitUntil: "domcontentloaded" })
      await page.waitForFunction(() => window.__collectionsStubbed === true)
      const url = page.url()
      log("page loaded", { url })
    })
    await logStep("close base page", async () => {
      await basePage.close().catch(() => {})
    })

    const addReadingItem = async (title: string, url: string) => {
      await page.getByRole("tab", { name: "Reading List" }).click()
      await page.getByRole("button", { name: "Add URL" }).click()
      const addDialog = page.getByRole("dialog", { name: "Add to Reading List" })
      await addDialog.getByLabel("URL").fill(url)
      await addDialog.getByLabel("Title (optional)").fill(title)
      await addDialog.getByRole("button", { name: "Save to List" }).click()
      await expect(addDialog).toBeHidden()
      await expect(page.getByText(title)).toBeVisible()
    }

    await logStep("assert Collections heading", async () => {
      await expect(page.getByRole("heading", { name: "Collections" })).toBeVisible()
    })

    await logStep("add reading list item", async () => {
      await addReadingItem("Example Article", "https://example.com/article")
    })

    const drawer = page.locator(".ant-drawer-content")
    await logStep("open reading item drawer + add highlight", async () => {
      await page.getByText("Example Article").first().click()
      await expect(drawer.getByRole("heading", { name: "Example Article" })).toBeVisible()
      await drawer.evaluate((el) => {
        el.scrollTop = 0
      })
      const highlightsTab = drawer.getByRole("tab", { name: "Highlights" })
      await highlightsTab.waitFor({ state: "attached" })
      await highlightsTab.evaluate((el) => (el as HTMLElement).click())
      const quoteField = drawer.getByLabel("Quote")
      await expect(quoteField).toBeVisible()
      await quoteField.fill("A useful highlight")
      await drawer.getByLabel("Note (optional)").fill("Important note")
      await drawer.getByRole("button", { name: "Add Highlight" }).click()
      await expect(drawer.getByText("A useful highlight")).toBeVisible()
      await drawer.locator(".ant-drawer-close").click()
      await expect(drawer).toBeHidden()
    })

    await logStep("edit highlight in highlights tab", async () => {
      await page.getByRole("tab", { name: "Highlights" }).click()
      await expect(page.getByText("A useful highlight")).toBeVisible()
      const highlightCard = page
        .locator("blockquote", { hasText: "A useful highlight" })
        .locator("..")
        .locator("..")
      await highlightCard.hover()
      await highlightCard.locator("button").nth(1).click()
      const editDialog = page.getByRole("dialog", { name: "Edit Highlight" })
      await expect(editDialog).toBeVisible()
      await editDialog.getByLabel("Note (optional)").fill("Updated note")
      await editDialog.getByRole("button", { name: "Save" }).click()
      await expect(editDialog).toBeHidden()
      await expect(page.getByText("Updated note")).toBeVisible()
    })

    await logStep("add extra reading list items", async () => {
      await addReadingItem("Second Article", "https://example.com/second")
      await addReadingItem("Third Article", "https://example.com/third")
    })

    await logStep("create template + generate preview/output", async () => {
      await page.getByRole("tab", { name: "Templates" }).click()
      await page.getByRole("button", { name: "Create Template" }).click()
      const templateDialog = page.getByRole("dialog", { name: "Create Template" })
      await templateDialog.getByLabel("Template Name").fill("Weekly Digest")
      await templateDialog.getByRole("button", { name: "Create" }).click()
      await expect(templateDialog).toBeHidden()
      await expect(page.getByText("Weekly Digest")).toBeVisible()
      const templateCard = page.locator(".ant-card").filter({ hasText: "Weekly Digest" }).first()
      await templateCard.locator("button").first().click()
      const previewDialog = page.getByRole("dialog", { name: "Template Preview" })
      await expect(previewDialog).toBeVisible()
      await previewDialog.getByRole("checkbox", { name: "Select All" }).click()
      await previewDialog.getByRole("button", { name: "Generate Preview" }).click()
      await expect(previewDialog.getByText("Preview for")).toBeVisible()
      await previewDialog.getByRole("button", { name: "Generate Output" }).click()
      await expect(previewDialog.getByText("Generated output")).toBeVisible()
      await previewDialog
        .locator(".ant-modal-footer")
        .getByRole("button", { name: "Close" })
        .click()
      await expect(previewDialog).toBeHidden()
    })

    await logStep("import pocket file", async () => {
      await page.getByRole("tab", { name: "Import/Export" }).click()
      await page.getByRole("button", { name: /^Pocket/ }).click()
      await expect(page.getByText("Click or drag file to upload")).toBeVisible()
      await page.locator("input[type=\"file\"]").setInputFiles({
        name: "pocket.json",
        mimeType: "application/json",
        buffer: Buffer.from(JSON.stringify({ list: {} }))
      })
      await expect(page.getByText("Import Complete")).toBeVisible()
    })

    await logStep("export selection + clipboard + zip", async () => {
      const exportCard = page.locator(".ant-card").filter({ hasText: "Export" }).first()
      await expect(exportCard.getByText("Example Article")).toBeVisible()
      log("export card ready")
      const exportList = exportCard.getByRole("listbox", { name: "Export items list" })
      const exportOptions = exportList.locator("[role=\"option\"]")
      const optionCount = await exportOptions.count()
      expect(optionCount).toBeGreaterThanOrEqual(3)

      const selectedCount = exportCard.locator("[aria-live=\"polite\"]")
      await exportOptions.nth(0).getByRole("checkbox").click()
      await exportOptions.nth(2).getByRole("checkbox").click({ modifiers: ["Shift"] })
      await expect(selectedCount).toHaveText("3 selected")

      await exportCard.getByRole("button", { name: "Clear" }).click()
      await expect(selectedCount).toHaveText("0 selected")

      await exportOptions.nth(0).getByRole("checkbox").click()
      await expect(selectedCount).toHaveText("1 selected")
      await exportList.press("ArrowDown")
      await exportList.press("Space")
      await expect(selectedCount).toHaveText("2 selected")

      await exportCard.getByRole("button", { name: "Clear" }).click()
      await expect(selectedCount).toHaveText("0 selected")

      await page.waitForFunction(() => typeof window.__tldw_exportSelectByTitle === "function")
      const selectedCountByTitle = await page.evaluate(
        () => window.__tldw_exportSelectByTitle?.("Example Article") ?? 0
      )
      log("selected count after select", { selectedCount: selectedCountByTitle })
      expect(selectedCountByTitle).toBe(1)
      await page.waitForFunction(() => window.__tldw_exportSelectedCount === 1)
      const copyButton = page.getByRole("button", { name: "Copy JSONL" })
      await expect(copyButton).toBeEnabled()
      await copyButton.click()
      const clipboardValue = await page.evaluate(() => window["__clipboard"] || "")
      log("clipboard length", { length: clipboardValue.length })
      expect(clipboardValue).toContain("Example Article")

      await page.evaluate(() => window.__tldw_exportClearSelection?.())
      await page.waitForFunction(() => window.__tldw_exportSelectedCount === 0)
      log("selection cleared", {
        selectedCount: await page.evaluate(() => window.__tldw_exportSelectedCount)
      })
      await page.waitForFunction(() => typeof window.__tldw_exportSetFormat === "function")
      await page.evaluate(() => window.__tldw_exportSetFormat?.("zip"))
      await page.waitForFunction(() => window.__tldw_exportFormat === "zip")
      log("export format set", {
        format: await page.evaluate(() => window.__tldw_exportFormat)
      })
      await page.getByRole("button", { name: "Download Export" }).click()
      await page.waitForFunction(() => window.__tldw_lastDownload?.filename?.includes(".zip"))
      const lastDownload = await page.evaluate(() => window.__tldw_lastDownload)
      log("last download", lastDownload)
      expect(lastDownload?.filename).toContain(".zip")
    })
  })
})
