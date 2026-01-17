import { test, expect } from "@playwright/test"
import path from "path"

import { launchWithExtension } from "./utils/extension"

test.describe("Collections playground", () => {
  test("supports reading list, highlights, templates, and imports", async () => {
    const extPath = path.resolve("build/chrome-mv3")
    const { context, page, optionsUrl } = await launchWithExtension(extPath, {
      seedConfig: {
        __tldw_first_run_complete: true,
        __tldw_allow_offline: true
      }
    })

    await context.addInitScript(() => {
      const now = () => new Date().toISOString()
      let nextItemId = 1
      let nextHighlightId = 1
      let nextTemplateId = 1

      const readingItems = []
      const highlights = []
      const templates = []

      const findItem = (id) => readingItems.find((item) => String(item.id) === String(id))

      const handleRequest = (payload) => {
        const path = payload?.path || ""
        const method = String(payload?.method || "GET").toUpperCase()
        const body = payload?.body || null
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
            page: 1,
            page_size: 20,
            pages: 1
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
            id: String(nextItemId++),
            url,
            title,
            domain,
            excerpt: `${title} excerpt`,
            status: "saved",
            is_favorite: false,
            tags: body?.tags || [],
            reading_time_minutes: 5,
            created_at: now(),
            updated_at: now()
          }
          readingItems.unshift(item)
          return item
        }

        if (pathname?.startsWith("/api/v1/reading/items/") && method === "GET") {
          const itemId = pathname.split("/").pop()
          const item = findItem(itemId)
          if (!item) return {}
          return {
            ...item,
            content: `<p>${item.title} content</p>`,
            notes: item.notes || "",
            summary: item.summary || ""
          }
        }

        if (pathname?.startsWith("/api/v1/reading/items/") && method === "PUT") {
          const itemId = pathname.split("/").pop()
          const item = findItem(itemId)
          if (!item) return {}
          Object.assign(item, body || {})
          item.updated_at = now()
          return item
        }

        if (pathname?.startsWith("/api/v1/reading/items/") && method === "DELETE") {
          const itemId = pathname.split("/").pop()
          const idx = readingItems.findIndex((item) => String(item.id) === String(itemId))
          if (idx >= 0) readingItems.splice(idx, 1)
          return { ok: true }
        }

        if (pathname === "/api/v1/reading/highlights" && method === "GET") {
          const readingItemId = query.get("reading_item_id")
          const color = query.get("color")
          const filtered = highlights.filter((highlight) => {
            if (readingItemId && String(highlight.reading_item_id) !== String(readingItemId)) {
              return false
            }
            if (color && highlight.color !== color) {
              return false
            }
            return true
          })
          return { highlights: filtered, total: filtered.length, page: 1, page_size: 20, pages: 1 }
        }

        if (pathname === "/api/v1/reading/highlights" && method === "POST") {
          const item = findItem(body?.reading_item_id)
          const highlight = {
            id: String(nextHighlightId++),
            reading_item_id: body?.reading_item_id,
            reading_item_title: item?.title || "Untitled",
            quote: body?.quote || "",
            note: body?.note || "",
            color: body?.color || "yellow",
            state: "active",
            anchoring_strategy: "fuzzy_quote",
            created_at: now(),
            updated_at: now()
          }
          highlights.unshift(highlight)
          return highlight
        }

        if (pathname?.startsWith("/api/v1/reading/highlights/") && method === "PUT") {
          const highlightId = pathname.split("/").pop()
          const highlight = highlights.find((h) => String(h.id) === String(highlightId))
          if (!highlight) return {}
          if (body?.note !== undefined) highlight.note = body.note
          if (body?.color) highlight.color = body.color
          highlight.updated_at = now()
          return highlight
        }

        if (pathname?.startsWith("/api/v1/reading/highlights/") && method === "DELETE") {
          const highlightId = pathname.split("/").pop()
          const idx = highlights.findIndex((h) => String(h.id) === String(highlightId))
          if (idx >= 0) highlights.splice(idx, 1)
          return { ok: true }
        }

        if (pathname === "/api/v1/outputs/templates" && method === "GET") {
          return { templates, total: templates.length, page: 1, page_size: 20, pages: 1 }
        }

        if (pathname === "/api/v1/outputs/templates" && method === "POST") {
          const template = {
            id: String(nextTemplateId++),
            name: body?.name || "Template",
            description: body?.description || "",
            template_type: body?.template_type || "newsletter_markdown",
            format: body?.format || "markdown",
            body: body?.body || "",
            is_default: false,
            created_at: now(),
            updated_at: now()
          }
          templates.unshift(template)
          return template
        }

        if (pathname?.startsWith("/api/v1/outputs/templates/") && method === "PUT") {
          const templateId = pathname.split("/").pop()
          const template = templates.find((t) => String(t.id) === String(templateId))
          if (!template) return {}
          if (body?.name) template.name = body.name
          if (body?.description !== undefined) template.description = body.description
          if (body?.body !== undefined) template.body = body.body
          template.updated_at = now()
          return template
        }

        if (pathname?.startsWith("/api/v1/outputs/templates/") && method === "DELETE") {
          const templateId = pathname.split("/").pop()
          const idx = templates.findIndex((t) => String(t.id) === String(templateId))
          if (idx >= 0) templates.splice(idx, 1)
          return { ok: true }
        }

        if (pathname === "/api/v1/outputs/templates/preview" && method === "POST") {
          const count = (body?.reading_item_ids || []).length
          return { rendered_content: `Preview for ${count} items`, format: "markdown" }
        }

        if (pathname === "/api/v1/outputs/generate" && method === "POST") {
          const count = (body?.reading_item_ids || []).length
          return { content: `Generated output for ${count} items`, format: "markdown" }
        }

        if (pathname === "/api/v1/reading/import/preview" && method === "POST") {
          return {
            items: [
              { url: "https://example.com/import-1", title: "Imported One" },
              { url: "https://example.com/import-2", title: "Imported Two" }
            ],
            total: 2
          }
        }

        if (pathname === "/api/v1/reading/import/confirm" && method === "POST") {
          const count = Array.isArray(body?.items) ? body.items.length : 0
          return { imported: count, skipped: 0, errors: [] }
        }

        if (pathname === "/api/v1/reading/export" && method === "POST") {
          return { download_url: "https://example.com/export.json", filename: "export.json" }
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
              const data = handleRequest(message.payload || {})
              return respond({ ok: true, status: 200, data })
            } catch (error) {
              return respond({ ok: false, status: 500, error: String(error || "") })
            }
          }
          if (message?.type === "tldw:upload") {
            try {
              const data = handleRequest(message.payload || {})
              return respond({ ok: true, status: 200, data })
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
    })

    await page.goto(optionsUrl + "#/collections", { waitUntil: "domcontentloaded" })

    await expect(page.getByRole("heading", { name: "Collections" })).toBeVisible()

    await page.getByRole("button", { name: "Add URL" }).click()
    const addDialog = page.getByRole("dialog", { name: "Add to Reading List" })
    await addDialog.getByLabel("URL").fill("https://example.com/article")
    await addDialog.getByLabel("Title (optional)").fill("Example Article")
    await addDialog.getByRole("button", { name: "Save to List" }).click()
    await expect(addDialog).toBeHidden()
    await expect(page.getByText("Example Article")).toBeVisible()

    await page.getByText("Example Article").first().click()
    const drawer = page.locator(".ant-drawer-content")
    await expect(drawer.getByText("Example Article")).toBeVisible()
    await drawer.getByRole("tab", { name: "Highlights" }).click()
    await drawer.getByLabel("Quote").fill("A useful highlight")
    await drawer.getByLabel("Note (optional)").fill("Important note")
    await drawer.getByRole("button", { name: "Add Highlight" }).click()
    await expect(drawer.getByText("A useful highlight")).toBeVisible()
    await page.keyboard.press("Escape")
    await expect(drawer).toBeHidden()

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
    await previewDialog.getByRole("button", { name: "Close" }).click()
    await expect(previewDialog).toBeHidden()

    await page.getByRole("tab", { name: "Import/Export" }).click()
    await page.getByRole("button", { name: "Pocket" }).click()
    await page.getByRole("radio", { name: "API Key" }).click()
    await page.getByLabel("API Key").fill("test-key")
    await page.getByRole("button", { name: "Preview Import" }).click()
    await expect(page.getByText("items found")).toBeVisible()
    await page.getByRole("button", { name: "Import 2 items" }).click()
    await expect(page.getByText("Import Complete")).toBeVisible()
  })
})
