import { expect, test, type BrowserContext, type Page } from "@playwright/test"
import { launchWithExtension } from "./utils/extension"
import { grantHostPermission } from "./utils/permissions"
import { requireRealServerConfig } from "./utils/real-server"
import {
  waitForConnectionStore,
  setSelectedModel,
  forceConnected
} from "./utils/connection"

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

const setUiMode = async (page: Page, mode: "casual" | "pro") => {
  await page.evaluate((nextMode) => {
    if (typeof localStorage === "undefined") return
    localStorage.setItem(
      "tldw-ui-mode",
      JSON.stringify({ state: { mode: nextMode }, version: 0 })
    )
  }, mode)
}

const ensureProMode = async (page: Page) => {
  const modeGroup = page.getByRole("group", { name: /Mode/i })
  await expect(modeGroup).toBeVisible({ timeout: 20000 })
  const proButton = modeGroup.getByRole("button", { name: /Pro/i })
  if ((await proButton.getAttribute("aria-pressed")) !== "true") {
    await proButton.click()
  }
  await expect(proButton).toHaveAttribute("aria-pressed", "true", {
    timeout: 10000
  })
}

const maybeStartChat = async (page: Page) => {
  const startButton = page.getByRole("button", { name: /Start chatting/i })
  if ((await startButton.count()) > 0) {
    await startButton.first().click()
  }
}

const ensureModelSelectedViaUi = async (page: Page) => {
  const modelSelect = page.getByTestId("chat-model-select")
  if ((await modelSelect.count()) === 0) {
    return
  }
  await modelSelect.first().click()
  const menuItem = page.getByRole("menuitem").first()
  await expect(menuItem).toBeVisible({ timeout: 10000 })
  await menuItem.click()
}

const setUseMarkdownForUserMessage = async (page: Page) => {
  await page.evaluate(async () => {
    const w: any = window as any
    const hasSync =
      w?.chrome?.storage?.sync?.set && w?.chrome?.storage?.sync?.get
    const hasLocal =
      w?.chrome?.storage?.local?.set && w?.chrome?.storage?.local?.get
    if (!hasSync && !hasLocal) return
    const setValue = (area: typeof chrome.storage.local) =>
      new Promise<void>((resolve) => {
        let done = false
        const timer = setTimeout(() => {
          if (done) return
          done = true
          resolve()
        }, 2000)
        area.set({ useMarkdownForUserMessage: true }, () => {
          if (done) return
          done = true
          clearTimeout(timer)
          resolve()
        })
      })
    if (hasSync) {
      await setValue(w.chrome.storage.sync)
    }
    if (hasLocal) {
      await setValue(w.chrome.storage.local)
    }
  })
}

const forceSelectedModel = async (page: Page, modelId: string) => {
  await page.evaluate(async (model) => {
    const w: any = window as any
    const areas: Array<typeof chrome.storage.local> = []
    if (w?.chrome?.storage?.sync) {
      areas.push(w.chrome.storage.sync)
    }
    if (w?.chrome?.storage?.local) {
      areas.push(w.chrome.storage.local)
    }
    const payload = JSON.stringify(model)
    await Promise.all(
      areas.map(
        (area) =>
          new Promise<void>((resolve) => {
            area.set({ selectedModel: payload }, () => resolve())
          })
      )
    )
  }, modelId)
}

const openOptionsPlayground = async (page: Page, optionsUrl: string) => {
  await page.goto(`${optionsUrl}#/`, { waitUntil: "domcontentloaded" })
  await waitForConnectionStore(page, "progress:options-store")

  const textarea = page.locator("#textarea-message")
  try {
    await expect(textarea).toBeVisible({ timeout: 5000 })
    return
  } catch {
    // Onboarding can still render even with seeded flags; force the store.
  }

  await page.evaluate(() => {
    try {
      if (typeof chrome !== "undefined" && chrome?.storage?.local) {
        chrome.storage.local.set({ __tldw_first_run_complete: true })
      }
    } catch {
      // ignore storage write errors
    }
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("__tldw_first_run_complete", "true")
      }
    } catch {
      // ignore localStorage availability
    }
  })

  await forceConnected(page, {}, "progress:options-force-connected")
  await expect(textarea).toBeVisible({ timeout: 20000 })
}

