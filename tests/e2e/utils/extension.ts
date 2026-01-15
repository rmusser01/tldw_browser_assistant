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
  const isDevBuild = (dir: string) => {
    const optionsPath = path.join(dir, 'options.html')
    if (!fs.existsSync(optionsPath)) return false
    const html = fs.readFileSync(optionsPath, 'utf8')
    return (
      html.includes('http://localhost:') ||
      html.includes('/@vite/client') ||
      html.includes('virtual:wxt-html-plugins')
    )
  }

  // Pick the first existing extension build so tests work whether dev output or prod build is present.
  const candidates = [
    extensionPath,
    path.resolve('.output/chrome-mv3'),
    path.resolve('build/chrome-mv3')
  ].filter((p) => p && fs.existsSync(p))
  const allowDev = ['1', 'true', 'yes'].includes(
    String(process.env.TLDW_E2E_ALLOW_DEV || '').toLowerCase()
  )
  const prodCandidates = candidates.filter((p) => !isDevBuild(p))
  const devCandidates = candidates.filter((p) => isDevBuild(p))
  const extPath =
    prodCandidates[0] || (allowDev ? devCandidates[0] : undefined)
  if (!extPath) {
    const devHint = devCandidates.length
      ? 'Found only dev-server builds. Run "bun run build:chrome" or start the dev server and set TLDW_E2E_ALLOW_DEV=1.'
      : 'Run "bun run build:chrome" first.'
    throw new Error(
      `No production extension build found. Tried: ${candidates.join(
        ', '
      )}. ${devHint}`
    )
  }

  const { homeDir, userDataDir } = makeTempProfileDirs()

  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: !!process.env.CI,
    acceptDownloads: true,
    ignoreDefaultArgs: ['--disable-extensions'],
    env: {
      ...process.env,
      HOME: homeDir
    },
    executablePath: executablePath || undefined,
    args: [
      `--disable-extensions-except=${extPath}`,
      `--load-extension=${extPath}`,
      '--no-crashpad',
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
    await p.goto(sidepanelUrl, { waitUntil: 'domcontentloaded' })
    // Ensure the sidepanel tab is visible; some UI only renders when visible.
    try {
      await p.bringToFront()
    } catch {
      // ignore bringToFront failures in headless contexts
    }
    // Ensure the sidepanel app has a root to mount into before returning.
    const root = p.locator('#root')
    try {
      await root.waitFor({ state: 'visible', timeout: 10000 })
    } catch {
      // Ignore if the root is not visible yet; downstream tests will assert.
    }
    await waitForStorageSeed(p)
    return p
  }

  return { context, page, extensionId, optionsUrl, sidepanelUrl, openSidepanel }
}
