/**
 * Performance smoke test that does not require a live API key.
 *
 * Uses synthetic messages to ensure long-history rendering is exercised
 * without hitting the server.
 */

import { test, expect } from "@playwright/test"
import path from "path"
import { launchWithExtension } from "./utils/extension"
import { injectSyntheticMessages } from "./utils/synthetic-messages"
import { countDOMNodes, createReport, logReport, PerfTimer } from "./utils/performance"

const TEST_EXT_PATH = path.resolve(process.env.TLDW_E2E_EXT_PATH || "build/chrome-mv3")
const DEFAULT_SERVER_URL = "http://localhost:8000"
const SERVER_URL = process.env.TLDW_E2E_SERVER_URL || DEFAULT_SERVER_URL

test.describe("Performance smoke (no API)", () => {
  test("renders synthetic long history without server", async () => {
    const { context, page, optionsUrl } = await launchWithExtension(TEST_EXT_PATH, {
      seedConfig: {
        __tldw_allow_offline: true,
        __tldw_first_run_complete: true,
        serverUrl: SERVER_URL,
        authMode: "single-user",
        apiKey: ""
      }
    })

    try {
      const timer = new PerfTimer()
      timer.start()

      await context.addInitScript(() => {
        ;(window as any).__tldw_enableTestHooks = true
      })

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
      await page.waitForSelector("textarea, input, [contenteditable='true']", {
        state: "visible",
        timeout: 15000
      })
      await page.waitForFunction(
        () => Boolean((window as any).__tldw_pageAssist?.setMessages),
        null,
        { timeout: 15000 }
      )

      const injectedCount = 250
      const injection = await injectSyntheticMessages(page, injectedCount)
      expect(injection.ok).toBeTruthy()

      const messageLocator = page.locator('[data-testid="chat-message"]')
      await expect(messageLocator.first()).toBeVisible({ timeout: 10000 })

      const renderedMessages = await messageLocator.count()
      const domNodes = await countDOMNodes(page, "#root")
      timer.mark("rendered")

      const report = createReport(
        "Synthetic history smoke",
        [
          {
            name: "Injected messages",
            value: injectedCount,
            unit: "count"
          },
          {
            name: "Rendered message elements",
            value: renderedMessages,
            unit: "count"
          },
          {
            name: "DOM node count",
            value: domNodes,
            unit: "count"
          },
          {
            name: "Time to render",
            value: timer.elapsed(),
            unit: "ms"
          }
        ],
        timer.getStartTime()
      )

      logReport(report)

      expect(renderedMessages).toBeGreaterThan(0)
      expect(renderedMessages).toBeLessThanOrEqual(injectedCount)
      expect(domNodes).toBeGreaterThan(0)
    } finally {
      await context.close()
    }
  })
})
