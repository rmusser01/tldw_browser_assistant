import { test, expect } from "@playwright/test"
import { launchWithBuiltExtension } from "./utils/extension-build"
import { forceErrorUnreachable, waitForConnectionStore } from "./utils/connection"
import { grantHostPermission } from "./utils/permissions"
import { requireRealServerConfig } from "./utils/real-server"

test.describe('i18n smoke test for Quick Ingest & Characters', () => {
  test('non-English locale resolves Quick Ingest hint and None character option', async () => {
    const { serverUrl, apiKey } = requireRealServerConfig(test)

    const { context, page, extensionId, optionsUrl } =
      await launchWithBuiltExtension({
        seedConfig: {
          serverUrl,
          authMode: 'single-user',
          apiKey
        }
      })

    const granted = await grantHostPermission(
      context,
      extensionId,
      new URL(serverUrl).origin + "/*"
    )
    if (!granted) {
      test.skip(
        true,
        "Host permission not granted for tldw_server origin"
      )
    }

    await page.goto(optionsUrl)

    // Force a non-English locale (German) and reload so i18next picks it up.
    await page.evaluate(() => {
      window.localStorage.setItem('i18nextLng', 'de')
    })
    await page.reload()

    await waitForConnectionStore(page, 'i18n-quick-ingest-hint')
    await forceErrorUnreachable(
      page,
      { serverUrl },
      'i18n-quick-ingest-hint'
    )

    // Open troubleshooting options so the hint is visible.
    const advancedToggle = page.getByTestId('toggle-advanced-troubleshooting')
    await expect(advancedToggle).toBeVisible()
    await advancedToggle.click()

    const inlineHint = page.getByTestId('connection-card-quick-ingest-hint')
    await expect(inlineHint).toBeVisible()
    await expect(inlineHint).not.toHaveText(
      /option:connectionCard\.quickIngestInlineHint/i
    )

    // Open the Playground and verify the Characters selector shows localized search
    // and a "None" option without missing-key literals.
    await page.goto(`${optionsUrl}#/playground`)

    const trigger = page
      .getByRole('button', { name: /Select character/i })
      .first()
    await expect(trigger).toBeVisible()
    await trigger.click()

    // Search input placeholder should resolve for the non-English locale.
    const searchInput = page.getByPlaceholder(/Search characters by name/i)
    await expect(searchInput).toBeVisible()

    // Missing-key literal for search placeholder should not appear.
    await expect(
      page.getByText(/option:characters\.searchPlaceholder/i)
    ).toHaveCount(0)

    const noneOption = page.getByText(/None \(no character\)/i).first()
    await expect(noneOption).toBeVisible()

    await context.close()
  })
})
