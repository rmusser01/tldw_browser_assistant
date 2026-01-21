import { test, expect, type Locator, type Page } from "@playwright/test"
import path from "path"
import { launchWithExtension } from "./utils/extension"
import { grantHostPermission } from "./utils/permissions"
import { requireRealServerConfig } from "./utils/real-server"
import { waitForConnectionStore } from "./utils/connection"

const normalizeServerUrl = (value: string) =>
  value.match(/^https?:\/\//) ? value.replace(/\/$/, "") : `http://${value}`

const fetchWritingCapabilities = async (serverUrl: string, apiKey: string) => {
  const res = await fetch(
    `${serverUrl}/api/v1/writing/capabilities?include_providers=false`,
    {
      headers: { "x-api-key": apiKey }
    }
  ).catch(() => null)
  if (!res || !res.ok) return null
  return await res.json().catch(() => null)
}

const waitForConnected = async (page: Page, label: string) => {
  await waitForConnectionStore(page, label)
  await page.evaluate(() => {
    const store = (window as any).__tldw_useConnectionStore
    try {
      store?.getState?.().markFirstRunComplete?.()
      store?.getState?.().checkOnce?.()
    } catch {
      // ignore connection triggers
    }
    window.dispatchEvent(new CustomEvent("tldw:check-connection"))
  })
  await page.waitForFunction(
    () => {
      const store = (window as any).__tldw_useConnectionStore
      const state = store?.getState?.().state
      return state?.isConnected === true && state?.phase === "connected"
    },
    undefined,
    { timeout: 20000 }
  )
}

const ensurePageVisible = async (page: Page) => {
  try {
    await page.bringToFront()
  } catch {
    // ignore bringToFront failures in headless contexts
  }
  try {
    await page.waitForFunction(
      () => document.visibilityState === "visible",
      undefined,
      { timeout: 5000 }
    )
  } catch {
    // ignore visibility polling failures
  }
}

const openWritingPlayground = async (page: Page, optionsUrl: string) => {
  await ensurePageVisible(page)
  await page.goto(optionsUrl + "#/writing-playground", {
    waitUntil: "domcontentloaded"
  })
  await page.waitForFunction(() => !!document.querySelector("#root"), undefined, {
    timeout: 10000
  })
  await page.evaluate(() => {
    const navigate = (window as any).__tldwNavigate
    if (typeof navigate === "function") {
      navigate("/writing-playground")
    }
  })
}

const fillLabeledField = async (
  scope: Page | Locator,
  label: string,
  value: string
) => {
  const container = scope.getByText(label, { exact: true }).locator("..")
  const textarea = container.locator("textarea")
  if ((await textarea.count()) > 0) {
    await textarea.fill(value)
    return
  }
  const input = container.locator("input")
  await input.fill(value)
}

const getSelect = (page: Page, label: string) =>
  page.getByText(label, { exact: true }).locator("..").locator(".ant-select")

const ensureSelectOption = async (
  page: Page,
  label: string,
  optionName: string
) => {
  const select = getSelect(page, label)
  const current = (await select.textContent()) || ""
  if (!current.includes(optionName)) {
    await select.click()
    const option = page.getByRole("option", { name: optionName })
    await option.scrollIntoViewIfNeeded()
    await option.click({ timeout: 15000 })
  }
  await expect(select).toContainText(optionName)
}

const getSessionRow = (page: Page, name: string) =>
  page.locator(".ant-list-item").filter({ hasText: name }).first()

const closeModal = async (modal: Locator) => {
  await modal.locator(".ant-modal-close").first().click()
  await expect(modal).toBeHidden()
}

const createSession = async (page: Page, name: string) => {
  await page.getByRole("button", { name: /New session/i }).click()
  const modal = page.getByRole("dialog", { name: /New session/i })
  await expect(modal).toBeVisible()
  const input = modal.getByRole("textbox")
  await input.fill(name)
  const okButton = modal.getByRole("button", { name: /OK|Create/i })
  await okButton.click()
  await expect(modal).toBeHidden()
  const row = getSessionRow(page, name)
  await expect(row).toBeVisible({ timeout: 15000 })
  await row.click()
}

test.describe("Writing Playground themes + templates", () => {
  test("exports and imports sessions", async () => {
    const { serverUrl, apiKey } = requireRealServerConfig(test)
    const normalizedServerUrl = normalizeServerUrl(serverUrl)
    const caps = await fetchWritingCapabilities(normalizedServerUrl, apiKey)
    if (!caps?.server?.sessions) {
      test.skip(true, "Writing sessions not available on the configured server.")
    }

    const extPath = path.resolve("build/chrome-mv3")
    const { context, page, extensionId, optionsUrl } = await launchWithExtension(
      extPath,
      {
        seedConfig: {
          __tldw_first_run_complete: true,
          __tldw_allow_offline: true,
          tldwConfig: {
            serverUrl: normalizedServerUrl,
            authMode: "single-user",
            apiKey
          }
        }
      }
    )

    try {
      const origin = new URL(normalizedServerUrl).origin + "/*"
      const granted = await grantHostPermission(context, extensionId, origin)
      if (!granted) {
        test.skip(
          true,
          "Host permission not granted for tldw_server origin; allow it in chrome://extensions > tldw Assistant > Site access, then re-run"
        )
      }

      await openWritingPlayground(page, optionsUrl)
      await waitForConnected(page, "writing-playground-sessions")
      await expect(
        page.getByRole("heading", { name: /Writing Playground/i })
      ).toBeVisible()

      const unique = `${Date.now()}-${test.info().workerIndex}-${Math.random()
        .toString(36)
        .slice(2, 6)}`
      const sessionName = `E2E Writing Session ${unique}`
      await createSession(page, sessionName)

      const row = getSessionRow(page, sessionName)
      await row.scrollIntoViewIfNeeded()
      await row.locator("button").last().click()

      const [download] = await Promise.all([
        page.waitForEvent("download"),
        page.getByRole("menuitem", { name: /Export session/i }).click()
      ])

      let downloadPath = await download.path()
      if (!downloadPath) {
        const fallbackPath = path.resolve(
          "tmp-playwright-profile",
          `writing-session-${unique}.json`
        )
        await download.saveAs(fallbackPath)
        downloadPath = fallbackPath
      }

      const importInput = page.getByTestId("writing-session-import")
      await importInput.setInputFiles(downloadPath)

      const importedName = `${sessionName} (imported)`
      await expect(getSessionRow(page, importedName)).toBeVisible({
        timeout: 15000
      })
    } finally {
      await context.close()
    }
  })

  test("creates a template and inserts markers", async () => {
    const { serverUrl, apiKey } = requireRealServerConfig(test)
    const normalizedServerUrl = normalizeServerUrl(serverUrl)
    const caps = await fetchWritingCapabilities(normalizedServerUrl, apiKey)
    if (!caps?.server?.sessions || !caps?.server?.templates) {
      test.skip(true, "Writing templates not available on the configured server.")
    }

    const extPath = path.resolve("build/chrome-mv3")
    const { context, page, extensionId, optionsUrl } = await launchWithExtension(
      extPath,
      {
        seedConfig: {
          __tldw_first_run_complete: true,
          __tldw_allow_offline: true,
          tldwConfig: {
            serverUrl: normalizedServerUrl,
            authMode: "single-user",
            apiKey
          }
        }
      }
    )

    try {
      const origin = new URL(normalizedServerUrl).origin + "/*"
      const granted = await grantHostPermission(context, extensionId, origin)
      if (!granted) {
        test.skip(
          true,
          "Host permission not granted for tldw_server origin; allow it in chrome://extensions > tldw Assistant > Site access, then re-run"
        )
      }

      await openWritingPlayground(page, optionsUrl)
      await waitForConnected(page, "writing-playground-templates")
      await expect(
        page.getByRole("heading", { name: /Writing Playground/i })
      ).toBeVisible()

      const unique = `${Date.now()}-${test.info().workerIndex}-${Math.random()
        .toString(36)
        .slice(2, 6)}`
      const sessionName = `E2E Writing Session ${unique}`
      await createSession(page, sessionName)

      await page.getByRole("button", { name: /Manage templates/i }).click()
      const modal = page.getByRole("dialog", { name: /Manage templates/i })
      await expect(modal).toBeVisible()
      await modal.getByRole("button", { name: /New/i }).click()

      const templateName = `e2e-template-${unique}`
      await fillLabeledField(modal, "Template name", templateName)
      await fillLabeledField(modal, "User prefix", "User: ")
      await fillLabeledField(modal, "User suffix", " [/user]")
      await fillLabeledField(modal, "Assistant prefix", "Assistant: ")
      await fillLabeledField(modal, "Assistant suffix", " [/assistant]")

      await modal.getByRole("button", { name: /Create/i }).click()
      await expect(modal.getByText(templateName)).toBeVisible({ timeout: 15000 })
      await closeModal(modal)

      await ensureSelectOption(page, "Template", templateName)

      const editor = page.getByPlaceholder(/Start writing your prompt/i)
      await editor.fill("Hello")
      await page.evaluate(() => {
        const el = document.querySelector<HTMLTextAreaElement>("textarea")
        if (!el) return
        el.focus()
        el.setSelectionRange(0, el.value.length)
      })

      await page.getByRole("button", { name: /Insert/i }).click()
      const userMenuItem = page.getByRole("menuitem", { name: /^User$/ })
      await expect(userMenuItem).toBeEnabled({ timeout: 15000 })
      await userMenuItem.click()

      await expect.poll(async () => editor.inputValue(), { timeout: 5000 }).toContain(
        "User:"
      )
      await expect.poll(async () => editor.inputValue(), { timeout: 5000 }).toContain(
        "[/user]"
      )
    } finally {
      await context.close()
    }
  })

  test("creates and applies a theme", async () => {
    const { serverUrl, apiKey } = requireRealServerConfig(test)
    const normalizedServerUrl = normalizeServerUrl(serverUrl)
    const caps = await fetchWritingCapabilities(normalizedServerUrl, apiKey)
    if (!caps?.server?.sessions || !caps?.server?.themes) {
      test.skip(true, "Writing themes not available on the configured server.")
    }

    const extPath = path.resolve("build/chrome-mv3")
    const { context, page, extensionId, optionsUrl } = await launchWithExtension(
      extPath,
      {
        seedConfig: {
          __tldw_first_run_complete: true,
          __tldw_allow_offline: true,
          tldwConfig: {
            serverUrl: normalizedServerUrl,
            authMode: "single-user",
            apiKey
          }
        }
      }
    )

    try {
      const origin = new URL(normalizedServerUrl).origin + "/*"
      const granted = await grantHostPermission(context, extensionId, origin)
      if (!granted) {
        test.skip(
          true,
          "Host permission not granted for tldw_server origin; allow it in chrome://extensions > tldw Assistant > Site access, then re-run"
        )
      }

      await openWritingPlayground(page, optionsUrl)
      await waitForConnected(page, "writing-playground-themes")
      await expect(
        page.getByRole("heading", { name: /Writing Playground/i })
      ).toBeVisible()

      const unique = `${Date.now()}-${test.info().workerIndex}-${Math.random()
        .toString(36)
        .slice(2, 6)}`
      const sessionName = `E2E Writing Theme ${unique}`
      await createSession(page, sessionName)

      await page.getByRole("button", { name: /Manage themes/i }).click()
      const modal = page.getByRole("dialog", { name: /Manage themes/i })
      await expect(modal).toBeVisible()
      await modal.getByRole("button", { name: /New/i }).click()

      const themeName = `e2e-theme-${unique}`
      const themeClass = `e2e-theme-${unique}`
      const themeCss = `.writing-playground.${themeClass} { background-color: rgb(1, 2, 3); }`

      await fillLabeledField(modal, "Theme name", themeName)
      await fillLabeledField(modal, "Theme class", themeClass)
      await fillLabeledField(modal, "Theme CSS", themeCss)
      await fillLabeledField(modal, "Order", "1")

      await modal.getByRole("button", { name: /Create/i }).click()
      await expect(modal.getByText(themeName)).toBeVisible({ timeout: 15000 })
      await closeModal(modal)

      await ensureSelectOption(page, "Theme", themeName)

      const root = page.locator(".writing-playground")
      await expect(root).toHaveClass(new RegExp(themeClass))
      await page.waitForFunction(
        () => {
        const el = document.querySelector(".writing-playground")
        if (!el) return false
        return window.getComputedStyle(el).backgroundColor === "rgb(1, 2, 3)"
        },
        undefined,
        { timeout: 15000 }
      )
    } finally {
      await context.close()
    }
  })
})
