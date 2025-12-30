import { test, expect } from '@playwright/test'
import path from 'path'
import { launchWithExtension } from './utils/extension'

test.describe('STT Playground UX', () => {
  test('shows transcribing state after stop', async () => {
    const extPath = path.resolve('build/chrome-mv3')
    const { context, page, optionsUrl } = await launchWithExtension(extPath)

    await context.addInitScript(() => {
      const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext
      let fakeStream = null

      if (AudioCtx) {
        try {
          const ctx = new AudioCtx()
          const oscillator = ctx.createOscillator()
          const destination = ctx.createMediaStreamDestination()
          oscillator.connect(destination)
          oscillator.start()
          fakeStream = destination.stream
          ctx.resume().catch(() => {})
        } catch {
          fakeStream = null
        }
      }

      if (!fakeStream && typeof MediaStream !== 'undefined') {
        fakeStream = new MediaStream()
      }

      if (!fakeStream) {
        fakeStream = { getTracks: () => [], getAudioTracks: () => [] }
      }

      const mediaDevices = navigator.mediaDevices || {}
      try {
        mediaDevices.getUserMedia = async () => fakeStream
      } catch {}
      try {
        Object.defineProperty(mediaDevices, 'getUserMedia', {
          value: async () => fakeStream,
          configurable: true
        })
      } catch {}
      try {
        Object.defineProperty(navigator, 'mediaDevices', {
          value: mediaDevices,
          configurable: true
        })
      } catch {}

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
        }

        start() {
          this.state = 'recording'
        }

        stop() {
          this.state = 'inactive'
          setTimeout(() => {
            if (typeof this.onstop === 'function') {
              this.onstop()
            }
          }, 800)
        }
      }

      try {
        window.MediaRecorder = FakeMediaRecorder
      } catch {
        Object.defineProperty(window, 'MediaRecorder', {
          value: FakeMediaRecorder,
          configurable: true,
          writable: true
        })
      }
    })

    await page.goto(optionsUrl + '#/stt', { waitUntil: 'domcontentloaded' })

    const recordButton = page.getByRole('button', { name: 'Record' })
    await expect(recordButton).toBeVisible()

    await recordButton.click()
    const stopButton = page.getByRole('button', { name: 'Stop' })
    await expect(stopButton).toBeVisible()

    await stopButton.click()

    const transcribingButton = page.getByRole('button', {
      name: 'Transcribing...'
    })
    await expect(transcribingButton).toBeVisible()
    await expect(transcribingButton).toBeDisabled()
    await expect(
      page.getByPlaceholder('Transcribing audio...')
    ).toBeVisible()

    await expect(page.getByRole('button', { name: 'Record' })).toBeVisible({
      timeout: 5000
    })

    await context.close()
  })
})
