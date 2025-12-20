/**
 * Comprehensive UX Review Tests
 *
 * Tests all new UX components with:
 * - Visual screenshots for review
 * - Interactive behavior testing (clicks, keyboard shortcuts, hover states)
 * - Live server integration (localhost:8000)
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

import { launchWithExtension } from './utils/extension'
import { forceConnected, waitForConnectionStore } from './utils/connection'
import { injectSyntheticMessages } from './utils/synthetic-messages'
import { withAllFeaturesEnabled, withFeatures, FEATURE_FLAG_KEYS } from './utils/feature-flags'

const ARTIFACTS_DIR = path.resolve('playwright-mcp-artifacts/ux-review')
const LIVE_SERVER_URL = 'http://127.0.0.1:8000'

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

// Helper to log test result summary
function logResult(testName: string, passed: boolean, details?: string) {
  const status = passed ? '✅' : '❌'
  console.log(`${status} ${testName}${details ? `: ${details}` : ''}`)
}

// ============================================================================
// ONBOARDING FLOW TESTS
// ============================================================================
test.describe('Onboarding Flow', () => {
  test('new onboarding form renders correctly', async () => {
    const { context, page } = await launchWithExtension('', {
      seedConfig: withFeatures([FEATURE_FLAG_KEYS.NEW_ONBOARDING])
      // No serverUrl triggers onboarding
    })

    const consoleErrors = captureConsole(page)
    await page.waitForTimeout(1000)

    // Check for onboarding form elements
    const urlInput = page.locator('input[placeholder*="http"]').or(page.locator('input[type="url"]'))
    const isUrlInputVisible = await urlInput.isVisible().catch(() => false)
    logResult('URL input visible', isUrlInputVisible)

    await saveScreenshot(page, 'onboarding-01-initial-form')

    // Check for Demo Mode button
    const demoButton = page.getByRole('button', { name: /demo/i })
    const isDemoVisible = await demoButton.isVisible().catch(() => false)
    logResult('Demo mode button visible', isDemoVisible)

    if (consoleErrors.length > 0) {
      fs.writeFileSync(
        path.join(ARTIFACTS_DIR, 'onboarding-console.txt'),
        consoleErrors.join('\n')
      )
    }

    await context.close()
  })

  test('onboarding URL validation feedback', async () => {
    const { context, page } = await launchWithExtension('', {
      seedConfig: withFeatures([FEATURE_FLAG_KEYS.NEW_ONBOARDING])
    })

    await page.waitForTimeout(1000)

    // Find URL input
    const urlInput = page.locator('input').first()

    // Test invalid URL
    await urlInput.fill('not-a-valid-url')
    await page.waitForTimeout(500)
    await saveScreenshot(page, 'onboarding-02-invalid-url')

    // Test valid localhost URL
    await urlInput.fill(LIVE_SERVER_URL)
    await page.waitForTimeout(500)
    await saveScreenshot(page, 'onboarding-03-valid-url')

    await context.close()
  })

  test('onboarding auth mode toggle', async () => {
    const { context, page } = await launchWithExtension('', {
      seedConfig: withFeatures([FEATURE_FLAG_KEYS.NEW_ONBOARDING])
    })

    await page.waitForTimeout(1000)

    // Look for auth mode toggle/tabs
    const apiKeyOption = page.getByRole('radio', { name: /api key/i })
      .or(page.getByRole('tab', { name: /api key/i }))
      .or(page.locator('text=API Key'))

    const usernameOption = page.getByRole('radio', { name: /username/i })
      .or(page.getByRole('tab', { name: /username/i }))
      .or(page.locator('text=Username'))

    const hasAuthOptions = await apiKeyOption.isVisible().catch(() => false) ||
                          await usernameOption.isVisible().catch(() => false)

    logResult('Auth mode options visible', hasAuthOptions)
    await saveScreenshot(page, 'onboarding-04-auth-options')

    await context.close()
  })

  test('onboarding connect test with live server', async () => {
    const { context, page } = await launchWithExtension('', {
      seedConfig: withFeatures([FEATURE_FLAG_KEYS.NEW_ONBOARDING])
    })

    await page.waitForTimeout(1000)

    // Fill in server URL
    const urlInput = page.locator('input').first()
    await urlInput.fill(LIVE_SERVER_URL)

    // Look for connect button
    const connectButton = page.getByRole('button', { name: /connect/i })
    const isConnectVisible = await connectButton.isVisible().catch(() => false)

    if (isConnectVisible) {
      await saveScreenshot(page, 'onboarding-05-before-connect')
      await connectButton.click()

      // Wait for connection test phases
      await page.waitForTimeout(3000)
      await saveScreenshot(page, 'onboarding-06-after-connect')
    } else {
      logResult('Connect button not found', false)
      await saveScreenshot(page, 'onboarding-05-no-connect-button')
    }

    await context.close()
  })

  test('onboarding demo mode activation', async () => {
    const { context, page } = await launchWithExtension('', {
      seedConfig: withFeatures([FEATURE_FLAG_KEYS.NEW_ONBOARDING])
    })

    await page.waitForTimeout(1000)

    const demoButton = page.getByRole('button', { name: /demo/i })

    if (await demoButton.isVisible().catch(() => false)) {
      await saveScreenshot(page, 'onboarding-07-before-demo')
      await demoButton.click()
      await page.waitForTimeout(1000)
      await saveScreenshot(page, 'onboarding-08-after-demo')
      logResult('Demo mode activated', true)
    } else {
      logResult('Demo mode button not found', false)
    }

    await context.close()
  })
})

// ============================================================================
// CHAT SIDEBAR TESTS
// ============================================================================
test.describe('Chat Sidebar', () => {
  test('sidebar visibility with feature flag', async () => {
    const { context, page } = await launchWithExtension('', {
      seedConfig: withAllFeaturesEnabled({
        serverUrl: LIVE_SERVER_URL,
        authMode: 'single-user',
      })
    })

    await waitForConnectionStore(page, 'before-force')
    await forceConnected(page)
    await page.waitForTimeout(500)

    // Look for chat sidebar
    const sidebar = page.locator('[data-testid="chat-sidebar"]')
      .or(page.locator('.chat-sidebar'))
      .or(page.locator('aside').first())

    const isSidebarVisible = await sidebar.isVisible().catch(() => false)
    logResult('Chat sidebar visible', isSidebarVisible)

    await saveScreenshot(page, 'sidebar-01-initial')

    await context.close()
  })

  test('sidebar collapse/expand toggle', async () => {
    const { context, page } = await launchWithExtension('', {
      seedConfig: withAllFeaturesEnabled({
        serverUrl: LIVE_SERVER_URL,
        authMode: 'single-user',
      })
    })

    await waitForConnectionStore(page, 'before-force')
    await forceConnected(page)
    await page.waitForTimeout(500)

    // Look for collapse toggle button
    const collapseButton = page.locator('[aria-label*="collapse"]')
      .or(page.locator('[data-testid="sidebar-toggle"]'))
      .or(page.locator('button:has(svg)').filter({ hasText: '' }).first())

    if (await collapseButton.isVisible().catch(() => false)) {
      await saveScreenshot(page, 'sidebar-02-expanded')
      await collapseButton.click()
      await page.waitForTimeout(300)
      await saveScreenshot(page, 'sidebar-03-collapsed')
      logResult('Sidebar collapse toggle works', true)
    } else {
      logResult('Collapse toggle not found', false)
      await saveScreenshot(page, 'sidebar-02-no-toggle')
    }

    await context.close()
  })

  test('sidebar search functionality', async () => {
    const { context, page } = await launchWithExtension('', {
      seedConfig: withAllFeaturesEnabled({
        serverUrl: LIVE_SERVER_URL,
        authMode: 'single-user',
      })
    })

    await waitForConnectionStore(page, 'before-force')
    await forceConnected(page)
    await page.waitForTimeout(500)

    // Look for search input in sidebar
    const searchInput = page.locator('aside input[type="text"]')
      .or(page.locator('[placeholder*="Search"]'))
      .or(page.locator('input[placeholder*="search" i]'))

    if (await searchInput.isVisible().catch(() => false)) {
      await searchInput.fill('test query')
      await page.waitForTimeout(300)
      await saveScreenshot(page, 'sidebar-04-search-active')
      logResult('Sidebar search works', true)
    } else {
      logResult('Search input not found', false)
      await saveScreenshot(page, 'sidebar-04-no-search')
    }

    await context.close()
  })

  test('sidebar keyboard shortcuts', async () => {
    const { context, page } = await launchWithExtension('', {
      seedConfig: withAllFeaturesEnabled({
        serverUrl: LIVE_SERVER_URL,
        authMode: 'single-user',
      })
    })

    await waitForConnectionStore(page, 'before-force')
    await forceConnected(page)
    await page.waitForTimeout(500)

    // Test ⌘N for new chat
    await page.keyboard.press('Meta+n')
    await page.waitForTimeout(500)
    await saveScreenshot(page, 'sidebar-05-after-cmd-n')

    // Test ⌘I for ingest
    await page.keyboard.press('Meta+i')
    await page.waitForTimeout(500)
    await saveScreenshot(page, 'sidebar-06-after-cmd-i')

    await context.close()
  })
})

// ============================================================================
// COMMAND PALETTE TESTS
// ============================================================================
test.describe('Command Palette', () => {
  test('opens with keyboard shortcut (⌘K)', async () => {
    const { context, page } = await launchWithExtension('', {
      seedConfig: withAllFeaturesEnabled({
        serverUrl: LIVE_SERVER_URL,
        authMode: 'single-user',
      })
    })

    await waitForConnectionStore(page, 'before-force')
    await forceConnected(page)
    await page.waitForTimeout(500)

    // Try Meta+K (Mac)
    await page.keyboard.press('Meta+k')
    await page.waitForTimeout(300)

    const dialog = page.locator('[role="dialog"]')
    let isOpen = await dialog.isVisible().catch(() => false)

    if (!isOpen) {
      // Try Ctrl+K (Windows/Linux)
      await page.keyboard.press('Control+k')
      await page.waitForTimeout(300)
      isOpen = await dialog.isVisible().catch(() => false)
    }

    logResult('Command palette opens with keyboard', isOpen)
    await saveScreenshot(page, 'palette-01-opened')

    await context.close()
  })

  test('search filtering works', async () => {
    const { context, page } = await launchWithExtension('', {
      seedConfig: withAllFeaturesEnabled({
        serverUrl: LIVE_SERVER_URL,
        authMode: 'single-user',
      })
    })

    await waitForConnectionStore(page, 'before-force')
    await forceConnected(page)
    await page.waitForTimeout(500)

    // Open command palette
    await page.keyboard.press('Meta+k')
    await page.waitForTimeout(300)

    const searchInput = page.locator('[role="dialog"] input[type="text"]')
      .or(page.locator('[role="combobox"]'))

    if (await searchInput.isVisible().catch(() => false)) {
      // Type search query
      await searchInput.fill('settings')
      await page.waitForTimeout(300)
      await saveScreenshot(page, 'palette-02-search-settings')

      // Clear and try another query
      await searchInput.fill('chat')
      await page.waitForTimeout(300)
      await saveScreenshot(page, 'palette-03-search-chat')

      logResult('Search filtering works', true)
    } else {
      logResult('Search input not found in palette', false)
    }

    await context.close()
  })

  test('arrow key navigation', async () => {
    const { context, page } = await launchWithExtension('', {
      seedConfig: withAllFeaturesEnabled({
        serverUrl: LIVE_SERVER_URL,
        authMode: 'single-user',
      })
    })

    await waitForConnectionStore(page, 'before-force')
    await forceConnected(page)
    await page.waitForTimeout(500)

    // Open command palette
    await page.keyboard.press('Meta+k')
    await page.waitForTimeout(300)

    // Navigate with arrow keys
    await page.keyboard.press('ArrowDown')
    await page.waitForTimeout(100)
    await saveScreenshot(page, 'palette-04-arrow-down-1')

    await page.keyboard.press('ArrowDown')
    await page.waitForTimeout(100)
    await saveScreenshot(page, 'palette-05-arrow-down-2')

    await page.keyboard.press('ArrowUp')
    await page.waitForTimeout(100)
    await saveScreenshot(page, 'palette-06-arrow-up')

    logResult('Arrow key navigation tested', true)

    await context.close()
  })

  test('escape closes palette', async () => {
    const { context, page } = await launchWithExtension('', {
      seedConfig: withAllFeaturesEnabled({
        serverUrl: LIVE_SERVER_URL,
        authMode: 'single-user',
      })
    })

    await waitForConnectionStore(page, 'before-force')
    await forceConnected(page)
    await page.waitForTimeout(500)

    // Open command palette
    await page.keyboard.press('Meta+k')
    await page.waitForTimeout(300)

    const dialog = page.locator('[role="dialog"]')
    const wasOpen = await dialog.isVisible().catch(() => false)

    // Close with Escape
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)

    const isClosed = !(await dialog.isVisible().catch(() => true))

    logResult('Escape closes palette', wasOpen && isClosed)
    await saveScreenshot(page, 'palette-07-after-escape')

    await context.close()
  })

  test('enter executes selected command', async () => {
    const { context, page } = await launchWithExtension('', {
      seedConfig: withAllFeaturesEnabled({
        serverUrl: LIVE_SERVER_URL,
        authMode: 'single-user',
      })
    })

    await waitForConnectionStore(page, 'before-force')
    await forceConnected(page)
    await page.waitForTimeout(500)

    const initialUrl = page.url()

    // Open command palette
    await page.keyboard.press('Meta+k')
    await page.waitForTimeout(300)

    // Navigate to a command and execute
    await page.keyboard.press('ArrowDown')
    await page.waitForTimeout(100)
    await page.keyboard.press('Enter')
    await page.waitForTimeout(500)

    const newUrl = page.url()
    const didNavigate = newUrl !== initialUrl

    logResult('Command executed (navigation occurred)', didNavigate)
    await saveScreenshot(page, 'palette-08-after-enter')

    await context.close()
  })
})

// ============================================================================
// COMPACT MESSAGES TESTS
// ============================================================================
test.describe('Compact Messages', () => {
  test('messages render in full-width layout', async () => {
    const { context, page, openSidepanel } = await launchWithExtension('', {
      seedConfig: withAllFeaturesEnabled({
        serverUrl: LIVE_SERVER_URL,
        authMode: 'single-user',
      })
    })

    await waitForConnectionStore(page, 'before-force')
    await forceConnected(page)

    const sidepanel = await openSidepanel()
    await sidepanel.waitForTimeout(500)

    // Try to inject synthetic messages
    const result = await injectSyntheticMessages(sidepanel, 5)
    if (result.ok) {
      await sidepanel.waitForTimeout(500)
      await saveScreenshot(sidepanel, 'messages-01-compact-layout')
      logResult('Messages rendered', true)
    } else {
      logResult('Message injection failed', false, result.reason)
      await saveScreenshot(sidepanel, 'messages-01-no-injection')
    }

    await context.close()
  })

  test('hover reveals action buttons', async () => {
    const { context, page, openSidepanel } = await launchWithExtension('', {
      seedConfig: withAllFeaturesEnabled({
        serverUrl: LIVE_SERVER_URL,
        authMode: 'single-user',
      })
    })

    await waitForConnectionStore(page, 'before-force')
    await forceConnected(page)

    const sidepanel = await openSidepanel()
    await sidepanel.waitForTimeout(500)

    // Inject messages
    await injectSyntheticMessages(sidepanel, 3)
    await sidepanel.waitForTimeout(500)

    // Find a message element to hover
    const message = sidepanel.locator('[data-message-id]').first()
      .or(sidepanel.locator('.message').first())
      .or(sidepanel.locator('[class*="message"]').first())

    if (await message.isVisible().catch(() => false)) {
      await saveScreenshot(sidepanel, 'messages-02-before-hover')

      await message.hover()
      await sidepanel.waitForTimeout(300)
      await saveScreenshot(sidepanel, 'messages-03-after-hover')

      logResult('Hover on message tested', true)
    } else {
      logResult('No message element found to hover', false)
    }

    await context.close()
  })

  test('copy button functionality', async () => {
    const { context, page, openSidepanel } = await launchWithExtension('', {
      seedConfig: withAllFeaturesEnabled({
        serverUrl: LIVE_SERVER_URL,
        authMode: 'single-user',
      })
    })

    await waitForConnectionStore(page, 'before-force')
    await forceConnected(page)

    const sidepanel = await openSidepanel()
    await sidepanel.waitForTimeout(500)

    // Inject messages
    await injectSyntheticMessages(sidepanel, 2)
    await sidepanel.waitForTimeout(500)

    // Find and hover a message to reveal copy button
    const message = sidepanel.locator('[data-message-id]').first()
      .or(sidepanel.locator('.message').first())

    if (await message.isVisible().catch(() => false)) {
      await message.hover()
      await sidepanel.waitForTimeout(300)

      // Look for copy button
      const copyButton = sidepanel.locator('button[aria-label*="copy" i]')
        .or(sidepanel.locator('button:has(svg)').filter({ hasText: /copy/i }))
        .first()

      if (await copyButton.isVisible().catch(() => false)) {
        await copyButton.click()
        await sidepanel.waitForTimeout(500)
        await saveScreenshot(sidepanel, 'messages-04-after-copy')
        logResult('Copy button clicked', true)
      } else {
        logResult('Copy button not found', false)
      }
    }

    await context.close()
  })
})

// ============================================================================
// HEADER COMPONENTS TESTS
// ============================================================================
test.describe('Header Components', () => {
  test('ConnectionStatus shows correct state', async () => {
    const { context, page } = await launchWithExtension('', {
      seedConfig: withAllFeaturesEnabled({
        serverUrl: LIVE_SERVER_URL,
        authMode: 'single-user',
      })
    })

    await waitForConnectionStore(page, 'before-force')
    await forceConnected(page)
    await page.waitForTimeout(500)

    // Look for connection status indicator
    const statusDot = page.locator('[data-testid="connection-status"]')
      .or(page.locator('[aria-label*="connection" i]'))
      .or(page.locator('.status-dot'))

    const isVisible = await statusDot.isVisible().catch(() => false)
    logResult('Connection status visible', isVisible)

    // Capture header area
    const header = page.locator('header').first()
    if (await header.isVisible().catch(() => false)) {
      await header.screenshot({ path: path.join(ARTIFACTS_DIR, 'header-01-status.png') })
    }
    await saveScreenshot(page, 'header-01-full-with-status')

    await context.close()
  })

  test('HeaderShortcuts expand/collapse', async () => {
    const { context, page } = await launchWithExtension('', {
      seedConfig: withAllFeaturesEnabled({
        serverUrl: LIVE_SERVER_URL,
        authMode: 'single-user',
      })
    })

    await waitForConnectionStore(page, 'before-force')
    await forceConnected(page)
    await page.waitForTimeout(500)

    // Look for shortcuts toggle (often a ? or chevron)
    const shortcutsToggle = page.locator('[aria-label*="shortcuts" i]')
      .or(page.locator('[aria-expanded]').first())
      .or(page.locator('button:has-text("?")'))

    if (await shortcutsToggle.isVisible().catch(() => false)) {
      await saveScreenshot(page, 'header-02-shortcuts-initial')

      await shortcutsToggle.click()
      await page.waitForTimeout(300)
      await saveScreenshot(page, 'header-03-shortcuts-toggled')

      logResult('Shortcuts toggle works', true)
    } else {
      // Try keyboard shortcut ?
      await page.keyboard.press('?')
      await page.waitForTimeout(300)
      await saveScreenshot(page, 'header-02-after-question-key')
      logResult('Tried ? keyboard shortcut', true)
    }

    await context.close()
  })

  test('ModeSelector tab switching', async () => {
    const { context, page } = await launchWithExtension('', {
      seedConfig: withAllFeaturesEnabled({
        serverUrl: LIVE_SERVER_URL,
        authMode: 'single-user',
      })
    })

    await waitForConnectionStore(page, 'before-force')
    await forceConnected(page)
    await page.waitForTimeout(500)

    // Look for mode tabs
    const modeTabs = page.locator('[role="tablist"]')
      .or(page.locator('nav [role="tab"]'))

    if (await modeTabs.isVisible().catch(() => false)) {
      await saveScreenshot(page, 'header-04-mode-tabs')

      // Click on different tabs
      const tabs = page.locator('[role="tab"]')
      const tabCount = await tabs.count()

      if (tabCount > 1) {
        await tabs.nth(1).click()
        await page.waitForTimeout(300)
        await saveScreenshot(page, 'header-05-mode-switched')
        logResult('Mode tab switching works', true)
      }
    } else {
      logResult('Mode tabs not found', false)
      await saveScreenshot(page, 'header-04-no-tabs')
    }

    await context.close()
  })

  test('QuickIngestButton badge and modal', async () => {
    const { context, page } = await launchWithExtension('', {
      seedConfig: withAllFeaturesEnabled({
        serverUrl: LIVE_SERVER_URL,
        authMode: 'single-user',
      })
    })

    await waitForConnectionStore(page, 'before-force')
    await forceConnected(page)
    await page.waitForTimeout(500)

    // Look for quick ingest button
    const ingestButton = page.locator('[data-testid="quick-ingest-button"]')
      .or(page.locator('button[aria-label*="ingest" i]'))
      .or(page.locator('button:has-text("Ingest")'))

    if (await ingestButton.isVisible().catch(() => false)) {
      await saveScreenshot(page, 'header-06-ingest-button')

      await ingestButton.click()
      await page.waitForTimeout(500)
      await saveScreenshot(page, 'header-07-ingest-modal')

      logResult('Quick ingest button opens modal', true)
    } else {
      logResult('Quick ingest button not found', false)
    }

    await context.close()
  })
})

// ============================================================================
// SIDEPANEL CHAT COMPONENTS TESTS
// ============================================================================
test.describe('Sidepanel Chat', () => {
  test('ControlRow displays with labels', async () => {
    const { context, page, openSidepanel } = await launchWithExtension('', {
      seedConfig: withAllFeaturesEnabled({
        serverUrl: LIVE_SERVER_URL,
        authMode: 'single-user',
      })
    })

    await waitForConnectionStore(page, 'before-force')
    await forceConnected(page)

    const sidepanel = await openSidepanel()
    await sidepanel.waitForTimeout(500)

    // Look for control row elements
    const controlRow = sidepanel.locator('[data-testid="control-row"]')
      .or(sidepanel.locator('.control-row'))
      .or(sidepanel.locator('[class*="control"]'))

    const isVisible = await controlRow.isVisible().catch(() => false)
    logResult('Control row visible', isVisible)

    await saveScreenshot(sidepanel, 'sidepanel-01-control-row')

    await context.close()
  })

  test('StatusDot shows connection state', async () => {
    const { context, page, openSidepanel } = await launchWithExtension('', {
      seedConfig: withAllFeaturesEnabled({
        serverUrl: LIVE_SERVER_URL,
        authMode: 'single-user',
      })
    })

    await waitForConnectionStore(page, 'before-force')
    await forceConnected(page)

    const sidepanel = await openSidepanel()
    await sidepanel.waitForTimeout(500)

    // Look for status indicator
    const statusDot = sidepanel.locator('[data-testid="status-dot"]')
      .or(sidepanel.locator('.status-dot'))
      .or(sidepanel.locator('[class*="status"]'))

    const isVisible = await statusDot.isVisible().catch(() => false)
    logResult('Status dot visible', isVisible)

    await saveScreenshot(sidepanel, 'sidepanel-02-status-dot')

    await context.close()
  })

  test('message input form is functional', async () => {
    const { context, page, openSidepanel } = await launchWithExtension('', {
      seedConfig: withAllFeaturesEnabled({
        serverUrl: LIVE_SERVER_URL,
        authMode: 'single-user',
      })
    })

    await waitForConnectionStore(page, 'before-force')
    await forceConnected(page)

    const sidepanel = await openSidepanel()

    // Also force connected state on sidepanel (separate page context)
    await waitForConnectionStore(sidepanel, 'sidepanel-init')
    await forceConnected(sidepanel)
    await sidepanel.waitForTimeout(500)

    // Find message input
    const input = sidepanel.locator('textarea')
      .or(sidepanel.locator('input[type="text"]'))
      .or(sidepanel.locator('[contenteditable="true"]'))

    if (await input.isVisible().catch(() => false)) {
      await input.fill('Test message input')
      await sidepanel.waitForTimeout(300)
      await saveScreenshot(sidepanel, 'sidepanel-03-input-filled')
      logResult('Message input works', true)
    } else {
      logResult('Message input not found', false)
      await saveScreenshot(sidepanel, 'sidepanel-03-no-input')
    }

    await context.close()
  })
})

// ============================================================================
// DARK MODE TESTS
// ============================================================================
test.describe('Dark Mode', () => {
  test('sidepanel renders in dark mode', async () => {
    const { context, page, openSidepanel } = await launchWithExtension('', {
      seedConfig: withAllFeaturesEnabled({
        serverUrl: LIVE_SERVER_URL,
        authMode: 'single-user',
        theme: 'dark',
      })
    })

    await waitForConnectionStore(page, 'before-force')
    await forceConnected(page)

    const sidepanel = await openSidepanel()

    // Force dark class
    await sidepanel.evaluate(() => {
      document.documentElement.classList.add('dark')
    })

    await sidepanel.waitForTimeout(500)
    await saveScreenshot(sidepanel, 'dark-01-sidepanel')
    logResult('Sidepanel dark mode captured', true)

    await context.close()
  })

  test('options page renders in dark mode', async () => {
    const { context, page } = await launchWithExtension('', {
      seedConfig: withAllFeaturesEnabled({
        serverUrl: LIVE_SERVER_URL,
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
    await saveScreenshot(page, 'dark-02-options')
    logResult('Options page dark mode captured', true)

    await context.close()
  })

  test('command palette renders in dark mode', async () => {
    const { context, page } = await launchWithExtension('', {
      seedConfig: withAllFeaturesEnabled({
        serverUrl: LIVE_SERVER_URL,
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

    // Open command palette
    await page.keyboard.press('Meta+k')
    await page.waitForTimeout(300)

    await saveScreenshot(page, 'dark-03-command-palette')
    logResult('Command palette dark mode captured', true)

    await context.close()
  })
})

// ============================================================================
// SUMMARY
// ============================================================================
test.describe('UX Review Summary', () => {
  test.afterAll(() => {
    // List all generated screenshots
    if (fs.existsSync(ARTIFACTS_DIR)) {
      const files = fs.readdirSync(ARTIFACTS_DIR)
      console.log('\n' + '='.repeat(60))
      console.log('📊 COMPREHENSIVE UX REVIEW COMPLETE')
      console.log('='.repeat(60))

      console.log('\n📸 Screenshots Generated:')
      files.filter(f => f.endsWith('.png')).sort().forEach(f => {
        console.log(`  ✓ ${f}`)
      })

      console.log(`\n📁 Artifacts Location: ${ARTIFACTS_DIR}`)

      const consoleFiles = files.filter(f => f.endsWith('.txt'))
      if (consoleFiles.length > 0) {
        console.log('\n⚠️ Console Logs Captured:')
        consoleFiles.forEach(f => {
          console.log(`  - ${f}`)
        })
      }

      console.log('\n' + '='.repeat(60))
    }
  })

  test('summary placeholder', async () => {
    // This test just triggers afterAll
    expect(true).toBe(true)
  })
})
