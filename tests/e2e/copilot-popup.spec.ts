import { expect, test } from "@playwright/test"
import { launchWithExtension } from "./utils/extension"
import { requireRealServerConfig } from "./utils/real-server"
import { grantHostPermission } from "./utils/permissions"
import { setSelectedModel } from "./utils/connection"

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

test.describe("Contextual popup", () => {
  test("selection -> popup -> replace (smoke)", async () => {
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

    const { context, page, extensionId } = await launchWithExtension("", {
      seedConfig: {
        tldwConfig: {
          serverUrl: normalizedServerUrl,
          authMode: "single-user",
          apiKey
        }
      }
    })

    const origin = new URL(normalizedServerUrl).origin + "/*"
    const granted = await grantHostPermission(context, extensionId, origin)
    if (!granted) {
      test.skip(
        true,
        "Host permission not granted for tldw_server origin; allow it in chrome://extensions > tldw Assistant > Site access, then re-run"
      )
    }

    await setSelectedModel(page, selectedModelId)

    const contentPage = await context.newPage()
    await contentPage.goto("https://example.com", { waitUntil: "domcontentloaded" })
    await contentPage.bringToFront()

    await contentPage.waitForFunction(
      () =>
        document.documentElement.dataset.tldwCopilotPopupReady === "true",
      undefined,
      { timeout: 10000 }
    )

    await contentPage.evaluate(() => {
      document.body.innerHTML = '<textarea id="target" rows="4" cols="40">Hello world</textarea>'
      const el = document.getElementById("target") as HTMLTextAreaElement
      el.focus()
      el.selectionStart = 6
      el.selectionEnd = 11
    })

    const worker =
      context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"))

    await worker.evaluate(async ({ targetUrl, selectionText }) => {
      const queryTabs = () =>
        new Promise<chrome.tabs.Tab[]>((resolve) =>
          chrome.tabs.query({}, (tabs) => resolve(tabs))
        )
      const tabs = await queryTabs()
      const target = tabs.find((tab) => tab.url === targetUrl)
      if (!target?.id) {
        throw new Error("Target tab not found")
      }
      const sendOnce = () =>
        new Promise<void>((resolve) => {
          chrome.tabs.sendMessage(target.id!, {
            type: "tldw:popup:open",
            payload: {
              selectionText,
              pageUrl: targetUrl,
              pageTitle: target.title || ""
            }
          })
          resolve()
        })

      for (let attempt = 0; attempt < 5; attempt += 1) {
        await sendOnce()
        await new Promise((r) => setTimeout(r, 200))
      }
    }, { targetUrl: contentPage.url(), selectionText: "world" })

    const popup = contentPage.locator(
      "#tldw-copilot-popup-host >>> .tldw-popup"
    )
    await expect(popup).toBeVisible({ timeout: 15000 })

    const response = contentPage.locator(
      "#tldw-copilot-popup-host >>> [data-role='response']"
    )
    await expect(response).toHaveText(/\S+/, { timeout: 60000 })
    const responseText = (await response.innerText()).trim()

    const preview = contentPage.locator(
      "#tldw-copilot-popup-host >>> [data-role='preview']"
    )
    await expect(preview).toBeVisible({ timeout: 60000 })

    const replaceBtn = contentPage.locator(
      "#tldw-copilot-popup-host >>> [data-action='replace']"
    )
    await expect(replaceBtn).toBeEnabled()
    await replaceBtn.click()

    const finalValue = await contentPage.locator("#target").inputValue()
    expect(finalValue).toContain(responseText)

    await context.close()
  })
})
