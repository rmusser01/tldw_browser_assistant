/**
 * Visual QA tests for the new UX redesign.
 * Captures screenshots of all new components with feature flags enabled.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

import { launchWithExtension } from './utils/extension'
import { forceConnected, waitForConnectionStore } from './utils/connection'
import { injectSyntheticMessages } from './utils/synthetic-messages'
import { withAllFeaturesEnabled, withFeatures, FEATURE_FLAG_KEYS } from './utils/feature-flags'

const ARTIFACTS_DIR = path.resolve('playwright-mcp-artifacts/new-ux')

// Ensure artifacts directory exists
test.beforeAll(() => {
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true })
})

// Helper to save screenshot with consistent naming
async function saveScreenshot(page: any, name: string, fullPage = true) {
  const filePath = path.join(ARTIFACTS_DIR, `${name}.png`)
  await page.screenshot({ path: filePath, fullPage })
  console.log(`📸 Saved: ${filePath}`)
  return filePath
}

// Helper to capture console errors
function captureConsole(page: any): string[] {
  const messages: string[] = []
  page.on('console', (msg: any) => {
    const type = msg.type()
    if (type === 'error' || type === 'warning') {
      messages.push(`[${type}] ${msg.text()}`)
    }
  })
  return messages
}

test.describe('New UX Visual QA - Onboarding', () => {
  test('new single-step onboarding form', async () => {
    const { context, page } = await launchWithExtension('', {
      seedConfig: withFeatures([FEATURE_FLAG_KEYS.NEW_ONBOARDING])
      // No serverUrl triggers onboarding
    })

    const consoleErrors = captureConsole(page)

    // Wait for the onboarding form to appear
    await page.waitForTimeout(1000)

    await saveScreenshot(page, '01-onboarding-new-form')

    // Check for console errors
    if (consoleErrors.length > 0) {
      fs.writeFileSync(
        path.join(ARTIFACTS_DIR, '01-onboarding-console.txt'),
        consoleErrors.join('\n')
      )
      console.log('⚠️ Console errors found:', consoleErrors.length)
    }

    await context.close()
  })
})

test.describe('New UX Visual QA - Chat Interface', () => {
  test('sidepanel with new control row (labels + keyboard hints)', async () => {
    const { context, page, openSidepanel } = await launchWithExtension('', {
      seedConfig: withAllFeaturesEnabled({
        serverUrl: 'http://127.0.0.1:8000',
        authMode: 'single-user',
      })
    })

    const consoleErrors = captureConsole(page)

    // Force connected state
    await waitForConnectionStore(page, 'before-force')
    await forceConnected(page)
    await waitForConnectionStore(page, 'after-force')

    // Open sidepanel and capture
    const sidepanel = await openSidepanel()
    const sidepanelErrors = captureConsole(sidepanel)

    await sidepanel.waitForTimeout(500)
    await saveScreenshot(sidepanel, '02-sidepanel-new-control-row')

    // Log any errors
    const allErrors = [...consoleErrors, ...sidepanelErrors]
    if (allErrors.length > 0) {
      fs.writeFileSync(
        path.join(ARTIFACTS_DIR, '02-sidepanel-console.txt'),
        allErrors.join('\n')
      )
    }

    await context.close()
  })

  test('sidepanel with compact messages', async () => {
    const { context, page, openSidepanel } = await launchWithExtension('', {
      seedConfig: withAllFeaturesEnabled({
        serverUrl: 'http://127.0.0.1:8000',
        authMode: 'single-user',
      })
    })

    await waitForConnectionStore(page, 'before-force')
    await forceConnected(page)

    const sidepanel = await openSidepanel()
    const consoleErrors = captureConsole(sidepanel)

    // Inject synthetic messages to test compact layout
    const injectResult = await injectSyntheticMessages(sidepanel, 5)
    if (!injectResult.ok) {
      console.log('⚠️ Could not inject messages:', injectResult.reason)
    }

    await sidepanel.waitForTimeout(500)
    await saveScreenshot(sidepanel, '03-sidepanel-compact-messages')

    if (consoleErrors.length > 0) {
      fs.writeFileSync(
        path.join(ARTIFACTS_DIR, '03-compact-messages-console.txt'),
        consoleErrors.join('\n')
      )
    }

    await context.close()
  })

  test('options page with chat sidebar', async () => {
    const { context, page } = await launchWithExtension('', {
      seedConfig: withAllFeaturesEnabled({
        serverUrl: 'http://127.0.0.1:8000',
        authMode: 'single-user',
      })
    })

    const consoleErrors = captureConsole(page)

    await waitForConnectionStore(page, 'before-force')
    await forceConnected(page)

    // Navigate to playground/chat on options page
    await page.waitForTimeout(500)
    await saveScreenshot(page, '04-options-chat-sidebar')

    if (consoleErrors.length > 0) {
      fs.writeFileSync(
        path.join(ARTIFACTS_DIR, '04-chat-sidebar-console.txt'),
        consoleErrors.join('\n')
      )
    }

    await context.close()
  })
})

test.describe('New UX Visual QA - Command Palette', () => {
  test('command palette opens with keyboard shortcut', async () => {
    const { context, page } = await launchWithExtension('', {
      seedConfig: withAllFeaturesEnabled({
        serverUrl: 'http://127.0.0.1:8000',
        authMode: 'single-user',
      })
    })

    const consoleErrors = captureConsole(page)

    await waitForConnectionStore(page, 'before-force')
    await forceConnected(page)
    await page.waitForTimeout(500)

    // Try to open command palette with Cmd+K (Mac) or Ctrl+K
    await page.keyboard.press('Meta+k')

    // Wait a bit for the modal to appear
    await page.waitForTimeout(300)

    // Check if command palette dialog is visible
    const dialog = page.locator('[role="dialog"]')
    const isVisible = await dialog.isVisible().catch(() => false)

    if (isVisible) {
      await saveScreenshot(page, '05-command-palette-open')
    } else {
      // Try Ctrl+K as fallback
      await page.keyboard.press('Control+k')
      await page.waitForTimeout(300)
      await saveScreenshot(page, '05-command-palette-attempt')
    }

    if (consoleErrors.length > 0) {
      fs.writeFileSync(
        path.join(ARTIFACTS_DIR, '05-command-palette-console.txt'),
        consoleErrors.join('\n')
      )
    }

    await context.close()
  })

  test('command palette with search query', async () => {
    const { context, page } = await launchWithExtension('', {
      seedConfig: withAllFeaturesEnabled({
        serverUrl: 'http://127.0.0.1:8000',
        authMode: 'single-user',
      })
    })

    await waitForConnectionStore(page, 'before-force')
    await forceConnected(page)
    await page.waitForTimeout(500)

    // Open command palette
    await page.keyboard.press('Meta+k')
    await page.waitForTimeout(300)

    // Type a search query
    const input = page.locator('input[type="text"]')
    if (await input.isVisible().catch(() => false)) {
      await input.fill('settings')
      await page.waitForTimeout(200)
      await saveScreenshot(page, '06-command-palette-search')
    } else {
      await saveScreenshot(page, '06-command-palette-no-input')
    }

    await context.close()
  })
})

test.describe('New UX Visual QA - Header Components', () => {
  test('header with extracted components', async () => {
    const { context, page } = await launchWithExtension('', {
      seedConfig: withAllFeaturesEnabled({
        serverUrl: 'http://127.0.0.1:8000',
        authMode: 'single-user',
      })
    })

    const consoleErrors = captureConsole(page)

    await waitForConnectionStore(page, 'before-force')
    await forceConnected(page)
    await page.waitForTimeout(500)

    // Capture header area specifically
    await saveScreenshot(page, '07-header-full-page')

    // Try to capture just the header if possible
    const header = page.locator('header').first()
    if (await header.isVisible().catch(() => false)) {
      await header.screenshot({ path: path.join(ARTIFACTS_DIR, '07-header-only.png') })
    }

    if (consoleErrors.length > 0) {
      fs.writeFileSync(
        path.join(ARTIFACTS_DIR, '07-header-console.txt'),
        consoleErrors.join('\n')
      )
    }

    await context.close()
  })

  test('header shortcuts section expanded', async () => {
    const { context, page } = await launchWithExtension('', {
      seedConfig: withAllFeaturesEnabled({
        serverUrl: 'http://127.0.0.1:8000',
        authMode: 'single-user',
        headerShortcutsExpanded: true, // Pre-expand shortcuts
      })
    })

    await waitForConnectionStore(page, 'before-force')
    await forceConnected(page)
    await page.waitForTimeout(500)

    await saveScreenshot(page, '08-header-shortcuts-expanded')

    await context.close()
  })
})

test.describe('New UX Visual QA - Settings', () => {
  test('settings page with new layout', async () => {
    const { context, page, optionsUrl } = await launchWithExtension('', {
      seedConfig: withAllFeaturesEnabled({
        serverUrl: 'http://127.0.0.1:8000',
        authMode: 'single-user',
      })
    })

    const consoleErrors = captureConsole(page)

    await waitForConnectionStore(page, 'before-force')
    await forceConnected(page)

    // Navigate to settings
    await page.goto(`${optionsUrl}#/settings`)
    await page.waitForTimeout(500)

    await saveScreenshot(page, '09-settings-new')

    if (consoleErrors.length > 0) {
      fs.writeFileSync(
        path.join(ARTIFACTS_DIR, '09-settings-console.txt'),
        consoleErrors.join('\n')
      )
    }

    await context.close()
  })

  test('settings - chat settings page', async () => {
    const { context, page, optionsUrl } = await launchWithExtension('', {
      seedConfig: withAllFeaturesEnabled({
        serverUrl: 'http://127.0.0.1:8000',
        authMode: 'single-user',
      })
    })

    await waitForConnectionStore(page, 'before-force')
    await forceConnected(page)

    await page.goto(`${optionsUrl}#/settings/chat`)
    await page.waitForTimeout(500)

    await saveScreenshot(page, '10-settings-chat')

    await context.close()
  })
})

test.describe('New UX Visual QA - Dark Mode', () => {
  test('sidepanel dark mode', async () => {
    const { context, page, openSidepanel } = await launchWithExtension('', {
      seedConfig: withAllFeaturesEnabled({
        serverUrl: 'http://127.0.0.1:8000',
        authMode: 'single-user',
        theme: 'dark', // Force dark mode
      })
    })

    await waitForConnectionStore(page, 'before-force')
    await forceConnected(page)

    const sidepanel = await openSidepanel()

    // Force dark class on document
    await sidepanel.evaluate(() => {
      document.documentElement.classList.add('dark')
    })

    await sidepanel.waitForTimeout(500)
    await saveScreenshot(sidepanel, '11-sidepanel-dark-mode')

    await context.close()
  })

  test('options page dark mode', async () => {
    const { context, page } = await launchWithExtension('', {
      seedConfig: withAllFeaturesEnabled({
        serverUrl: 'http://127.0.0.1:8000',
        authMode: 'single-user',
        theme: 'dark',
      })
    })

    await waitForConnectionStore(page, 'before-force')
    await forceConnected(page)

    // Force dark class
    await page.evaluate(() => {
      document.documentElement.classList.add('dark')
    })

    await page.waitForTimeout(500)
    await saveScreenshot(page, '12-options-dark-mode')

    await context.close()
  })
})

test.describe('New UX Visual QA - Comparison (Old vs New)', () => {
  test('sidepanel OLD UX (feature flags disabled)', async () => {
    const { context, page, openSidepanel } = await launchWithExtension('', {
      seedConfig: {
        // No feature flags = old UX
        serverUrl: 'http://127.0.0.1:8000',
        authMode: 'single-user',
      }
    })

    await waitForConnectionStore(page, 'before-force')
    await forceConnected(page)

    const sidepanel = await openSidepanel()
    await sidepanel.waitForTimeout(500)

    await saveScreenshot(sidepanel, '13-sidepanel-OLD-ux')

    await context.close()
  })

  test('sidepanel NEW UX (feature flags enabled)', async () => {
    const { context, page, openSidepanel } = await launchWithExtension('', {
      seedConfig: withAllFeaturesEnabled({
        serverUrl: 'http://127.0.0.1:8000',
        authMode: 'single-user',
      })
    })

    await waitForConnectionStore(page, 'before-force')
    await forceConnected(page)

    const sidepanel = await openSidepanel()
    await sidepanel.waitForTimeout(500)

    await saveScreenshot(sidepanel, '14-sidepanel-NEW-ux')

    await context.close()
  })
})

// Summary test that generates a report
test.describe('New UX Visual QA - Summary', () => {
  test.afterAll(() => {
    // List all generated screenshots
    if (fs.existsSync(ARTIFACTS_DIR)) {
      const files = fs.readdirSync(ARTIFACTS_DIR)
      console.log('\n📊 Visual QA Screenshots Generated:')
      console.log('=' .repeat(50))
      files.filter(f => f.endsWith('.png')).sort().forEach(f => {
        console.log(`  ✓ ${f}`)
      })
      console.log('=' .repeat(50))
      console.log(`📁 Location: ${ARTIFACTS_DIR}`)

      const consoleFiles = files.filter(f => f.endsWith('.txt'))
      if (consoleFiles.length > 0) {
        console.log('\n⚠️ Console logs captured:')
        consoleFiles.forEach(f => {
          console.log(`  - ${f}`)
        })
      }
    }
  })

  test('placeholder for summary', async () => {
    // This test just triggers afterAll
    expect(true).toBe(true)
  })
})
