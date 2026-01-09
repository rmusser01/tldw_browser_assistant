import { test, expect } from "@playwright/test"
import path from "path"
import { launchWithExtension } from "./utils/extension"

const TEST_EXT_PATH = path.resolve(process.env.TLDW_E2E_EXT_PATH || "build/chrome-mv3")
const DEFAULT_SERVER_URL = "http://localhost:8000"
const SERVER_URL = process.env.TLDW_E2E_SERVER_URL || DEFAULT_SERVER_URL

const enableProMode = async (page: any) => {
  await page.evaluate(() => {
    if (typeof localStorage === "undefined") return
    localStorage.setItem(
      "tldw-ui-mode",
      JSON.stringify({ state: { mode: "pro" }, version: 0 })
    )
  })
}

test.describe("Artifacts split view", () => {
  test("shows inline table + mermaid with artifacts panel in Pro mode", async () => {
    const { context, page, optionsUrl } = await launchWithExtension(TEST_EXT_PATH, {
      seedConfig: {
        __tldw_first_run_complete: true,
        __tldw_allow_offline: true,
        serverUrl: SERVER_URL,
        authMode: "single-user",
        apiKey: ""
      }
    })

    try {
      await context.addInitScript(() => {
        if (typeof localStorage === "undefined") return
        localStorage.setItem(
          "tldw-ui-mode",
          JSON.stringify({ state: { mode: "pro" }, version: 0 })
        )
      })

      await page.goto(optionsUrl, { waitUntil: "domcontentloaded" })
      await page.waitForSelector("#root", { state: "attached", timeout: 15000 })

      await page.waitForFunction(
        () => Boolean((window as any).__tldw_useConnectionStore?.getState),
        null,
        { timeout: 15000 }
      )
      await page.evaluate(async () => {
        const store = (window as any).__tldw_useConnectionStore
        const actions = store?.getState?.()
        if (actions?.markFirstRunComplete) {
          await actions.markFirstRunComplete()
        } else if (store?.setState) {
          store.setState((prev: any) => ({
            ...prev,
            state: {
              ...(prev?.state || {}),
              hasCompletedFirstRun: true
            }
          }))
        }
        if (actions?.enableOfflineBypass) {
          await actions.enableOfflineBypass()
        }
      })

      await enableProMode(page)
      await page.reload({ waitUntil: "domcontentloaded" })
      await page.waitForSelector("#root", { state: "attached", timeout: 15000 })
      await page.waitForFunction(
        () => Boolean((window as any).__tldw_useConnectionStore?.getState),
        null,
        { timeout: 15000 }
      )
      await page.evaluate(async () => {
        const store = (window as any).__tldw_useConnectionStore
        const actions = store?.getState?.()
        if (actions?.markFirstRunComplete) {
          await actions.markFirstRunComplete()
        } else if (store?.setState) {
          store.setState((prev: any) => ({
            ...prev,
            state: {
              ...(prev?.state || {}),
              hasCompletedFirstRun: true
            }
          }))
        }
        if (actions?.enableOfflineBypass) {
          await actions.enableOfflineBypass()
        }
      })

      await page.waitForFunction(
        () => Boolean((window as any).__tldw_pageAssist?.setMessages),
        null,
        { timeout: 15000 }
      )

      const assistantMessage = [
        "Here is a table:",
        "",
        "| Name | Value |",
        "| --- | --- |",
        "| Alpha | 1 |",
        "| Beta | 2 |",
        "",
        "And a diagram:",
        "",
        "```mermaid",
        "graph TD",
        "  A[Start] --> B{Choice}",
        "  B -->|Yes| C[Do thing]",
        "  B -->|No| D[Other]",
        "```"
      ].join("\n")

      await page.evaluate((message) => {
        const hook = (window as any).__tldw_pageAssist
        hook?.setMessages?.([
          {
            id: "synthetic-user",
            isBot: false,
            name: "User",
            message: "Show me a table and a mermaid diagram.",
            sources: []
          },
          {
            id: "synthetic-assistant",
            isBot: true,
            name: "Assistant",
            message,
            sources: []
          }
        ])
      }, assistantMessage)

      await expect(page.getByText("Alpha", { exact: true })).toBeVisible({
        timeout: 15000
      })
      await expect(page.getByText("Beta", { exact: true })).toBeVisible({
        timeout: 15000
      })
      await expect(page.getByText(/^mermaid$/i)).toBeVisible({ timeout: 15000 })

      const artifactsPanel = page.getByTestId("artifacts-panel").first()
      if (!(await artifactsPanel.isVisible())) {
        const viewButton = page
          .locator('[data-testid="chat-message"]')
          .getByRole("button", { name: /^view$/i })
          .first()
        await viewButton.click({ timeout: 15000 })
      }
      await expect(artifactsPanel).toBeVisible({ timeout: 15000 })

      await expect
        .poll(
          async () => {
            const diagramCount = await artifactsPanel
              .locator('[aria-label="Mermaid diagram"]')
              .count()
            const tableCount = await artifactsPanel.locator("table").count()
            return diagramCount + tableCount
          },
          { timeout: 15000 }
        )
        .toBeGreaterThan(0)
    } finally {
      await context.close()
    }
  })
})
