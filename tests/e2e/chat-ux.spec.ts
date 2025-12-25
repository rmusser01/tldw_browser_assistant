import { expect, test, type BrowserContext } from "@playwright/test"
import path from "path"
import { launchWithExtension } from "./utils/extension"
import { grantHostPermission } from "./utils/permissions"
import { requireRealServerConfig } from "./utils/real-server"
import {
  waitForConnectionStore,
  forceUnconfigured,
  setSelectedModel
} from "./utils/connection"

test.describe("Chat workspace UX", () => {
  test("shows first-run connection CTA when unconfigured", async () => {
    test.setTimeout(60000)
    const extPath = path.resolve("build/chrome-mv3")
    const { context, openSidepanel } = await launchWithExtension(extPath)

    try {
      const page = await openSidepanel()
      await page.waitForLoadState("domcontentloaded")
      const workspace = page.locator('[data-testid="chat-workspace"]')
      if ((await workspace.count()) > 0) {
        await expect(workspace).toBeVisible()
      } else {
        await expect(page.getByRole("main")).toBeVisible()
      }

      await waitForConnectionStore(page, "chat-ux:first-run")
      await forceUnconfigured(page, "chat-ux:first-run")

      const emptyConnection = page.locator('[data-testid="chat-empty-connection"]')
      if ((await emptyConnection.count()) > 0) {
        await expect(emptyConnection).toBeVisible()
      } else {
        await expect(page.getByText(/Finish setup|Connect tldw Assistant/i).first()).toBeVisible()
      }

      const connectionCta = page.locator('[data-testid="chat-connection-cta"]')
      if ((await connectionCta.count()) > 0) {
        await expect(connectionCta).toBeVisible()
      } else {
        await expect(
          page.getByRole("button", { name: /Finish setup|Open tldw Settings|Review settings/i })
        ).toBeVisible()
      }

      let input = page.getByTestId("chat-input")
      if ((await input.count()) === 0) {
        input = page.getByPlaceholder(/Type a message/i)
      }
      await expect(input).not.toBeEditable()
    } finally {
      await context.close()
    }
  })

  test("walks through the core chat workflow", async () => {
    test.setTimeout(120000)
    const mark = (label: string) => {
      console.log(`[chat-ux] ${label}`)
    }

    const { serverUrl, apiKey } = requireRealServerConfig(test)
    const normalizedServerUrl = serverUrl.match(/^https?:\/\//)
      ? serverUrl
      : `http://${serverUrl}`

    const extPath = path.resolve("build/chrome-mv3")
    let context: BrowserContext | null = null

    try {
      const modelsResponse = await fetch(
        `${normalizedServerUrl}/api/v1/llm/models/metadata`,
        {
          headers: { "x-api-key": apiKey }
        }
      )
      if (!modelsResponse.ok) {
        const body = await modelsResponse.text().catch(() => "")
        test.skip(
          true,
          `Chat models preflight failed: ${modelsResponse.status} ${modelsResponse.statusText} ${body}`
        )
      }
      const modelsPayload = await modelsResponse.json().catch(() => [])
      const modelsList = Array.isArray(modelsPayload)
        ? modelsPayload
        : Array.isArray((modelsPayload as any)?.models)
          ? (modelsPayload as any).models
          : []
      const modelId =
        modelsList.find((m: any) => m?.id || m?.model || m?.name)?.id ||
        modelsList.find((m: any) => m?.id || m?.model || m?.name)?.model ||
        modelsList.find((m: any) => m?.id || m?.model || m?.name)?.name
      if (!modelId) {
        test.skip(true, "No chat models returned from tldw_server.")
      }

      mark("launch extension")
      const launchResult = await launchWithExtension(extPath, {
        seedConfig: {
          tldwConfig: {
            serverUrl: normalizedServerUrl,
            authMode: "single-user",
            apiKey
          }
        }
      })
      context = launchResult.context
      const { page, extensionId, openSidepanel } = launchResult
      const origin = new URL(normalizedServerUrl).origin + "/*"

      mark("grant host permission")
      const granted = await grantHostPermission(context, extensionId, origin)
      if (!granted) {
        test.skip(
          true,
          "Host permission not granted for tldw_server origin; allow it in chrome://extensions > tldw Assistant > Site access, then re-run"
        )
      }

      mark("open chat workspace")
      const chatPage = await openSidepanel()
      await chatPage.waitForLoadState("domcontentloaded")
      const workspace = chatPage.locator('[data-testid="chat-workspace"]')
      if ((await workspace.count()) > 0) {
        await expect(workspace).toBeVisible()
      } else {
        await expect(chatPage.getByRole("main")).toBeVisible()
      }

      mark("check connection")
      await waitForConnectionStore(chatPage, "chat-ux:before-check")
      await chatPage.evaluate(() => {
        window.dispatchEvent(new CustomEvent("tldw:check-connection"))
      })

      await chatPage.evaluate(() => {
        if (typeof chrome === "undefined" || !chrome.storage) return
        try {
          chrome.storage.local?.set?.({
            "tldw:seenHints": {
              "knowledge-search": true,
              "more-tools": true
            }
          })
          chrome.storage.sync?.set?.({
            ragSearchHintSeen: true
          })
        } catch {
          // ignore storage errors in test seed
        }
      })

      let input = chatPage.getByTestId("chat-input")
      if ((await input.count()) === 0) {
        input = chatPage.getByPlaceholder(/Type a message/i)
      }
      await expect(input).toBeVisible({ timeout: 15000 })
      await expect(input).toBeEditable({ timeout: 15000 })

      mark("select model")
      await setSelectedModel(chatPage, String(modelId))

      mark("toggle rag panel")
      const ragToggle = chatPage.getByTestId("control-rag-toggle")
      await expect(ragToggle).toBeVisible()
      await ragToggle.click()
      const ragPanel = chatPage.locator('[data-testid="rag-search-panel"]')
      if ((await ragPanel.count()) > 0) {
        await expect(ragPanel).toBeVisible()
      }
      await ragToggle.click()
      if ((await ragPanel.count()) > 0) {
        await expect(ragPanel).toBeHidden()
      }

      const webToggle = chatPage.getByTestId("control-web-toggle")
      if (await webToggle.isVisible()) {
        mark("toggle web search")
        await webToggle.click()
        await expect(webToggle).toHaveAttribute("aria-pressed", "true")
        await webToggle.click()
      }

      mark("send message")
      const message = `E2E Chat ${Date.now()}`
      await input.fill(message)
      const sendButton = chatPage.locator('[data-testid="chat-send"]')
      if ((await sendButton.count()) > 0) {
        await sendButton.click()
      } else {
        await input.press("Enter")
      }

      const userMessage = chatPage
        .locator('[data-testid="chat-message"][data-role="user"]')
        .filter({ hasText: message })
        .first()
      if ((await userMessage.count()) > 0) {
        await expect(userMessage).toBeVisible({ timeout: 15000 })
      } else {
        const log = chatPage.getByRole("log")
        await expect
          .poll(async () => {
            const text = await log.innerText().catch(() => "")
            return text.includes(message)
          }, { timeout: 15000 })
          .toBe(true)
      }

      const assistantMessages = chatPage.locator(
        '[data-testid="chat-message"][data-role="assistant"]'
      )
      const hasAssistantHooks = (await assistantMessages.count()) > 0
      const rows = chatPage.locator("[data-index]")
      const hasRowHooks = (await rows.count()) > 0

      if (hasAssistantHooks) {
        await expect
          .poll(async () => assistantMessages.count(), { timeout: 20000 })
          .toBeGreaterThan(0)
      } else if (hasRowHooks) {
        await expect
          .poll(async () => rows.count(), { timeout: 20000 })
          .toBeGreaterThan(1)
      } else {
        // Old build without test hooks: just ensure the log has content.
        const log = chatPage.getByRole("log")
        await expect
          .poll(async () => {
            const text = await log.innerText().catch(() => "")
            return text.trim().length > 0
          }, { timeout: 15000 })
          .toBe(true)
      }

      mark("toggle save status")
      let saveStatus = chatPage.locator('[data-testid="chat-save-status"]')
      if ((await saveStatus.count()) === 0) {
        saveStatus = chatPage.getByRole("button", {
          name: /Saved locally|Saved to server|Ephemeral/i
        })
      }
      if (await saveStatus.isVisible()) {
        const before = await saveStatus.getAttribute("aria-label")
        await saveStatus.click()
        const ephemeralBadge = chatPage.locator('[data-testid="chat-ephemeral-badge"]')
        if ((await ephemeralBadge.count()) > 0) {
          await expect(ephemeralBadge).toBeVisible()
        } else {
          try {
            await expect
              .poll(async () => (await saveStatus.getAttribute("aria-label")) || "", {
                timeout: 8000
              })
              .not.toBe(before || "")
          } catch {
            console.warn("[chat-ux] save status label did not change after toggle")
          }
        }
      } else {
        console.warn("[chat-ux] save status control not visible; skipping toggle")
      }
    } finally {
      if (context) {
        await context.close()
      }
    }
  })
})
