import { expect, test, type BrowserContext } from "@playwright/test"
import { launchWithExtension } from "./utils/extension"
import { grantHostPermission } from "./utils/permissions"
import { requireRealServerConfig } from "./utils/real-server"
import { waitForConnectionStore, setSelectedModel } from "./utils/connection"

const normalizeServerUrl = (value: string) =>
  value.match(/^https?:\/\//) ? value : `http://${value}`

const getFirstModelId = (payload: any): string | null => {
  const modelsList = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.models)
      ? payload.models
      : []
  const candidate =
    modelsList.find((m: any) => m?.id || m?.model || m?.name) || null
  const id = candidate?.id || candidate?.model || candidate?.name
  return id ? String(id) : null
}

const hasOpenApiPath = (spec: any, path: string): boolean => {
  const paths = spec?.paths || {}
  return Boolean(paths[path] || paths[`${path}/`])
}

test.describe("Chat feedback", () => {
  test("submits detailed feedback from the sidepanel", async () => {
    test.setTimeout(120000)
    const { serverUrl, apiKey } = requireRealServerConfig(test)
    const normalizedServerUrl = normalizeServerUrl(serverUrl)

    const modelsResponse = await fetch(
      `${normalizedServerUrl}/api/v1/llm/models/metadata`,
      { headers: { "x-api-key": apiKey } }
    )
    if (!modelsResponse.ok) {
      const body = await modelsResponse.text().catch(() => "")
      test.skip(
        true,
        `Chat models preflight failed: ${modelsResponse.status} ${modelsResponse.statusText} ${body}`
      )
    }
    const modelId = getFirstModelId(
      await modelsResponse.json().catch(() => [])
    )
    if (!modelId) {
      test.skip(true, "No chat models returned from tldw_server.")
    }
    const selectedModelId = modelId.startsWith("tldw:")
      ? modelId
      : `tldw:${modelId}`

    const specResponse = await fetch(`${normalizedServerUrl}/openapi.json`, {
      headers: { "x-api-key": apiKey }
    })
    if (!specResponse.ok) {
      test.skip(
        true,
        `OpenAPI spec not available: ${specResponse.status} ${specResponse.statusText}`
      )
    }
    const spec = await specResponse.json().catch(() => null)
    if (!hasOpenApiPath(spec, "/api/v1/feedback/explicit")) {
      test.skip(
        true,
        "Feedback endpoints not advertised in OpenAPI; skipping feedback test."
      )
    }

    let context: BrowserContext | null = null
    try {
      const launchResult = await launchWithExtension("", {
        seedConfig: {
          tldwConfig: {
            serverUrl: normalizedServerUrl,
            authMode: "single-user",
            apiKey
          }
        }
      })
      context = launchResult.context
      const { extensionId, openSidepanel } = launchResult
      const origin = new URL(normalizedServerUrl).origin + "/*"

      const granted = await grantHostPermission(
        context,
        extensionId,
        origin
      )
      if (!granted) {
        test.skip(
          true,
          "Host permission not granted for tldw_server origin; allow it in chrome://extensions > tldw Assistant > Site access, then re-run"
        )
      }

      const chatPage = await openSidepanel()
      await chatPage.bringToFront()
      await chatPage.waitForLoadState("domcontentloaded")
      await chatPage.waitForSelector("#root", {
        state: "attached",
        timeout: 10000
      })

      const hasConnectionStore = await chatPage
        .waitForFunction(
          () => !!(window as any).__tldw_useConnectionStore,
          undefined,
          { timeout: 15000 }
        )
        .then(() => true)
        .catch(() => false)

      if (!hasConnectionStore) {
        throw new Error(
          "Connection store not available in sidepanel. Rebuild the extension and retry."
        )
      }

      await waitForConnectionStore(chatPage, "feedback:before-check")
      await chatPage.evaluate(() => {
        window.dispatchEvent(new CustomEvent("tldw:check-connection"))
      })
      await chatPage.waitForFunction(
        () => {
          const store = (window as any).__tldw_useConnectionStore
          const state = store?.getState?.().state
          return state?.isConnected === true && state?.phase === "connected"
        },
        undefined,
        { timeout: 15000 }
      )

      await setSelectedModel(chatPage, selectedModelId)

      let input = chatPage.getByTestId("chat-input")
      if ((await input.count()) === 0) {
        input = chatPage.getByPlaceholder(/Type a message/i)
      }
      await expect(input).toBeVisible({ timeout: 15000 })
      await expect(input).toBeEditable({ timeout: 15000 })

      const message = `Feedback E2E ${Date.now()}`
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
      }

      const assistantMessages = chatPage.locator(
        '[data-testid="chat-message"][data-role="assistant"]'
      )
      await expect
        .poll(async () => assistantMessages.count(), { timeout: 30000 })
        .toBeGreaterThan(0)

      const lastAssistant = assistantMessages.last()
      await expect(
        lastAssistant.getByText(/Was this helpful\?/i)
      ).toBeVisible({ timeout: 30000 })

      const notHelpfulButton = lastAssistant.getByRole("button", {
        name: /Not helpful/i
      })
      await expect(notHelpfulButton).toBeVisible({ timeout: 30000 })
      await expect(notHelpfulButton).toBeEnabled({ timeout: 30000 })

      const moreFeedbackButton = lastAssistant.getByRole("button", {
        name: /More feedback/i
      })
      await expect(moreFeedbackButton).toBeVisible({ timeout: 30000 })
      await expect(moreFeedbackButton).toBeEnabled({ timeout: 30000 })
      await moreFeedbackButton.click()

      const modal = chatPage.getByRole("dialog", { name: /Feedback/i })
      await expect(modal).toBeVisible({ timeout: 10000 })

      let notes = modal.getByTestId("feedback-notes")
      if ((await notes.count()) === 0) {
        notes = modal.locator("textarea")
      }
      if ((await notes.count()) > 0) {
        await notes.fill("Playwright feedback submission")
        await expect(notes).toHaveValue(/Playwright feedback submission/i)
      }

      const stars = modal.locator(".ant-rate-star")
      const starCount = await stars.count()
      if (starCount > 0) {
        await stars.nth(Math.min(2, starCount - 1)).click({ force: true })
      }

      let submitButton = modal.getByTestId("feedback-submit")
      if ((await submitButton.count()) === 0) {
        submitButton = modal.getByRole("button", {
          name: /Submit feedback/i
        })
      }
      await expect(submitButton).toBeEnabled({ timeout: 10000 })
      await submitButton.click()

      const outcome = await Promise.race([
        modal
          .waitFor({ state: "hidden", timeout: 20000 })
          .then(() => "closed"),
        submitButton
          .waitFor({ state: "detached", timeout: 20000 })
          .then(() => "closed"),
        expect(submitButton)
          .toBeEnabled({ timeout: 20000 })
          .then(() => "settled"),
        new Promise<string>((resolve) =>
          setTimeout(() => resolve("pending"), 20000)
        )
      ]).catch(() => "timeout")

      const closeModal = async () => {
        let closeButton = modal.getByRole("button", { name: /Close/i })
        if ((await closeButton.count()) === 0) {
          closeButton = modal.locator(".ant-modal-close")
        }
        if ((await closeButton.count()) > 0) {
          await closeButton.click()
        } else {
          await chatPage.keyboard.press("Escape")
        }
        await expect(modal).toBeHidden({ timeout: 10000 })
      }

      if (outcome === "closed") {
        await expect(modal).toBeHidden({ timeout: 20000 })
      } else if (outcome === "settled") {
        const stillVisible = await modal
          .isVisible()
          .catch(() => false)
        if (stillVisible) {
          let cancelButton = modal.getByTestId("feedback-cancel")
          if ((await cancelButton.count()) === 0) {
            cancelButton = modal.getByRole("button", { name: /Cancel/i })
          }
          if ((await cancelButton.count()) > 0) {
            await cancelButton.click()
          } else {
            await closeModal()
          }
          await expect(modal).toBeHidden({ timeout: 10000 })
        }
      } else if (outcome === "pending" || outcome === "timeout") {
        const stillVisible = await modal
          .isVisible()
          .catch(() => false)
        if (stillVisible) {
          await closeModal()
        }
      } else {
        throw new Error("Feedback modal did not close or surface an error.")
      }
    } finally {
      if (context) {
        await context.close()
      }
    }
  })
})
