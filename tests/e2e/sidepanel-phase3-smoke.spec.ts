import { test, expect, type Page } from "@playwright/test"
import path from "path"
import { launchWithExtension } from "./utils/extension"
import { grantHostPermission } from "./utils/permissions"
import { requireRealServerConfig } from "./utils/real-server"
import { waitForConnectionStore, forceConnected } from "./utils/connection"

const EXT_PATH = path.resolve("build/chrome-mv3")
const FIXTURE_PATH = path.resolve("tests/e2e/fixtures/phase3-context.txt")
const normalizeServerUrl = (value: string) =>
  value.match(/^https?:\/\//) ? value : `http://${value}`

const ensureChatInput = async (page: Page) => {
  const startButton = page.getByRole("button", { name: /Start chatting/i })
  if ((await startButton.count()) > 0) {
    await startButton.first().click()
  }

  let input = page.getByTestId("chat-input")
  if ((await input.count()) === 0) {
    input = page.getByPlaceholder(/Type a message/i)
  }
  await expect(input).toBeVisible({ timeout: 15_000 })
  await expect(input).toBeEditable({ timeout: 15_000 })
  await input.click()
  return input
}

const openCommandPalette = async (page: Page) => {
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent("tldw:open-command-palette"))
  })
  const dialog = page.getByRole("dialog", { name: /Command Palette/i })
  if (await dialog.isVisible().catch(() => false)) {
    return dialog
  }
  await page.keyboard.press("Meta+k").catch(() => {})
  if (await dialog.isVisible().catch(() => false)) {
    return dialog
  }
  await page.keyboard.press("Control+k").catch(() => {})
  await expect(dialog).toBeVisible({ timeout: 5000 })
  return dialog
}

const openSidebar = async (page: Page) => {
  const sidebar = page.getByTestId("sidepanel-chat-sidebar")
  if (await sidebar.isVisible().catch(() => false)) {
    return sidebar
  }
  const toggle = page.getByRole("button", { name: /Open sidebar|Expand sidebar/i })
  if ((await toggle.count()) > 0) {
    await toggle.first().click()
  }
  await expect(sidebar).toBeVisible({ timeout: 5000 })
  return sidebar
}

const dismissSidebarOverlay = async (page: Page) => {
  const sidebar = page.getByTestId("sidepanel-chat-sidebar")
  if (!(await sidebar.isVisible().catch(() => false))) {
    return
  }
  const closeButton = sidebar.getByRole("button", { name: /^Close$/i })
  if ((await closeButton.count()) > 0) {
    await closeButton.first().click()
  } else {
    const collapseButton = sidebar.getByRole("button", {
      name: /Collapse sidebar/i
    })
    if ((await collapseButton.count()) > 0) {
      await collapseButton.first().click()
    }
  }
  await expect(sidebar).toBeHidden({ timeout: 5000 }).catch(() => {})
  const overlay = page.locator("div[aria-hidden='true'][class*='bg-black']")
  if (await overlay.first().isVisible().catch(() => false)) {
    await overlay.first().click({ force: true })
    await overlay.first().waitFor({ state: "hidden", timeout: 5000 }).catch(() => {})
  }
}

const enableTabMentions = async (page: Page) => {
  await page.evaluate(() => {
    if (typeof chrome === "undefined" || !chrome.storage) return
    try {
      chrome.storage.local?.set?.({ tabMentionsEnabled: true })
      chrome.storage.sync?.set?.({ tabMentionsEnabled: true })
    } catch {
      // ignore storage errors in test seed
    }
  })
}