const fetchModelId = async (
  serverUrl: string,
  apiKey: string,
  fallback: string
) => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000)
  try {
    const response = await fetch(`${serverUrl}/api/v1/llm/models/metadata`, {
      headers: { "x-api-key": apiKey },
      signal: controller.signal
    })
    if (!response.ok) return fallback
    const payload = await response.json().catch(() => [])
    return getFirstModelId(payload) || fallback
  } catch {
    return fallback
  } finally {
    clearTimeout(timeout)
  }
}

const logStep = (label: string) => {
  // eslint-disable-next-line no-console
  console.log(`[progress-smoke] ${label}`)
}

const ensureConnected = async (
  page: Page,
  label: string,
  serverUrl?: string
) => {
  await waitForConnectionStore(page, label)
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent("tldw:check-connection"))
  })
  const connected = await page
    .waitForFunction(
      () => {
        const store = (window as any).__tldw_useConnectionStore
        const state = store?.getState?.().state
        return state?.isConnected === true && state?.phase === "connected"
      },
      undefined,
      { timeout: 20000 }
    )
    .then(() => true)
    .catch(() => false)
  if (!connected) {
    await forceConnected(
      page,
      serverUrl ? { serverUrl } : {},
      `${label}:force`
    )
  }
}

const sendMessage = async (page: Page, message: string) => {
  let input = page.locator("#textarea-message")
  if ((await input.count()) === 0) {
    input = page.getByPlaceholder(/Type a message/i)
  }
  await expect(input).toBeVisible({ timeout: 15000 })
  await expect(input).toBeEditable({ timeout: 15000 })
  await input.click()
  await input.fill(message)
  await input.press("Enter")

  const valueAfterEnter = await input.evaluate(
    (el) => (el as HTMLTextAreaElement).value
  )
  if (valueAfterEnter.trim().length === 0) {
    return
  }

  const submitButton = page.locator(
    'button[aria-label="Send message"][type="submit"]'
  )
  if ((await submitButton.count()) > 0) {
    await submitButton.first().click()
    return
  }
  const sendButton = page.getByRole("button", { name: /^Send$/i }).first()
  if ((await sendButton.count()) > 0) {
    await sendButton.click()
    return
  }
}

const waitForUserCodeMessage = async (page: Page, marker: string) => {
  const userMessages = page.locator(
    '[data-testid="chat-message"][data-role="user"]'
  )
  await expect
    .poll(async () => userMessages.count(), { timeout: 20000 })
    .toBeGreaterThan(0)
  const target = userMessages.filter({ hasText: marker }).last()
  await expect(target).toBeVisible({ timeout: 20000 })
  const viewCodeButton = target.getByRole("button", { name: /View code/i })
  await expect(viewCodeButton).toBeVisible({ timeout: 20000 })
  return { target, viewCodeButton }
}

const waitForCodeMessage = async (page: Page, marker: string) => {
  const messages = page.locator('[data-testid="chat-message"]')
  await expect
    .poll(async () => messages.count(), { timeout: 20000 })
    .toBeGreaterThan(0)
  const target = messages.filter({ hasText: marker }).last()
  await expect(target).toBeVisible({ timeout: 20000 })
  const viewCodeButton = target.getByRole("button", { name: /View code/i })
  await expect(viewCodeButton).toBeVisible({ timeout: 20000 })
  return { target, viewCodeButton }
}

