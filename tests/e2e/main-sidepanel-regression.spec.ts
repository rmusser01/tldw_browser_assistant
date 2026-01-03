import { test, expect, type Page } from "@playwright/test"
import { launchWithExtension } from "./utils/extension"
import { waitForConnectionStore, forceConnected } from "./utils/connection"

const normalizeServerUrl = (value: string) =>
  value.match(/^https?:\/\//) ? value : `http://${value}`

const ensureChatInput = async (page: Page) => {
  const startButton = page.getByRole("button", { name: /Start chatting/i })
  if ((await startButton.count()) > 0) {
    await startButton.first().click()
  }

  let input = page.locator("#textarea-message")
  if ((await input.count()) === 0) {
    input = page.getByPlaceholder(/Type a message/i)
  }
  await expect(input).toBeVisible({ timeout: 15000 })
  await input.click()
  return input
}

const openCommandPalette = async (page: Page) => {
  await page.keyboard.press("Meta+k").catch(() => {})
  const dialog = page.getByRole("dialog", { name: /Command Palette/i })
  if (await dialog.isVisible().catch(() => false)) {
    return dialog
  }
  await page.keyboard.press("Control+k").catch(() => {})
  await expect(dialog).toBeVisible({ timeout: 5000 })
  return dialog
}

const triggerSlashMenu = async (page: Page, input: Page["locator"]) => {
  await input.fill("/")
  const commandOption = page.getByRole("option", { name: /search/i })
  await expect(commandOption).toBeVisible({ timeout: 5000 })
}

test.describe("Main + Sidepanel Regression", () => {
  test("core composer and command palette behaviors", async () => {
    const serverUrl = normalizeServerUrl(
      process.env.TLDW_E2E_SERVER_URL || "http://127.0.0.1:8000"
    )

    const { context, page, openSidepanel } = await launchWithExtension("", {
      seedConfig: {
        __tldw_first_run_complete: true,
        __tldw_allow_offline: true,
        tldwConfig: {
          serverUrl,
          authMode: "single-user"
        }
      }
    })

    try {
      await waitForConnectionStore(page, "regression:main-store")
      await forceConnected(page, { serverUrl }, "regression:main-connected")

      const input = await ensureChatInput(page)
      await triggerSlashMenu(page, input)

      const toolsButton = page.getByRole("button", { name: /Tools/i }).first()
      if (await toolsButton.count()) {
        await expect(toolsButton).toBeVisible()
      }

      const palette = await openCommandPalette(page)
      await page.keyboard.press("Escape")
      await expect(palette).toBeHidden({ timeout: 5000 })

      const sidepanel = await openSidepanel()
      await waitForConnectionStore(sidepanel, "regression:sidepanel-store")
      await forceConnected(
        sidepanel,
        { serverUrl },
        "regression:sidepanel-connected"
      )

      const sideInput = await ensureChatInput(sidepanel)
      await triggerSlashMenu(sidepanel, sideInput)

      const modeToggle = sidepanel.getByRole("button", { name: /Casual/i })
      await expect(modeToggle.first()).toBeVisible({ timeout: 10000 })

      const sidePalette = await openCommandPalette(sidepanel)
      await sidepanel.keyboard.press("Escape")
      await expect(sidePalette).toBeHidden({ timeout: 5000 })
    } finally {
      await context.close()
    }
  })
})
