import { test, expect } from "@playwright/test"
import http from "node:http"
import { AddressInfo } from "node:net"
import { launchWithBuiltExtension } from "./utils/extension-build"
import {
  waitForConnectionStore,
  forceConnected
} from "./utils/connection"

function startMediaMockServer(itemCount = 35) {
  const longContent = `START_MARKER ${"A".repeat(2100)} END_MARKER`
  const items = Array.from({ length: itemCount }, (_, idx) => {
    const id = idx + 1
    return {
      id,
      title: `Item ${id}`,
      snippet: `Snippet ${id}`,
      type: id % 2 === 0 ? "document" : "video"
    }
  })
  const details: Record<number, any> = {}
  items.forEach((item) => {
    details[item.id] = {
      id: item.id,
      title: item.title,
      type: item.type,
      content: item.id === 1 ? longContent : `Content for ${item.title}`
    }
  })

  const server = http.createServer((req, res) => {
    const url = req.url || ""
    const method = (req.method || "GET").toUpperCase()

    const writeJson = (code: number, body: any) => {
      res.writeHead(code, {
        "content-type": "application/json",
        "access-control-allow-origin": "http://127.0.0.1",
        "access-control-allow-credentials": "true"
      })
      res.end(JSON.stringify(body))
    }

    if (method === "OPTIONS") {
      res.writeHead(204, {
        "access-control-allow-origin": "http://127.0.0.1",
        "access-control-allow-credentials": "true",
        "access-control-allow-headers": "content-type, x-api-key, authorization"
      })
      return res.end()
    }

    if (url === "/api/v1/health" && method === "GET") {
      return writeJson(200, { status: "ok" })
    }

    if (url === "/api/v1/llm/models" && method === "GET") {
      return writeJson(200, ["mock/model"])
    }

    if (url.startsWith("/api/v1/media/") && !url.includes("search") && method === "GET") {
      const idStr = url.split("/").filter(Boolean).pop() || ""
      const id = Number(idStr)
      const detail = details[id]
      if (detail) return writeJson(200, detail)
      return writeJson(404, { detail: "not found" })
    }

    if (url.startsWith("/api/v1/media/search") && method === "POST") {
      return writeJson(200, { items, pagination: { total_items: items.length } })
    }

    if (url.startsWith("/api/v1/media") && method === "GET") {
      return writeJson(200, { items, pagination: { total_items: items.length } })
    }

    if (url === "/openapi.json" && method === "GET") {
      return writeJson(200, {
        openapi: "3.0.0",
        paths: {
          "/api/v1/media/": {},
          "/api/v1/media/search": {},
          "/api/v1/health": {},
          "/api/v1/llm/models": {}
        }
      })
    }

    return writeJson(404, { detail: "not found" })
  })

  return server
}

async function ensureConnected(page: any, label: string, serverUrl: string) {
  await page.waitForFunction(
    () => Boolean((window as any).__tldw_useConnectionStore?.getState)
  )
  await forceConnected(page, { serverUrl }, label)
  await page.waitForFunction(
    () => (window as any).__tldw_useConnectionStore?.getState?.().state?.isConnected === true
  )
}

