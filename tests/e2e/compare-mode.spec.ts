import { expect, test } from "@playwright/test"
import { launchWithExtension } from "./utils/extension"
import { grantHostPermission } from "./utils/permissions"
import { requireRealServerConfig } from "./utils/real-server"
import { setSelectedModel, waitForConnectionStore } from "./utils/connection"
import { FEATURE_FLAG_KEYS, withFeatures } from "./utils/feature-flags"

test.describe("Compare mode", () => {
  test("runs the compare workflow in Playground", async () => {
    test.setTimeout(180000)
    const { serverUrl, apiKey } = requireRealServerConfig(test)
    const normalizedServerUrl = serverUrl.match(/^https?:\/\//)
      ? serverUrl
      : `http://${serverUrl}`

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
        `Compare mode preflight failed: ${modelsResponse.status} ${modelsResponse.statusText} ${body}`
      )
    }
    const modelsPayload = await modelsResponse.json().catch(() => [])
    const modelsList = Array.isArray(modelsPayload)
      ? modelsPayload
      : Array.isArray((modelsPayload as any)?.models)
        ? (modelsPayload as any).models
        : []
    const modelIds = modelsList
      .map((model: any) => model?.model || model?.id || model?.name)
      .filter(Boolean)
    if (modelIds.length < 2) {
      test.skip(true, "Need at least 2 models to run compare workflow.")
    }

    const { context, page, extensionId } = await launchWithExtension("", {
      seedConfig: withFeatures([FEATURE_FLAG_KEYS.COMPARE_MODE], {
        tldwConfig: {
          serverUrl: normalizedServerUrl,
          authMode: "single-user",
          apiKey
        }
      })
    })

    try {
      const origin = new URL(normalizedServerUrl).origin + "/*"
      const granted = await grantHostPermission(context, extensionId, origin)
      if (!granted) {
        test.skip(
          true,
          "Host permission not granted for tldw_server origin; allow it in chrome://extensions > tldw Assistant > Site access, then re-run"
        )
      }

      await waitForConnectionStore(page, "compare-mode:init")
      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent("tldw:check-connection"))
      })
      await page.waitForFunction(
        () => {
          const store = (window as any).__tldw_useConnectionStore
          const state = store?.getState?.().state
          return state?.isConnected === true && state?.phase === "connected"
        },
        undefined,
        { timeout: 15000 }
      )

      await setSelectedModel(page, String(modelIds[0]))
      await page.evaluate(async () => {
        const setFlag = (area: typeof chrome.storage.local) =>
          new Promise<void>((resolve) => {
            area.set({ ff_compareMode: true }, () => resolve())
          })
        if (chrome?.storage?.local) {
          await setFlag(chrome.storage.local)
        }
        if (chrome?.storage?.sync) {
          await setFlag(chrome.storage.sync)
        }
      })

      const compareButton = page
        .getByRole("button", { name: /compare models/i })
        .first()
      await expect(compareButton).toBeVisible({ timeout: 15000 })
      await compareButton.click()

      const dialog = page.getByRole("dialog", { name: /compare settings/i })
      await expect(dialog).toBeVisible({ timeout: 10000 })

      const switches = dialog.getByRole("switch")
      const ensureSwitchOn = async (index: number) => {
        const toggle = switches.nth(index)
        const checked = await toggle.getAttribute("aria-checked")
        if (checked !== "true") {
          await toggle.click()
        }
      }
      if ((await switches.count()) >= 2) {
        await ensureSwitchOn(0)
        await ensureSwitchOn(1)
      } else {
        await ensureSwitchOn(0)
      }

      const modelPicker = dialog.locator(".ant-select-multiple").first()
      await modelPicker.click()
      const options = page.locator(
        ".ant-select-dropdown:visible .ant-select-item-option"
      )
      const optionCount = await options.count()
      if (optionCount < 2) {
        test.skip(true, "Compare model picker returned fewer than 2 options.")
      }
      await options.nth(0).click()
      await options.nth(1).click()
      await page.keyboard.press("Escape")
      await expect(dialog).toBeHidden({ timeout: 10000 })

      const input = page.locator("#textarea-message")
      await expect(input).toBeVisible({ timeout: 15000 })
      await input.fill(
        "Compare mode test: summarize key differences in one sentence."
      )
      const sendButton = page.getByRole("button", { name: /send/i }).first()
      await sendButton.click()

      const clusterLabel = page.getByText("Multi-model answers").first()
      await expect(clusterLabel).toBeVisible({ timeout: 60000 })

      const compareButtons = page.getByRole("button", { name: /^Compare$/ })
      await expect(compareButtons.first()).toBeVisible({ timeout: 60000 })
      const compareCount = await compareButtons.count()
      if (compareCount < 2) {
        test.skip(true, "Need at least 2 compare responses to continue.")
      }

      await compareButtons.nth(0).click()
      await compareButtons.nth(1).click()

      const bulkSplit = page.getByRole("button", {
        name: /open each selected answer as its own chat/i
      })
      if ((await bulkSplit.count()) > 0) {
        await bulkSplit.first().click()
      }

      await compareButtons.nth(1).click()
      const continueButton = page.getByRole("button", {
        name: /continue with this model/i
      })
      await expect(continueButton).toBeVisible({ timeout: 15000 })
      await continueButton.click()

      await expect(page.getByText("Chosen").first()).toBeVisible({
        timeout: 15000
      })

      const compareAgainHint = page.getByText(
        "Continue with the chosen answer or compare again."
      )
      await expect(compareAgainHint).toBeVisible()
      const compareAgainButton = compareAgainHint
        .locator("..")
        .getByRole("button", { name: /compare models/i })
      await compareAgainButton.click()

      const canonicalButton = page
        .getByRole("button", { name: /pin as canonical/i })
        .first()
      if ((await canonicalButton.count()) > 0) {
        await canonicalButton.click()
      }

      const moreActions = page.getByRole("button", {
        name: /more actions/i
      })
      if ((await moreActions.count()) > 0) {
        await moreActions.first().click()
        const copyCanonical = page.getByRole("menuitem", {
          name: /copy canonical transcript/i
        })
        if ((await copyCanonical.count()) > 0) {
          await copyCanonical.first().click()
        }
      }
    } finally {
      await context.close()
    }
  })
})
