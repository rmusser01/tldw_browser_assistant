import { test, expect } from "@playwright/test"
import path from "path"
import { launchWithExtension } from "./utils/extension"

test.describe("Prompts workspace UX", () => {
  test("walks through prompts workflows end-to-end", async () => {
    test.setTimeout(120000)
    const baseName = `E2E Prompt ${Date.now()}`
    const extPath = path.resolve("build/chrome-mv3")
    const { context, page, extensionId, optionsUrl } = (await launchWithExtension(extPath)) as any

    await page.goto(`${optionsUrl}#/prompts`)
    await page.waitForLoadState("domcontentloaded")

    await expect(page.getByText(/Prompts/i).first()).toBeVisible()
    const customPanel = page.getByTestId("prompts-custom")
    await expect(customPanel).toBeVisible({ timeout: 15000 })

    await page.getByTestId("prompts-add").click()
    await expect(page.getByTestId("prompt-create-title")).toBeVisible()
    await page.getByTestId("prompt-create-title").fill(baseName)
    await page.getByTestId("prompt-create-system").fill(`${baseName} System`)
    await page.getByTestId("prompt-create-user").fill(`${baseName} User`)

    const keywordSelect = page.getByTestId("prompt-create-keywords")
    await keywordSelect.click()
    await keywordSelect.getByRole("combobox").fill("e2e")
    await keywordSelect.getByRole("combobox").press("Enter")

    await page.getByTestId("prompt-create-save").click()
    await expect(page.getByTestId("prompt-create-save")).toBeHidden()

    const searchInput = page.getByTestId("prompts-search")
    await searchInput.fill(baseName)
    await expect(page.getByText(baseName, { exact: true })).toBeVisible()

    const promptRow = page
      .locator("tr")
      .filter({ hasText: baseName })
      .first()
    await expect(promptRow).toBeVisible()

    await promptRow.getByRole("button", { name: /Duplicate Prompt/i }).click()
    await expect(page.getByText(`${baseName} (Copy)`)).toBeVisible()

    await promptRow.getByRole("button", { name: /Edit Prompt/i }).click()
    await expect(page.getByTestId("prompt-edit-details")).toBeVisible()
    await page.getByTestId("prompt-edit-details").fill(`${baseName} details updated`)
    await page.getByTestId("prompt-edit-save").click()
    await expect(page.getByText(`${baseName} details updated`)).toBeVisible()

    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 15000 }),
      page.getByTestId("prompts-export").click()
    ])
    expect(download.suggestedFilename()).toMatch(/^prompts_/)

    const importId = `import-${Date.now()}`
    const importPayload = JSON.stringify([
      {
        id: importId,
        title: `${baseName} Imported`,
        name: `${baseName} Imported`,
        content: `${baseName} Imported content`,
        is_system: false,
        keywords: ["e2e-import"],
        createdAt: Date.now()
      }
    ])
    await page.setInputFiles('[data-testid="prompts-import-file"]', {
      name: "prompts.json",
      mimeType: "application/json",
      buffer: Buffer.from(importPayload)
    })
    await expect(page.getByText(/Prompt Added/i).first()).toBeVisible({
      timeout: 15000
    })
    if (page.isClosed()) {
      throw new Error("Page closed before import result could be verified.")
    }
    await expect(page.getByTestId(`prompt-row-${importId}`)).toBeVisible({
      timeout: 15000
    })

    await context.close()
  })
})