test.describe("Sidepanel Phase 3 smoke", () => {
  test("covers slash commands, mentions, chips, palette, and settings", async () => {
    test.setTimeout(120_000)
    const { serverUrl: rawServerUrl, apiKey } = requireRealServerConfig(test)
    const serverUrl = normalizeServerUrl(rawServerUrl)

    const { context, page, openSidepanel, extensionId } =
      (await launchWithExtension(EXT_PATH, {
        seedConfig: {
          __tldw_first_run_complete: true,
          __tldw_allow_offline: true,
          tldwConfig: {
            serverUrl,
            authMode: "single-user",
            apiKey
          }
        }
      })) as any

    const granted = await grantHostPermission(
      context,
      extensionId,
      new URL(serverUrl).origin + "/*"
    )
    if (!granted) {
      test.skip(
        true,
        "Host permission not granted for tldw_server origin; allow it in chrome://extensions > tldw Assistant > Site access, then re-run"
      )
    }

    await enableTabMentions(page)
    const sidepanel = await openSidepanel()

    try {
      await waitForConnectionStore(sidepanel, "phase3:sidepanel")
      await forceConnected(sidepanel, { serverUrl }, "phase3:connected")

      const input = await ensureChatInput(sidepanel)

      await input.fill("/")
      await expect(
        sidepanel.getByRole("option", { name: /search/i }).first()
      ).toBeVisible()

      await input.fill("@")
      const currentPageOption = sidepanel.getByRole("option", {
        name: /Current page/i
      })
      await expect(currentPageOption).toBeVisible()
      await currentPageOption.click()
      await expect(input).toHaveValue("")
      const pageChip = sidepanel.getByRole("button", { name: /Remove page/i })
      if (await pageChip.count()) {
        await expect(pageChip).toBeVisible()
      }

      await input.fill("@")
      const knowledgeOption = sidepanel.getByRole("option", {
        name: /Knowledge base/i
      })
      await expect(knowledgeOption).toBeVisible()
      await knowledgeOption.click()
      await expect(
        sidepanel.getByRole("button", { name: /Remove knowledge context/i })
      ).toBeVisible()

      await input.fill("@")
      const fileOption = sidepanel.getByRole("option", { name: /File/i })
      await expect(fileOption).toBeVisible()
      await fileOption.click()
      await sidepanel.setInputFiles("#context-file-upload", FIXTURE_PATH)
      await expect(
        sidepanel.getByText("phase3-context.txt")
      ).toBeVisible()

      const palette = await openCommandPalette(sidepanel)
      await palette
        .getByRole("option", { name: /Search chat history/i })
        .click()
      const searchInput = sidepanel.getByTestId("sidepanel-sidebar-search")
      await expect(searchInput).toBeVisible()
      await expect(searchInput).toBeFocused().catch(() => {})

      const sidebar = await openSidebar(sidepanel)
      await sidebar.getByTestId("sidepanel-sidebar-new-chat").click()
      await dismissSidebarOverlay(sidepanel)

      const header = sidepanel.getByTestId("chat-header")
      const renameButton = header.getByRole("button", {
        name: /Rename conversation/i
      })
      await renameButton.click()
      const renameInput = sidepanel.getByRole("textbox", {
        name: /Rename conversation/i
      })
      await renameInput.fill("Phase 3 Secondary")
      await renameInput.press("Enter")
      await expect(
        header.getByText("Phase 3 Secondary")
      ).toBeVisible()

      await openSidebar(sidepanel)
      await sidepanel
        .getByTestId("sidepanel-chat-sidebar")
        .getByTestId("sidepanel-sidebar-new-chat")
        .click()
      await dismissSidebarOverlay(sidepanel)
      await expect(header.getByText(/New chat/i)).toBeVisible()

      const paletteSwitch = await openCommandPalette(sidepanel)
      await paletteSwitch
        .getByPlaceholder(/Type a command or search/i)
        .fill("Phase 3 Secondary")
      const switchOption = paletteSwitch.getByRole("option", {
        name: /Phase 3 Secondary/i
      })
      await expect(switchOption).toBeVisible()
      await switchOption.click()
      await expect(
        sidepanel
          .getByTestId("chat-header")
          .getByText("Phase 3 Secondary")
      ).toBeVisible()

      await header
        .getByRole("link", { name: /Open settings/i })
        .click({ noWaitAfter: true })
      const citationsHeading = sidepanel.getByRole("heading", {
        name: /Citations & Dictionaries/i
      })
      await expect(citationsHeading).toBeVisible({ timeout: 20_000 })
      await citationsHeading.scrollIntoViewIfNeeded()
      const citationsCard = citationsHeading.locator("..")

      const citationSelect = sidepanel.getByRole("combobox", {
        name: /Citation style/i
      })
      await citationSelect.scrollIntoViewIfNeeded()
      await expect(citationSelect).toBeVisible()

      const dictionariesLabel = citationsCard
        .getByText("Chat dictionaries", { exact: true })
        .first()
      await expect(dictionariesLabel).toBeVisible()
      const dictUnavailable = citationsCard.getByText(
        /Chat dictionaries are not available on this server\./i
      )
      const selectControls = citationsCard.locator(".ant-select")
      const selectCount = await selectControls.count()
      expect(selectCount).toBeGreaterThanOrEqual(2)
      const dictionariesSelect = selectControls.nth(1)
      await dictionariesSelect.scrollIntoViewIfNeeded()
      await expect(dictionariesSelect).toBeVisible()
      if (await dictUnavailable.count()) {
        await expect(dictUnavailable).toBeVisible()
      }
    } finally {
      await context.close()
    }
  })
})
