import { test, expect } from '@playwright/test'
import { launchWithBuiltExtension } from './utils/extension-build'

test.describe('Quick ingest presets', () => {
  test('switches presets and persists custom values', async () => {
    const { context, page, optionsUrl } = await launchWithBuiltExtension({
      allowOffline: true
    })

    try {
      await page.goto(optionsUrl + '#/media', { waitUntil: 'domcontentloaded' })

      const ingestButton = page
        .getByRole('button', { name: /Quick ingest/i })
        .first()
      await expect(ingestButton).toBeVisible()
      await ingestButton.click()

      const modal = page.locator('.quick-ingest-modal .ant-modal-content')
      await expect(modal).toBeVisible()

      await modal.getByRole('tab', { name: /Options/i }).click()

      const presetSelect = modal
        .locator('.ant-select')
        .filter({ hasText: /Standard|Quick|Deep|Custom/i })
        .first()
      await expect(presetSelect).toBeVisible()
      const presetValue = presetSelect.locator('.ant-select-selection-item')
      await expect(presetValue).toContainText(/Standard/i)

      await presetSelect.click()
      await page.getByRole('option', { name: /Deep/i }).click()
      await expect(presetValue).toContainText(/Deep/i)

      const reviewSwitch = modal.getByRole('switch', {
        name: /Review before saving/i
      })
      await expect(reviewSwitch).toHaveAttribute('aria-checked', 'true')

      const resetDefaults = modal.getByRole('button', {
        name: /Reset to defaults/i
      })
      await expect(resetDefaults).toBeVisible()
      await resetDefaults.click()
      await expect(presetValue).toContainText(/Standard/i)
      await expect(reviewSwitch).toHaveAttribute('aria-checked', 'false')

      await presetSelect.click()
      await page.getByRole('option', { name: /Quick/i }).click()
      await expect(presetValue).toContainText(/Quick/i)

      const analysisSwitch = modal.getByRole('switch', {
        name: /analysis/i
      })
      const chunkingSwitch = modal.getByRole('switch', {
        name: /chunking/i
      })
      await expect(analysisSwitch).toHaveAttribute('aria-checked', 'false')
      await expect(chunkingSwitch).toHaveAttribute('aria-checked', 'false')

      await chunkingSwitch.click()
      await expect(chunkingSwitch).toHaveAttribute('aria-checked', 'true')
      await expect(presetValue).toContainText(/Custom/i)

      await modal.getByRole('button', { name: /Close quick ingest/i }).click()
      await expect(modal).toBeHidden()

      await ingestButton.click()
      await expect(modal).toBeVisible()
      await modal.getByRole('tab', { name: /Options/i }).click()

      await expect(presetValue).toContainText(/Custom/i)
      await expect(analysisSwitch).toHaveAttribute('aria-checked', 'false')
      await expect(chunkingSwitch).toHaveAttribute('aria-checked', 'true')
    } finally {
      await context.close()
    }
  })
})
