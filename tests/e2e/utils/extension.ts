import { BrowserContext, Page, chromium } from '@playwright/test'
import path from 'path'
import fs from 'fs'

import { resolveExtensionId } from './extension-id'

async function waitForStorageSeed(page: Page) {
  await page.waitForFunction(
    () =>
      new Promise<boolean>((resolve) => {
        // Ensure we're in an extension context with chrome.storage
        if (typeof chrome === 'undefined' || !chrome.storage?.local) {
          resolve(false)
          return
        }

        chrome.storage.local.get('__e2eSeeded', (items) => {
          resolve(!!items.__e2eSeeded)
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

export interface LaunchWithExtensionResult {
  context: BrowserContext
  page: Page
  extensionId: string
  optionsUrl: string
  sidepanelUrl: string
  openSidepanel: () => Promise<Page>
}

export async function launchWithExtension(
  extensionPath: string,
  {
    seedConfig
  }: { seedConfig?: Record<string, any> } = {}
): Promise<LaunchWithExtensionResult> {
  // Pick the first existing extension build so tests work whether dev output or prod build is present.
  const candidates = [
    extensionPath,
    path.resolve('.output/chrome-mv3'),
    path.resolve('build/chrome-mv3')
  ]
  const extPath = candidates.find((p) => fs.existsSync(p))
  if (!extPath) {
    throw new Error(
      `No extension build found. Tried: ${candidates.join(
        ', '
      )}. Run "bun run build:chrome" first.`
    )
  }

  const { homeDir, userDataDir } = makeTempProfileDirs()

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: !!process.env.CI,
    env: {
      ...process.env,
      HOME: homeDir
    },
    args: [
      `--disable-extensions-except=${extPath}`,
      `--load-extension=${extPath}`,
      '--disable-crash-reporter',
      '--crash-dumps-dir=/tmp'
    ]
  })

  // Wait for background targets to appear (service worker or background page)
  const waitForTargets = async () => {
    // Already present?
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

  // Ensure each test run starts from a clean extension storage state so
  // first-run onboarding and connection flows behave deterministically.
  // If seedConfig is provided, we clear first then set, ensuring both happen
  // in the same script to avoid race conditions.
  if (seedConfig) {
    await context.addInitScript((cfg) => {
      if (typeof chrome === 'undefined' || !chrome.storage?.local) {
        return
      }

      chrome.storage.local.clear(() => {
        chrome.storage.local.set(cfg, () => {
          chrome.storage.local.set({ __e2eSeeded: true }, () => {
            // Sentinel written after clear + seed complete
          })
        })
      })
    }, seedConfig)
  } else {
    await context.addInitScript(() => {
      if (typeof chrome === 'undefined' || !chrome.storage?.local) {
        return
      }

      chrome.storage.local.clear(() => {
        chrome.storage.local.set({ __e2eSeeded: true }, () => {
          // Sentinel written after clear complete
        })
      })
    })
  }

  const page = await context.newPage()
  // Ensure the extension is ready before navigating
  await page.waitForTimeout(250)
  await page.goto(optionsUrl)
  // Wait until storage has been cleared/seeded (sentinel set)
  await waitForStorageSeed(page)

  async function openSidepanel() {
    const p = await context.newPage()
    await p.goto(sidepanelUrl)
    await waitForStorageSeed(p)
    return p
  }

  return { context, page, extensionId, optionsUrl, sidepanelUrl, openSidepanel }
}
