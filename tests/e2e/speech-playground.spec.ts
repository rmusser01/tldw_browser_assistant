import { test, expect } from '@playwright/test'
import path from 'path'
import { launchWithExtension } from './utils/extension'

test.describe('Speech Playground UX', () => {
  test('supports transcript lock/unlock, copy toast, and download tooltip', async () => {
    const extPath = path.resolve('build/chrome-mv3')
    const { context, page, optionsUrl } = await launchWithExtension(extPath, {
      seedConfig: {
        tldwConfig: {
          serverUrl: 'http://127.0.0.1:8000',
          authMode: 'single-user',
          apiKey: 'test-key'
        },
        speechPlaygroundMode: 'roundtrip',
        __tldw_first_run_complete: true,
        __tldw_allow_offline: true
      }
    })

    await page.addInitScript(() => {
      window.__e2eMicStub = true
      const fakeStream = { getTracks: () => [] }
      const mediaDevices = navigator.mediaDevices || {}
      Object.defineProperty(mediaDevices, 'getUserMedia', {
        value: async () => fakeStream,
        configurable: true
      })
      Object.defineProperty(navigator, 'mediaDevices', {
        value: mediaDevices,
        configurable: true
      })

      Object.defineProperty(navigator, 'clipboard', {
        value: {
          writeText: async () => {}
        },
        configurable: true
      })

      window.__lastRecorder = null

      class FakeMediaRecorder {
        static isTypeSupported() {
          return true
        }

        constructor(stream) {
          this.stream = stream
          this.mimeType = 'audio/webm'
          this.state = 'inactive'
          this.ondataavailable = null
          this.onstop = null
          this.onerror = null
          window.__lastRecorder = this
        }

        start() {
          this.state = 'recording'
          setTimeout(() => {
            if (typeof this.ondataavailable === 'function') {
              const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/webm' })
              this.ondataavailable({ data: blob })
            }
          }, 50)
        }

        stop() {
          this.state = 'inactive'
          setTimeout(() => {
            if (typeof this.onstop === 'function') {
              this.onstop()
            }
          }, 50)
        }
      }

      Object.defineProperty(window, 'MediaRecorder', {
        value: FakeMediaRecorder,
        configurable: true
      })

      const mockSendMessage = async (payload) => {
        if (payload?.type === 'tldw:request') {
          const path = payload?.payload?.path
          if (path === '/api/v1/media/transcription-models') {
            return { ok: true, status: 200, data: { all_models: ['whisper-1'] } }
          }
          return { ok: true, status: 200, data: {} }
        }
        if (payload?.type === 'tldw:upload') {
          const path = payload?.payload?.path
          if (path === '/api/v1/audio/transcriptions') {
            return { ok: true, status: 200, data: { text: 'Test transcript' } }
          }
          return { ok: true, status: 200, data: {} }
        }
        return { ok: true, status: 200, data: {} }
      }

      if (window.chrome?.runtime) {
        Object.defineProperty(window.chrome.runtime, 'sendMessage', {
          value: mockSendMessage,
          configurable: true
        })
      }

      if (window.browser?.runtime) {
        Object.defineProperty(window.browser.runtime, 'sendMessage', {
          value: mockSendMessage,
          configurable: true
        })
      }
    })

    const baseUrl = `${optionsUrl}?e2e=1`
    await page.goto(baseUrl + '#/tts', { waitUntil: 'domcontentloaded' })
    await page.waitForFunction(() => window.__e2eMicStub === true)

    const ttsInput = page.getByPlaceholder('Type or paste text here, then use Play to listen.')
    const recordButton = page.getByRole('button', { name: 'Record' })

    await expect(ttsInput).toBeVisible()
    await expect(recordButton).toHaveCount(0)

    await page.goto(baseUrl + '#/speech', { waitUntil: 'domcontentloaded' })
    await expect(ttsInput).toBeVisible()
    await expect(recordButton).toHaveCount(0)

    const listenSelected = page.locator('.ant-segmented-item-selected').filter({ hasText: 'Listen' })
    await expect(listenSelected).toBeVisible()

    const roundTripToggle = page.locator('.ant-segmented-item').filter({ hasText: 'Round-trip' })
    await roundTripToggle.click()
    await expect(page.locator('.ant-segmented-item-selected').filter({ hasText: 'Round-trip' })).toBeVisible()
    await page.keyboard.press('Escape')

    const sttCard = page.locator('.ant-card').filter({ hasText: 'Current transcription model' })
    await expect(sttCard).toBeVisible()
    const sttRecordButton = sttCard.getByRole('button', { name: 'Record' })
    await sttRecordButton.click({ force: true })

    await page.waitForFunction(
      () => {
        return window.__lastRecorder?.state === 'recording'
      },
      null,
      { timeout: 5000 }
    )

    const transcriptArea = sttCard.getByPlaceholder('Live transcript will appear here while recording.')
    await transcriptArea.scrollIntoViewIfNeeded()
    await expect(
      sttCard.getByText('Recording in progress; transcript is locked.')
    ).toBeVisible()
    await expect(sttCard.getByRole('button', { name: 'Unlock' })).toBeDisabled()

    await page.evaluate(() => {
      window.__lastRecorder?.stop?.()
    })
    await transcriptArea.scrollIntoViewIfNeeded()
    await expect(transcriptArea).toHaveValue('Test transcript', { timeout: 5000 })

    const unlockButton = sttCard.getByRole('button', { name: 'Unlock' })
    await unlockButton.click()
    await expect(transcriptArea).toBeEditable()
    await transcriptArea.fill('Edited transcript')
    await expect(transcriptArea).toHaveValue('Edited transcript')

    const lockButton = sttCard.getByRole('button', { name: 'Lock' })
    await lockButton.click()
    await expect(transcriptArea).not.toBeEditable()

    const copyButton = page.getByRole('button', { name: 'Copy' }).first()
    await copyButton.click()
    await expect(page.getByText('Copied to clipboard')).toBeVisible()

    const downloadButton = page.getByRole('button', { name: 'Download' })
    await downloadButton.hover()
    await expect(
      page.getByText('Browser TTS does not create downloadable audio.')
    ).toBeVisible()
    await context.close()
  })
})
