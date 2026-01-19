import { test, expect } from '@playwright/test'
import { launchWithBuiltExtension } from './utils/extension-build'
import {
  waitForConnectionStore,
  forceConnected
} from './utils/connection'

test.describe('Notes workspace UX', () => {
  test('shows offline empty state and disables editor when not connected', async () => {
    const { context, page, optionsUrl } = await launchWithBuiltExtension()

    await page.goto(optionsUrl + '#/notes')
    await page.waitForLoadState('networkidle')

    const headline = page.getByText(/Connect to use Notes|Explore Notes in demo mode/i)
    await expect(headline).toBeVisible()

    const editorPanel = page.locator('div[aria-disabled="true"]').last()
    await expect(editorPanel).toBeVisible()

    const textarea = page.getByPlaceholder('Write your note here...')
    await expect(textarea).toHaveAttribute('readonly', '')

    await expect(
      page.getByRole('button', { name: /Copy note content/i })
    ).toHaveCount(1)
    await expect(
      page.getByRole('button', { name: /Export note as Markdown/i })
    ).toHaveCount(1)
    await expect(
      page.getByRole('button', { name: /Delete note/i })
    ).toHaveCount(1)

    const settingsCta = page.getByRole('button', {
      name: /Set up server|Open tldw server settings/i
    })
    await settingsCta.click()
    await expect(page).toHaveURL(/#\/settings\/tldw/i)
    await expect(
      page.getByRole('heading', { name: /tldw Server Configuration/i })
    ).toBeVisible()

    await context.close()
  })

  test('asks before discarding unsaved editor changes', async () => {
    const { context, page, optionsUrl } = await launchWithBuiltExtension()

    await page.goto(optionsUrl, { waitUntil: 'networkidle' })
    await waitForConnectionStore(page, 'notes-connected')
    await forceConnected(page, { serverUrl: 'http://dummy-tldw' }, 'notes-connected')

    await page.goto(optionsUrl + '#/notes')
    await page.waitForLoadState('networkidle')

    const textarea = page.getByPlaceholder('Write your note here...')
    await textarea.fill('Unsaved note content')
    const unsavedTag = page.locator('.ant-tag', { hasText: 'Unsaved' })
    await expect(unsavedTag).toBeVisible()

    const newNoteButton = page.getByTestId('notes-new-button')
    await expect(newNoteButton).toBeEnabled()
    await newNoteButton.click()

    const discardDialog = page.getByRole('dialog', { name: /Discard changes\?/i })
    await expect(discardDialog).toBeVisible()

    const cancelButton = discardDialog.getByRole('button', { name: /Cancel/i })
    await cancelButton.click()
    await expect(discardDialog).toBeHidden()
    await expect(textarea).toHaveValue('Unsaved note content')

    await newNoteButton.click()
    const discardDialogAgain = page.getByRole('dialog', { name: /Discard changes\?/i })
    await expect(discardDialogAgain).toBeVisible()
    const discardButton = discardDialogAgain.getByRole('button', { name: /Discard/i })
    await discardButton.click()
    await expect(textarea).toHaveValue('')

    await context.close()
  })
})
