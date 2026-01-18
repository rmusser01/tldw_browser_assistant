import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

import { resolveExtensionId } from './extension-id'

type LaunchOptions = {
  seedConfig?: Record<string, any>
  allowOffline?: boolean
}

async function waitForStorageSeed(page: any) {
  await page.waitForFunction(
    () =>
      new Promise<boolean>((resolve) => {
        if (typeof chrome === 'undefined' || !chrome.storage?.local) {
          resolve(false)
          return
        }
        chrome.storage.local.get('__e2eSeeded', (items) => {
          resolve(Boolean(items?.__e2eSeeded))
        })
      }),
    undefined,
    { timeout: 10000 }
  )
}

function makeTempProfileDirs() {
  const root = path.resolve('tmp-playwright-profile')
  fs.mkdirSync(root, { recursive: true })
  const homeDir = fs.mkdtempSync(path.join(root, 'home-'))
  const userDataDir = fs.mkdtempSync(path.join(root, 'user-data-'))
  return { homeDir, userDataDir }
}

export async function launchWithBuiltExtension(
  { seedConfig, allowOffline }: LaunchOptions = {}
) {
  const extensionPath = path.resolve('build/chrome-mv3')
  const { homeDir, userDataDir } = makeTempProfileDirs()
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: !!process.env.CI,
    env: {
      ...process.env,
      HOME: homeDir
    },
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--disable-crash-reporter',
      '--crash-dumps-dir=/tmp'
    ]
  })

  // Seed storage before any extension pages load to bypass connection checks
  await context.addInitScript(
    (cfg, allowOfflineFlag) => {
      try {
        if (typeof chrome === 'undefined' || !chrome.storage?.local) return
        const setLocal = (data: Record<string, any>, done?: () => void) => {
          // @ts-ignore
          const setter = chrome?.storage?.local?.set
          if (typeof setter === 'function') {
            setter(data, () => done?.())
          } else {
            done?.()
          }
        }
        const setSync = (data: Record<string, any>, done?: () => void) => {
          // @ts-ignore
          const setter = chrome?.storage?.sync?.set
          if (typeof setter === 'function') {
            setter(data, () => done?.())
          } else {
            done?.()
          }
        }
        const finalize = () => {
          setLocal({ __e2eSeeded: true })
        }

        chrome.storage.local.get('__e2eSeeded', (items) => {
          if (items?.__e2eSeeded) return
          let pending = 0
          const done = () => {
            pending -= 1
            if (pending <= 0) finalize()
          }

          if (allowOfflineFlag) {
            pending += 1
            setLocal({ __tldw_allow_offline: true }, done)
          }

          if (cfg) {
            pending += 1
            setLocal({ tldwConfig: cfg }, done)
            pending += 1
            setSync({ tldwConfig: cfg }, done)
          }

          if (pending === 0) finalize()
        })
      } catch {
        // ignore storage write failures in isolated contexts
      }
    },
    seedConfig || null,
    allowOffline || false
  )

  // Wait for SW/background
  const waitForTargets = async () => {
    if (context.serviceWorkers().length || context.backgroundPages().length) return
    await Promise.race([
      context.waitForEvent('serviceworker').catch(() => null),
      context.waitForEvent('backgroundpage').catch(() => null),
      new Promise((r) => setTimeout(r, 7000))
    ])
  }
  await waitForTargets()

  const extensionId = await resolveExtensionId(context)
  const optionsUrl = `chrome-extension://${extensionId}/options.html`
  const sidepanelUrl = `chrome-extension://${extensionId}/sidepanel.html`

  const page = await context.newPage()
  await page.goto(optionsUrl)
  await waitForStorageSeed(page)

  async function openSidepanel() {
    const p = await context.newPage()
    await p.goto(sidepanelUrl)
    return p
  }

  return { context, page, openSidepanel, extensionId, optionsUrl, sidepanelUrl }
}