test.describe("Media multi page", () => {
  let server: ReturnType<typeof startMediaMockServer> | null = null
  let baseUrl = ""

  test.beforeAll(async () => {
    server = startMediaMockServer()
    await new Promise<void>((resolve) =>
      server?.listen(0, "127.0.0.1", resolve)
    )
    const addr = server?.address() as AddressInfo
    baseUrl = `http://127.0.0.1:${addr.port}`
  })

  test.afterAll(async () => {
    if (!server) return
    await new Promise<void>((resolve) => server?.close(() => resolve()))
  })

  test("renders offline empty state (no crash)", async () => {
    const { context, page, optionsUrl } = await launchWithBuiltExtension()

    await page.goto(optionsUrl + "#/media-multi")
    await page.waitForLoadState("networkidle")

    const offlineHeadline = page.getByText(/Connect to use Media/i)
    await expect(offlineHeadline).toBeVisible()

    await context.close()
  })

  test("focus mode shows dropdown selector", async () => {
    const { context, page, optionsUrl } = await launchWithBuiltExtension({
      allowOffline: true,
      seedConfig: {
        serverUrl: baseUrl,
        authMode: "single-user",
        apiKey: "test-key"
      }
    })

    await page.goto(optionsUrl + "#/media-multi", { waitUntil: "networkidle" })
    await waitForConnectionStore(page, "media-multi-connected")
    await ensureConnected(page, "media-multi-connected", baseUrl)
    await expect(page.getByTestId("media-review-results-list")).toBeVisible()

    // Switch to Focus and assert dropdown appears
    const focusToggle = page.getByRole("radio", { name: /Focus/i })
    await focusToggle.click({ force: true })

    const picker = page.getByRole("combobox")
    await expect(picker).toBeVisible()

    await context.close()
  })

  test("keyboard shortcuts navigate, expand, and clear selection", async () => {
    const { context, page, optionsUrl } = await launchWithBuiltExtension({
      allowOffline: true,
      seedConfig: {
        serverUrl: baseUrl,
        authMode: "single-user",
        apiKey: "test-key"
      }
    })

    await page.goto(optionsUrl + "#/media-multi", { waitUntil: "networkidle" })
    await waitForConnectionStore(page, "media-multi-keyboard")
    await ensureConnected(page, "media-multi-keyboard", baseUrl)
    await expect(page.getByTestId("media-review-results-list")).toBeVisible()

    const firstRow = page.getByRole("button", { name: /Item 1/i })
    await firstRow.click()

    await expect(page.getByText("START_MARKER")).toBeVisible()
    await expect(page.getByText(/Item 1 of 35/)).toBeVisible()

    await page.keyboard.press("j")
    await expect(page.getByText(/Item 2 of 35/)).toBeVisible()

    await page.keyboard.press("k")
    await expect(page.getByText(/Item 1 of 35/)).toBeVisible()

    const tailMarker = page.getByText("END_MARKER")
    await expect(tailMarker).toBeHidden()
    await page.keyboard.press("o")
    await expect(tailMarker).toBeVisible()

    await page.keyboard.press("Escape")
    await expect(page.getByText("0 / 30")).toBeVisible()
    await expect(firstRow).toHaveAttribute("aria-selected", "false")

    await context.close()
  })

  test("view mode persists across reloads", async () => {
    const { context, page, optionsUrl } = await launchWithBuiltExtension({
      allowOffline: true,
      seedConfig: {
        serverUrl: baseUrl,
        authMode: "single-user",
        apiKey: "test-key"
      }
    })

    await page.goto(optionsUrl + "#/media-multi", { waitUntil: "networkidle" })
    await waitForConnectionStore(page, "media-multi-persist")
    await ensureConnected(page, "media-multi-persist", baseUrl)
    await expect(page.getByTestId("media-review-results-list")).toBeVisible()

    const stackToggle = page.getByRole("radio", { name: /Stack/i })
    await stackToggle.click({ force: true })
    await expect(stackToggle).toBeChecked()

    await page.reload({ waitUntil: "networkidle" })
    await waitForConnectionStore(page, "media-multi-persist-reload")
    await ensureConnected(page, "media-multi-persist-reload", baseUrl)
    await expect(page.getByTestId("media-review-results-list")).toBeVisible()
    await expect(page.getByRole("radio", { name: /Stack/i })).toBeChecked()

    await context.close()
  })

  test("selection limit caps at 30 items", async () => {
    const { context, page, optionsUrl } = await launchWithBuiltExtension({
      allowOffline: true,
      seedConfig: {
        serverUrl: baseUrl,
        authMode: "single-user",
        apiKey: "test-key"
      }
    })

    await page.goto(optionsUrl + "#/media-multi", { waitUntil: "networkidle" })
    await waitForConnectionStore(page, "media-multi-limit")
    await ensureConnected(page, "media-multi-limit", baseUrl)
    await expect(page.getByTestId("media-review-results-list")).toBeVisible()

    await page.getByRole("button", { name: /Options/i }).click()
    await page.getByRole("menuitem", { name: /Review all on page/i }).click()
    await expect(page.getByText("30 / 30")).toBeVisible()

    await page.evaluate(() => {
      const container = document.querySelector(
        '[data-testid="media-review-results-list"]'
      ) as HTMLElement | null
      if (container) {
        container.scrollTop = 4000
      }
    })

    const item31 = page.getByRole("button", { name: /Item 31/i })
    await item31.click()

    await expect(page.getByText(/Selection limit reached/i)).toBeVisible()
    await expect(page.getByText("30 / 30")).toBeVisible()
    await expect(item31).toHaveAttribute("aria-selected", "false")

    await context.close()
  })
})
