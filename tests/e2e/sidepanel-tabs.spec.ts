import { test, expect } from "@playwright/test"
import path from "path"
import { launchWithExtension } from "./utils/extension"

const EXT_PATH = path.resolve("build/chrome-mv3")

test.describe("Sidepanel chat tabs", () => {
  test("opens, switches, and closes tabs", async () => {
    const { context, openSidepanel } = (await launchWithExtension(EXT_PATH)) as any
    const page = await openSidepanel()

    await page.waitForSelector("#root >> *", { timeout: 15_000 })
    await page.getByRole("tablist").waitFor({ state: "visible", timeout: 15_000 })

    const tabs = page.getByRole("tab")
    await expect(tabs).toHaveCount(1)

    await page.getByRole("button", { name: /New chat tab/i }).click()
    await expect(tabs).toHaveCount(2)

    await tabs.nth(0).click()
    await tabs.nth(1).click()

    const closeButtons = page.getByRole("button", { name: /Close chat tab/i })
    await closeButtons.last().click()
    await expect(tabs).toHaveCount(1)

    await context.close()
  })

  test("keeps drafts and model settings per tab", async () => {
    test.setTimeout(90_000)
    const { context, openSidepanel } = (await launchWithExtension(EXT_PATH, {
      seedConfig: {
        __tldw_first_run_complete: true,
        __tldw_allow_offline: true
      }
    })) as any
    const page = await openSidepanel()

    await page.waitForSelector("#root >> *", { timeout: 15_000 })
    await page.getByRole("tablist").waitFor({ state: "visible", timeout: 15_000 })

    const openModelSettings = async () => {
      await page
        .getByRole("button", { name: /Open current chat settings/i })
        .click()
      const dialog = page.getByRole("dialog", {
        name: /Current Chat Model Settings/i
      })
      await expect(dialog).toBeVisible()
      return dialog
    }

    const setTemperature = async (value: number) => {
      const dialog = await openModelSettings()
      const tempInput = dialog.getByLabel(/Temperature/i)
      await tempInput.click()
      await tempInput.fill("")
      await tempInput.type(String(value))
      await tempInput.press("Tab")
      await expect(tempInput).toHaveValue(String(value))
      await dialog.getByRole("button", { name: "Save", exact: true }).click()
      await expect(dialog).toBeHidden()
    }

    const readTemperature = async (expected: number) => {
      const dialog = await openModelSettings()
      const tempInput = dialog.getByLabel(/Temperature/i)
      await expect(tempInput).toHaveValue(new RegExp(`^${expected}(\\.0+)?$`))
      const value = Number.parseFloat(await tempInput.inputValue())
      await dialog.getByRole("button", { name: /Close/i }).click()
      await expect(dialog).toBeHidden()
      return value
    }

    const textarea = page.locator("textarea").first()
    await textarea.scrollIntoViewIfNeeded()
    await textarea.fill("Draft tab one")
    await page.waitForTimeout(200)

    await setTemperature(1)

    await page.getByRole("button", { name: /New chat tab/i }).click()
    await expect(page.getByRole("tab")).toHaveCount(2)
    await expect(textarea).toHaveValue("")
    await textarea.fill("Draft tab two")
    await page.waitForTimeout(200)

    await setTemperature(2)

    await page.getByRole("tab").first().click()
    await expect(textarea).toHaveValue("Draft tab one")
    const tempTabOneAfterSwitch = await readTemperature(1)
    expect(tempTabOneAfterSwitch).toBe(1)

    await page.getByRole("tab").nth(1).click()
    await expect(textarea).toHaveValue("Draft tab two")
    const tempAfterSwitch = await readTemperature(2)
    expect(tempAfterSwitch).toBe(2)

    await context.close()
  })
})
