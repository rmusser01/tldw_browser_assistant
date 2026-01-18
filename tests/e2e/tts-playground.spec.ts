import { test, expect } from '@playwright/test'
import path from 'path'
import { launchWithExtension } from './utils/extension'
import { grantHostPermission } from './utils/permissions'
import { requireRealServerConfig } from './utils/real-server'

const fetchAudioProviders = async (serverUrl: string, apiKey: string) => {
  const res = await fetch(`${serverUrl}/api/v1/audio/providers`, {
    headers: { 'x-api-key': apiKey }
  }).catch(() => null)
  if (!res || !res.ok) return null
  const payload = await res.json().catch(() => null)
  const providers = payload?.providers ?? payload
  if (!providers || typeof providers !== 'object' || Object.keys(providers).length === 0) {
    return null
  }
  return payload
}

const launchWithServer = async (serverUrl: string, apiKey: string) => {
  const extPath = path.resolve('build/chrome-mv3')
  return await launchWithExtension(extPath, {
    seedConfig: {
      __tldw_first_run_complete: true,
      __tldw_allow_offline: true,
      tldwConfig: {
        serverUrl,
        authMode: 'single-user',
        apiKey
      }
    }
  })
}

const selectTldwProvider = async (page: import('@playwright/test').Page) => {
  await page.getByText('Text to speech').scrollIntoViewIfNeeded()
  const providerSelect = page.getByText('Browser TTS', { exact: false })
  await providerSelect.click()
  const option = page.getByRole('option', {
    name: /tldw server \(audio\/speech\)/i
  })
  const visible = await option
    .waitFor({ state: 'visible', timeout: 5000 })
    .then(() => true)
    .catch(() => false)
  if (!visible) return false
  await option.click()
  return true
}

test.describe('TTS Playground UX', () => {
  test('plays tldw server audio and shows generated segments', async () => {
    const { serverUrl, apiKey } = requireRealServerConfig(test)
    const normalizedServerUrl = serverUrl.replace(/\/$/, '')

    const providers = await fetchAudioProviders(normalizedServerUrl, apiKey)
    if (!providers) {
      test.skip(true, 'Audio providers not available on the configured server.')
      return
    }

    const { context, page, optionsUrl, extensionId } = await launchWithServer(
      normalizedServerUrl,
      apiKey
    )

    try {
      const origin = new URL(normalizedServerUrl).origin + '/*'
      const granted = await grantHostPermission(context, extensionId, origin)
      if (!granted) {
        test.skip(
          true,
          'Host permission not granted for tldw_server origin; allow it in chrome://extensions > tldw Assistant > Site access, then re-run'
        )
        return
      }

      await page.goto(optionsUrl + '#/tts', {
        waitUntil: 'domcontentloaded'
      })

      await expect(page.getByText(/Current provider/i)).toBeVisible()

      const providerSelected = await selectTldwProvider(page)
      if (!providerSelected) {
        test.skip(true, 'tldw server option not available in provider list.')
        return
      }

      const saveButton = page.getByRole('button', { name: /save/i }).first()
      if ((await saveButton.count()) > 0 && !(await saveButton.isDisabled())) {
        await saveButton.click()
      }

      const textarea = page.getByPlaceholder(
        /Type or paste text here, then use Play to listen./i
      )
      await textarea.fill('Hello from the TTS playback test')

      await page.getByRole('button', { name: /^Play$/i }).click()

      await expect(
        page.getByText(/Generated audio segments/i)
      ).toBeVisible({ timeout: 20_000 })
      await expect(page.locator('audio')).toBeVisible()
    } finally {
      await context.close()
    }
  })

  test('shows browser TTS segment controls', async () => {
    const extPath = path.resolve('build/chrome-mv3')
    const { context, page, optionsUrl } = await launchWithExtension(extPath)

    await page.goto(optionsUrl + '#/tts', {
      waitUntil: 'domcontentloaded'
    })

    await page.getByText('Text to speech').scrollIntoViewIfNeeded()
    const providerSelect = page.getByText('Browser TTS', { exact: false })
    await providerSelect.click()
    await page.getByRole('option', { name: /Browser TTS/i }).click()

    await page
      .getByPlaceholder(/Type or paste text here, then use Play to listen./i)
      .fill('Browser TTS test sentence one. Sentence two.')

    await page.getByRole('button', { name: /^Play$/i }).click()

    await expect(page.getByText(/Browser TTS segments/i)).toBeVisible()
    await expect(
      page.getByRole('button', { name: /Queue all/i })
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: /Play segment/i })
    ).toBeVisible()

    await context.close()
  })

  test('disables Play when ElevenLabs config is incomplete', async () => {
    const extPath = path.resolve('build/chrome-mv3')
    const { context, page, optionsUrl } = await launchWithExtension(extPath)

    await page.goto(optionsUrl + '#/tts', {
      waitUntil: 'domcontentloaded'
    })

    await page.getByText('Text to speech').scrollIntoViewIfNeeded()
    const providerSelect = page.getByText('Browser TTS', { exact: false })
    await providerSelect.click()
    await page.getByRole('option', { name: /ElevenLabs/i }).click()
    await page.getByRole('button', { name: /save/i }).first().click()
    await expect(page.getByText(/ElevenLabs needs an API key/i)).toBeVisible()

    await page
      .getByPlaceholder(/Type or paste text here, then use Play to listen./i)
      .fill('Hello from the ElevenLabs config test')

    const playButton = page.getByRole('button', { name: /^Play$/i })
    await expect(playButton).toBeDisabled()
    await expect(
      page.getByText(/Add an ElevenLabs API key, voice, and model/i)
    ).toBeVisible()
    await expect(page.getByText(/ElevenLabs needs an API key/i)).toBeVisible()

    await context.close()
  })

  test('shows tldw provider capabilities and voices preview from /audio/providers', async () => {
    const { serverUrl, apiKey } = requireRealServerConfig(test)
    const normalizedServerUrl = serverUrl.replace(/\/$/, '')

    const providers = await fetchAudioProviders(normalizedServerUrl, apiKey)
    if (!providers) {
      test.skip(true, 'Audio providers not available on the configured server.')
      return
    }

    const { context, page, optionsUrl, extensionId } = await launchWithServer(
      normalizedServerUrl,
      apiKey
    )

    try {
      const origin = new URL(normalizedServerUrl).origin + '/*'
      const granted = await grantHostPermission(context, extensionId, origin)
      if (!granted) {
        test.skip(
          true,
          'Host permission not granted for tldw_server origin; allow it in chrome://extensions > tldw Assistant > Site access, then re-run'
        )
        return
      }

      await page.goto(optionsUrl + '#/tts', {
        waitUntil: 'domcontentloaded'
      })

      const providerSelected = await selectTldwProvider(page)
      if (!providerSelected) {
        test.skip(true, 'tldw server option not available in provider list.')
        return
      }

      const saveButton = page.getByRole('button', { name: /save/i }).first()
      if ((await saveButton.count()) > 0 && !(await saveButton.isDisabled())) {
        await saveButton.click()
      }

      await expect(
        page.getByText(/audio API detected/i)
      ).toBeVisible({ timeout: 15_000 })

      await expect(page.getByText(/Provider capabilities/i)).toBeVisible({
        timeout: 10_000
      })
      await expect(page.getByText(/Server voices/i)).toBeVisible()

      await expect(
        page.getByRole('button', { name: /View raw provider config/i })
      ).toBeVisible()
    } finally {
      await context.close()
    }
  })
})