test.describe("UX progress smoke", () => {
  test("covers Pro mode reply + artifacts in main chat and sidepanel", async () => {
    test.setTimeout(180000)
    logStep("load server config")
    const { serverUrl, apiKey } = requireRealServerConfig(test)
    const normalizedServerUrl = normalizeServerUrl(serverUrl)
    const fallbackModelId =
      process.env.TLDW_E2E_MODEL_ID || "tldw-smoke-model"
    logStep("fetch model id")
    const modelId = await fetchModelId(
      normalizedServerUrl,
      apiKey,
      fallbackModelId
    )
    const selectedModelId = modelId.startsWith("tldw:")
      ? modelId
      : `tldw:${modelId}`

    let context: BrowserContext | null = null
    try {
      logStep("launch extension")
      const launchResult = await launchWithExtension("", {
        seedConfig: {
          __tldw_first_run_complete: true,
          __tldw_allow_offline: true,
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

      logStep("grant host permission")
      const granted = await grantHostPermission(context, extensionId, origin)
      if (!granted) {
        test.skip(
          true,
          "Host permission not granted for tldw_server origin; allow it in chrome://extensions > tldw Assistant > Site access, then re-run"
        )
      }

      logStep("setup main chat")
      await setUiMode(page, "pro")
      await setSelectedModel(page, selectedModelId)
      await forceSelectedModel(page, selectedModelId)
      await setUseMarkdownForUserMessage(page)
      await openOptionsPlayground(page, launchResult.optionsUrl)
      await maybeStartChat(page)
      await ensureProMode(page)
      await ensureConnected(
        page,
        "progress:options-connect",
        normalizedServerUrl
      )

      logStep("send main chat message")
      const codeLines = Array.from({ length: 12 }, (_, i) =>
        `console.log(${i + 1})`
      ).join("\n")
      const codePrompt = `\`\`\`javascript\n${codeLines}\n\`\`\`\n${Date.now()}`
      await sendMessage(page, codePrompt)

      logStep("wait for user message")
      const { target: userMessage, viewCodeButton } =
        await waitForUserCodeMessage(page, codeLines.split("\n")[0])

      logStep("open artifacts panel")
      const artifactsPanel = page.locator('[data-testid="artifacts-panel"]')
      await expect(artifactsPanel.first()).toBeVisible({ timeout: 20000 })

      logStep("set/clear reply")
      logStep("set reply target")
      const replyTarget = {
        id: `e2e-${Date.now()}`,
        preview: "E2E reply target",
        name: "You",
        isBot: false
      }
      await page.evaluate((target) => {
        const store = (window as any).__tldw_useStoreMessageOption
        store?.getState?.().setReplyTarget?.(target)
      }, replyTarget)

      const replyBanner = page.getByText(/Replying to/i).first()
      await expect(replyBanner).toBeVisible({ timeout: 10000 })

      logStep("clear reply target")
      await page.evaluate(() => {
        const store = (window as any).__tldw_useStoreMessageOption
        store?.getState?.().clearReplyTarget?.()
      })
      await expect(replyBanner).toBeHidden({ timeout: 10000 })

      logStep("open sidepanel")
      const sidepanelPage = await openSidepanel()
      await sidepanelPage.bringToFront()
      logStep("setup sidepanel")
      await setUiMode(sidepanelPage, "pro")
      await sidepanelPage.reload({ waitUntil: "domcontentloaded" })
      await ensureProMode(sidepanelPage)
      await ensureConnected(
        sidepanelPage,
        "progress:sidepanel-connect",
        normalizedServerUrl
      )
      await setSelectedModel(sidepanelPage, selectedModelId)
      await forceSelectedModel(sidepanelPage, selectedModelId)
      await setUseMarkdownForUserMessage(sidepanelPage)

      logStep("open sidepanel artifacts")
      await sidepanelPage.evaluate(() => {
        const store = (window as any).__tldw_useArtifactsStore
        store?.getState?.().openArtifact?.({
          id: `e2e-side-${Date.now()}`,
          title: "javascript",
          content: "console.log('sidepanel')",
          language: "javascript",
          kind: "code",
          lineCount: 1
        })
      })

      logStep("assert sidepanel artifacts")
      const sideArtifacts = sidepanelPage.locator(
        '[data-testid="artifacts-panel"]'
      )
      await expect(sideArtifacts.first()).toBeVisible({ timeout: 20000 })
      logStep("smoke test done")
    } finally {
      if (context) {
        await context.close()
      }
    }
  })
})
