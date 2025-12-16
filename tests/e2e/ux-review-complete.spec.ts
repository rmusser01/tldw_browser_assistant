/**
 * UX Review Complete - A Comprehensive UX Walkthrough Tool
 *
 * This is NOT a pass/fail test suite. It's a UX observation tool that:
 * 1. Walks through every major user flow
 * 2. Captures screenshots at key states
 * 3. Generates a detailed UX report with observations
 *
 * Run: bun run test:e2e -- tests/e2e/ux-review-complete.spec.ts
 * Prerequisites: tldw_server at http://127.0.0.1:8000, extension built
 */
import { test, expect, Page, BrowserContext } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

import { launchWithExtension } from './utils/extension'
import { forceConnected, waitForConnectionStore } from './utils/connection'
import { withAllFeaturesEnabled } from './utils/feature-flags'

// =============================================================================
// CONFIGURATION
// =============================================================================

const ARTIFACTS_DIR = path.resolve('playwright-mcp-artifacts/ux-walkthrough')
const LIVE_SERVER_URL = process.env.TLDW_URL || 'http://127.0.0.1:8000'
const API_KEY = process.env.TLDW_API_KEY || ''

// All routes to capture
const SETTINGS_ROUTES = [
  { path: '#/settings/tldw', name: 'Server Connection' },
  { path: '#/settings', name: 'General Settings' },
  { path: '#/settings/chat', name: 'Chat Settings' },
  { path: '#/settings/rag', name: 'RAG Settings' },
  { path: '#/settings/model', name: 'Model Management' },
  { path: '#/settings/knowledge', name: 'Knowledge Base' },
  { path: '#/settings/health', name: 'Server Health' },
  { path: '#/settings/about', name: 'About' }
]

const WORKSPACE_ROUTES = [
  { path: '#/', name: 'Main Dashboard' },
  { path: '#/media', name: 'Media Workspace' },
  { path: '#/notes', name: 'Notes' },
  { path: '#/flashcards', name: 'Flashcards' },
  { path: '#/characters', name: 'Characters' },
  { path: '#/prompts', name: 'Prompts' }
]

// =============================================================================
// UX OBSERVATION TYPES
// =============================================================================

interface UXObservation {
  screen: string
  category: 'visual' | 'interaction' | 'accessibility' | 'loading' | 'error' | 'empty-state'
  severity: 'info' | 'minor' | 'major' | 'critical'
  description: string
  screenshot?: string
}

interface ScreenCapture {
  name: string
  path: string
  flow: string
  description: string
  viewport?: { width: number; height: number }
  theme?: 'light' | 'dark'
}

interface UXReport {
  timestamp: string
  serverUrl: string
  flows: {
    name: string
    screenshots: ScreenCapture[]
    observations: UXObservation[]
    consoleErrors: string[]
  }[]
  summary: {
    totalScreenshots: number
    totalObservations: number
    criticalIssues: number
    majorIssues: number
  }
}

// =============================================================================
// GLOBALS
// =============================================================================

const report: UXReport = {
  timestamp: new Date().toISOString(),
  serverUrl: LIVE_SERVER_URL,
  flows: [],
  summary: {
    totalScreenshots: 0,
    totalObservations: 0,
    criticalIssues: 0,
    majorIssues: 0
  }
}

let currentFlow: UXReport['flows'][0] | null = null

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function startFlow(name: string) {
  currentFlow = {
    name,
    screenshots: [],
    observations: [],
    consoleErrors: []
  }
  report.flows.push(currentFlow)
  console.log(`\n${'='.repeat(60)}`)
  console.log(`FLOW: ${name}`)
  console.log('='.repeat(60))
}

async function capture(
  page: Page,
  name: string,
  description: string,
  options?: { fullPage?: boolean; theme?: 'light' | 'dark' }
): Promise<string> {
  const flowDir = currentFlow
    ? currentFlow.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    : 'misc'
  const dir = path.join(ARTIFACTS_DIR, flowDir)
  fs.mkdirSync(dir, { recursive: true })

  const fileName = `${name}.png`
  const filePath = path.join(dir, fileName)

  await page.screenshot({
    path: filePath,
    fullPage: options?.fullPage ?? true
  })

  const viewport = page.viewportSize() || { width: 0, height: 0 }

  const capture: ScreenCapture = {
    name: fileName,
    path: path.relative(ARTIFACTS_DIR, filePath),
    flow: currentFlow?.name || 'misc',
    description,
    viewport,
    theme: options?.theme
  }

  if (currentFlow) {
    currentFlow.screenshots.push(capture)
  }

  report.summary.totalScreenshots++
  console.log(`  📸 ${name}: ${description}`)

  return filePath
}

function observe(
  screen: string,
  category: UXObservation['category'],
  severity: UXObservation['severity'],
  description: string,
  screenshot?: string
) {
  const obs: UXObservation = {
    screen,
    category,
    severity,
    description,
    screenshot
  }

  if (currentFlow) {
    currentFlow.observations.push(obs)
  }

  report.summary.totalObservations++
  if (severity === 'critical') report.summary.criticalIssues++
  if (severity === 'major') report.summary.majorIssues++

  const icon =
    severity === 'critical'
      ? '🔴'
      : severity === 'major'
        ? '🟠'
        : severity === 'minor'
          ? '🟡'
          : '🔵'
  console.log(`  ${icon} [${category}] ${description}`)
}

function captureConsole(page: Page) {
  page.on('console', (msg) => {
    const type = msg.type()
    if (type === 'error') {
      const text = `[ERROR] ${msg.text()}`
      if (currentFlow) {
        currentFlow.consoleErrors.push(text)
      }
    }
  })
}

async function checkElementExists(page: Page, selector: string): Promise<boolean> {
  return (await page.locator(selector).count()) > 0
}

async function checkVisible(page: Page, selector: string): Promise<boolean> {
  try {
    return await page.locator(selector).first().isVisible()
  } catch {
    return false
  }
}

async function forceDarkMode(page: Page) {
  await page.evaluate(() => {
    document.documentElement.classList.add('dark')
  })
  await page.waitForTimeout(100)
}

async function forceLightMode(page: Page) {
  await page.evaluate(() => {
    document.documentElement.classList.remove('dark')
  })
  await page.waitForTimeout(100)
}

// =============================================================================
// SETUP
// =============================================================================

test.beforeAll(() => {
  fs.rmSync(ARTIFACTS_DIR, { recursive: true, force: true })
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true })
})

// =============================================================================
// FLOW 1: ONBOARDING EXPERIENCE
// =============================================================================

test.describe.serial('UX Walkthrough', () => {
  test('Flow 1: First-Run Onboarding', async () => {
    startFlow('01-Onboarding')

    // Launch fresh extension with no config
    const { context, page } = await launchWithExtension('')
    captureConsole(page)

    try {
      await page.waitForTimeout(1500)
      await capture(page, '01-initial-load', 'First-run state - what user sees on fresh install')

      // Check for onboarding elements
      const hasUrlInput = await checkVisible(page, 'input')
      const hasConnectBtn = await checkVisible(page, 'button')

      if (hasUrlInput) {
        observe('onboarding', 'visual', 'info', 'URL input field is present for server configuration')
      } else {
        observe('onboarding', 'visual', 'major', 'No URL input visible - unclear how to configure server')
      }

      // Look for Demo Mode option
      const hasDemoOption =
        (await checkVisible(page, 'text=Demo')) ||
        (await checkVisible(page, 'button:has-text("Demo")'))

      if (hasDemoOption) {
        observe('onboarding', 'interaction', 'info', 'Demo mode option available for exploring without server')
      }

      // Fill server URL
      const urlInput = page.locator('input').first()
      if (await urlInput.isVisible().catch(() => false)) {
        await urlInput.fill(LIVE_SERVER_URL)
        await page.waitForTimeout(500)
        await capture(page, '02-url-entered', 'Server URL filled - checking for validation feedback')

        // Check for validation feedback
        const hasValidationFeedback =
          (await checkVisible(page, '.ant-form-item-explain')) ||
          (await checkVisible(page, '[class*="error"]')) ||
          (await checkVisible(page, '[class*="success"]')) ||
          (await checkVisible(page, '[class*="helper"]'))

        if (hasValidationFeedback) {
          observe('onboarding', 'interaction', 'info', 'URL validation feedback is shown to user')
        } else {
          observe(
            'onboarding',
            'interaction',
            'minor',
            'No visible validation feedback for URL - user may be uncertain if URL is valid'
          )
        }
      }

      // Look for Next/Connect button
      const nextBtn = page
        .getByRole('button', { name: /next|connect|continue/i })
        .first()
      if (await nextBtn.isVisible().catch(() => false)) {
        await capture(page, '03-before-connect', 'Ready to connect - button state')

        await nextBtn.click()
        await page.waitForTimeout(2000)
        await capture(page, '04-connecting', 'Connection in progress - checking for loading indicator')

        // Check for loading state
        const hasLoadingIndicator =
          (await checkVisible(page, '.ant-spin')) ||
          (await checkVisible(page, '[class*="loading"]')) ||
          (await checkVisible(page, '[class*="spinner"]'))

        if (!hasLoadingIndicator) {
          observe(
            'onboarding',
            'loading',
            'minor',
            'No visible loading indicator during connection test - user may think UI is frozen'
          )
        }

        await page.waitForTimeout(3000)
        await capture(page, '05-connection-result', 'Connection test complete - showing result')

        // Check for error or success state
        const hasError =
          (await checkVisible(page, '[class*="error"]')) ||
          (await checkVisible(page, '.ant-alert-error'))
        const hasSuccess =
          (await checkVisible(page, '[class*="success"]')) ||
          (await checkVisible(page, '.ant-alert-success'))

        if (hasError) {
          observe('onboarding', 'error', 'info', 'Error state is displayed when connection fails')
        }
        if (hasSuccess) {
          observe('onboarding', 'visual', 'info', 'Success state is displayed when connection succeeds')
        }
      }

      // Check for auth mode selection
      const hasAuthModeSelection =
        (await checkVisible(page, 'text=API Key')) ||
        (await checkVisible(page, 'text=Username')) ||
        (await checkVisible(page, '[role="radio"]'))

      if (hasAuthModeSelection) {
        await capture(page, '06-auth-mode', 'Authentication mode selection')
        observe('onboarding', 'interaction', 'info', 'Authentication mode options are presented')
      }
    } finally {
      await context.close()
    }
  })

  // =============================================================================
  // FLOW 2: OPTIONS PAGE DASHBOARD
  // =============================================================================

  test('Flow 2: Options Page Dashboard', async () => {
    startFlow('02-Dashboard')

    const { context, page, optionsUrl } = await launchWithExtension('', {
      seedConfig: withAllFeaturesEnabled({
        serverUrl: LIVE_SERVER_URL,
        authMode: 'single-user',
        apiKey: API_KEY
      })
    })
    captureConsole(page)

    try {
      await waitForConnectionStore(page, 'dashboard-init')
      await forceConnected(page)
      await page.waitForTimeout(500)

      // Main dashboard at 1280px
      await page.setViewportSize({ width: 1280, height: 900 })
      await page.goto(optionsUrl + '#/')
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(500)

      await capture(page, '01-dashboard-1280', 'Main dashboard at 1280px width', { theme: 'light' })

      // Check header components
      const hasModelSelector =
        (await checkVisible(page, '[class*="model-select"]')) ||
        (await checkVisible(page, 'button:has-text("Model")')) ||
        (await checkVisible(page, '[aria-label*="model" i]'))

      const hasPromptSelector =
        (await checkVisible(page, '[class*="prompt-select"]')) ||
        (await checkVisible(page, 'button:has-text("Prompt")'))

      const hasConnectionStatus =
        (await checkVisible(page, '[class*="status"]')) ||
        (await checkVisible(page, '[class*="connection"]'))

      if (hasModelSelector) {
        observe('dashboard', 'visual', 'info', 'Model selector is visible in header')
      } else {
        observe('dashboard', 'visual', 'major', 'Model selector not easily findable in header')
      }

      if (hasPromptSelector) {
        observe('dashboard', 'visual', 'info', 'Prompt selector is visible in header')
      }

      if (hasConnectionStatus) {
        observe('dashboard', 'visual', 'info', 'Connection status indicator is present')
      } else {
        observe(
          'dashboard',
          'visual',
          'minor',
          'No obvious connection status indicator - user may not know if server is connected'
        )
      }

      // Check for sidebar
      const hasSidebar =
        (await checkVisible(page, 'aside')) ||
        (await checkVisible(page, '[class*="sidebar"]'))

      if (hasSidebar) {
        observe('dashboard', 'visual', 'info', 'Chat history sidebar is present')
        await capture(page, '02-with-sidebar', 'Dashboard with sidebar visible')
      }

      // Check for chat input
      const hasChatInput =
        (await checkVisible(page, 'textarea')) ||
        (await checkVisible(page, '[contenteditable="true"]'))

      if (hasChatInput) {
        observe('dashboard', 'interaction', 'info', 'Chat input is visible and ready')
      } else {
        observe('dashboard', 'interaction', 'major', 'No chat input visible on main dashboard')
      }

      // Check for empty state
      const hasEmptyState =
        (await checkVisible(page, '[class*="empty"]')) ||
        (await checkVisible(page, 'text=Start a conversation')) ||
        (await checkVisible(page, 'text=No messages'))

      if (hasEmptyState) {
        observe('dashboard', 'empty-state', 'info', 'Empty state guidance is shown when no messages')
      }

      // Test at 1024px
      await page.setViewportSize({ width: 1024, height: 768 })
      await page.waitForTimeout(300)
      await capture(page, '03-dashboard-1024', 'Dashboard at 1024px - checking responsive behavior')

      // Test model selector interaction
      const modelBtn = page.locator('button').filter({ hasText: /model/i }).first()
      if (await modelBtn.isVisible().catch(() => false)) {
        await modelBtn.click()
        await page.waitForTimeout(300)
        await capture(page, '04-model-dropdown', 'Model selector dropdown open')

        const hasModelOptions = (await page.locator('[role="option"], [role="menuitem"]').count()) > 0
        if (hasModelOptions) {
          observe('dashboard', 'interaction', 'info', 'Model dropdown shows available options')
        }

        await page.keyboard.press('Escape')
      }

      // Test quick ingest button
      const ingestBtn = page.locator('button').filter({ hasText: /ingest/i }).first()
      if (await ingestBtn.isVisible().catch(() => false)) {
        await ingestBtn.click()
        await page.waitForTimeout(500)
        await capture(page, '05-ingest-modal', 'Quick ingest modal')

        const hasIngestModal =
          (await checkVisible(page, '[role="dialog"]')) ||
          (await checkVisible(page, '.ant-modal'))

        if (hasIngestModal) {
          observe('dashboard', 'interaction', 'info', 'Quick ingest opens as modal')
        }

        await page.keyboard.press('Escape')
        await page.waitForTimeout(300)
      }
    } finally {
      await context.close()
    }
  })

  // =============================================================================
  // FLOW 3: SIDEPANEL CHAT
  // =============================================================================

  test('Flow 3: Sidepanel Chat Interface', async () => {
    startFlow('03-Sidepanel')

    const { context, page, openSidepanel } = await launchWithExtension('', {
      seedConfig: withAllFeaturesEnabled({
        serverUrl: LIVE_SERVER_URL,
        authMode: 'single-user',
        apiKey: API_KEY
      })
    })
    captureConsole(page)

    try {
      await waitForConnectionStore(page, 'sidepanel-init')
      await forceConnected(page)

      const sidepanel = await openSidepanel()
      await waitForConnectionStore(sidepanel, 'sidepanel-page')
      await forceConnected(sidepanel)
      captureConsole(sidepanel)

      // Test at different widths
      const widths = [320, 400, 500]

      for (const width of widths) {
        await sidepanel.setViewportSize({ width, height: 600 })
        await sidepanel.waitForTimeout(300)
        await capture(sidepanel, `01-sidepanel-${width}px`, `Sidepanel at ${width}px width`)

        if (width === 320) {
          // Check if content is cramped at narrow width
          const hasOverflow = await sidepanel.evaluate(() => {
            const body = document.body
            return body.scrollWidth > body.clientWidth
          })

          if (hasOverflow) {
            observe(
              'sidepanel',
              'visual',
              'major',
              'Horizontal overflow detected at 320px - content may be cut off'
            )
          }
        }
      }

      // Reset to comfortable width
      await sidepanel.setViewportSize({ width: 400, height: 600 })
      await sidepanel.waitForTimeout(300)

      // Check chat input
      const chatInput = sidepanel.locator('textarea').first()
      if (await chatInput.isVisible().catch(() => false)) {
        observe('sidepanel', 'interaction', 'info', 'Chat input textarea is visible')

        // Check focus behavior
        await chatInput.focus()
        const isFocused = await sidepanel.evaluate(
          () => document.activeElement?.tagName === 'TEXTAREA'
        )

        if (isFocused) {
          observe('sidepanel', 'accessibility', 'info', 'Chat input receives focus correctly')
        }

        await chatInput.fill('Test message for UX review')
        await capture(sidepanel, '02-message-typed', 'Message typed in input')

        // Check for send button
        const hasSendBtn =
          (await checkVisible(sidepanel, 'button[type="submit"]')) ||
          (await checkVisible(sidepanel, '[aria-label*="send" i]')) ||
          (await checkVisible(sidepanel, 'button:has(svg)'))

        if (hasSendBtn) {
          observe('sidepanel', 'interaction', 'info', 'Send button is visible')
        } else {
          observe(
            'sidepanel',
            'interaction',
            'minor',
            'No obvious send button - user may not know how to submit (Enter key?)'
          )
        }

        await chatInput.clear()
      } else {
        observe('sidepanel', 'interaction', 'critical', 'Chat input not found in sidepanel')
      }

      // Check for RAG toggle
      const hasRagToggle =
        (await checkVisible(sidepanel, '[class*="rag"]')) ||
        (await checkVisible(sidepanel, 'text=RAG')) ||
        (await checkVisible(sidepanel, 'text=Knowledge'))

      if (hasRagToggle) {
        observe('sidepanel', 'interaction', 'info', 'RAG/Knowledge toggle is visible')
      }

      // Check for settings access
      const hasSettingsBtn =
        (await checkVisible(sidepanel, '[aria-label*="settings" i]')) ||
        (await checkVisible(sidepanel, 'button:has(svg[class*="gear"])')) ||
        (await checkVisible(sidepanel, '[class*="settings"]'))

      if (hasSettingsBtn) {
        observe('sidepanel', 'interaction', 'info', 'Settings access is available from sidepanel')
      }

      // Check empty state
      const hasEmptyState =
        (await checkVisible(sidepanel, '[class*="empty"]')) ||
        (await checkVisible(sidepanel, 'text=Start')) ||
        (await checkVisible(sidepanel, 'text=No messages'))

      await capture(sidepanel, '03-empty-state', 'Sidepanel empty state')

      if (hasEmptyState) {
        observe('sidepanel', 'empty-state', 'info', 'Empty state provides guidance to user')
      } else {
        observe(
          'sidepanel',
          'empty-state',
          'minor',
          'No obvious empty state guidance - user may feel lost'
        )
      }
    } finally {
      await context.close()
    }
  })

  // =============================================================================
  // FLOW 4: SETTINGS NAVIGATION
  // =============================================================================

  test('Flow 4: Settings Pages', async () => {
    startFlow('04-Settings')

    const { context, page, optionsUrl } = await launchWithExtension('', {
      seedConfig: withAllFeaturesEnabled({
        serverUrl: LIVE_SERVER_URL,
        authMode: 'single-user',
        apiKey: API_KEY
      })
    })
    captureConsole(page)

    try {
      await waitForConnectionStore(page, 'settings-init')
      await forceConnected(page)
      await page.setViewportSize({ width: 1280, height: 900 })

      for (const route of SETTINGS_ROUTES) {
        await page.goto(optionsUrl + route.path)
        await page.waitForLoadState('networkidle')
        await page.waitForTimeout(500)

        const safeName = route.path.replace('#/', '').replace(/\//g, '-') || 'index'
        await capture(page, `${safeName}`, route.name)

        // Check for form elements
        const formElementCount = await page
          .locator('input, select, textarea, [role="switch"], [role="checkbox"]')
          .count()

        if (formElementCount > 0) {
          observe(
            'settings',
            'interaction',
            'info',
            `${route.name}: ${formElementCount} form controls found`
          )
        }

        // Check for save button
        const hasSaveBtn =
          (await checkVisible(page, 'button:has-text("Save")')) ||
          (await checkVisible(page, 'button[type="submit"]'))

        if (!hasSaveBtn && formElementCount > 0) {
          observe(
            'settings',
            'interaction',
            'minor',
            `${route.name}: No save button visible - changes may auto-save (unclear to user)`
          )
        }

        // Check for section headers
        const hasHeaders = (await page.locator('h1, h2, h3, h4').count()) > 0
        if (!hasHeaders) {
          observe(
            'settings',
            'visual',
            'minor',
            `${route.name}: No section headers - may be hard to scan`
          )
        }
      }

      // Check settings navigation
      await page.goto(optionsUrl + '#/settings')
      await page.waitForLoadState('networkidle')

      const hasSettingsNav =
        (await checkVisible(page, 'nav')) ||
        (await checkVisible(page, '[role="navigation"]')) ||
        (await checkVisible(page, '[class*="menu"]'))

      if (hasSettingsNav) {
        observe('settings', 'visual', 'info', 'Settings navigation menu is present')
      } else {
        observe(
          'settings',
          'visual',
          'major',
          'No visible settings navigation - hard to find other settings pages'
        )
      }
    } finally {
      await context.close()
    }
  })

  // =============================================================================
  // FLOW 5: MEDIA/WORKSPACE
  // =============================================================================

  test('Flow 5: Media & Workspace Pages', async () => {
    startFlow('05-Workspace')

    const { context, page, optionsUrl } = await launchWithExtension('', {
      seedConfig: withAllFeaturesEnabled({
        serverUrl: LIVE_SERVER_URL,
        authMode: 'single-user',
        apiKey: API_KEY
      })
    })
    captureConsole(page)

    try {
      await waitForConnectionStore(page, 'workspace-init')
      await forceConnected(page)
      await page.setViewportSize({ width: 1280, height: 900 })

      for (const route of WORKSPACE_ROUTES) {
        await page.goto(optionsUrl + route.path)
        await page.waitForLoadState('networkidle')
        await page.waitForTimeout(500)

        const safeName = route.path.replace('#/', '').replace(/\//g, '-') || 'index'
        await capture(page, `${safeName}`, route.name)

        // Check for empty states
        const hasEmptyState =
          (await checkVisible(page, '[class*="empty"]')) ||
          (await checkVisible(page, 'text=No ')) ||
          (await checkVisible(page, 'text=Get started'))

        if (hasEmptyState) {
          observe('workspace', 'empty-state', 'info', `${route.name}: Empty state guidance present`)
        }

        // Check for primary action
        const hasPrimaryAction =
          (await checkVisible(page, 'button.ant-btn-primary')) ||
          (await checkVisible(page, '[class*="primary"]'))

        if (!hasPrimaryAction) {
          observe(
            'workspace',
            'visual',
            'minor',
            `${route.name}: No primary action button visible - unclear what to do first`
          )
        }
      }

      // Test Quick Ingest specifically
      await page.goto(optionsUrl + '#/media')
      await page.waitForLoadState('networkidle')

      const quickIngestBtn = page.locator('button').filter({ hasText: /quick ingest/i }).first()
      if (await quickIngestBtn.isVisible().catch(() => false)) {
        await quickIngestBtn.click()
        await page.waitForTimeout(500)
        await capture(page, 'quick-ingest-modal', 'Quick Ingest Modal')

        // Check modal UX
        const hasCloseBtn =
          (await checkVisible(page, '[aria-label*="close" i]')) ||
          (await checkVisible(page, '.ant-modal-close'))

        if (hasCloseBtn) {
          observe('workspace', 'interaction', 'info', 'Quick ingest modal has close button')
        }

        const hasUrlInput =
          (await checkVisible(page, 'input[type="url"]')) ||
          (await checkVisible(page, 'textarea'))

        if (hasUrlInput) {
          observe('workspace', 'interaction', 'info', 'Quick ingest has URL input field')
        }

        await page.keyboard.press('Escape')
      }
    } finally {
      await context.close()
    }
  })

  // =============================================================================
  // FLOW 6: DARK MODE
  // =============================================================================

  test('Flow 6: Dark Mode Consistency', async () => {
    startFlow('06-Dark-Mode')

    const { context, page, optionsUrl, openSidepanel } = await launchWithExtension('', {
      seedConfig: withAllFeaturesEnabled({
        serverUrl: LIVE_SERVER_URL,
        authMode: 'single-user',
        apiKey: API_KEY,
        theme: 'dark'
      })
    })
    captureConsole(page)

    try {
      await waitForConnectionStore(page, 'dark-init')
      await forceConnected(page)
      await forceDarkMode(page)
      await page.setViewportSize({ width: 1280, height: 900 })

      // Dashboard in dark mode
      await page.goto(optionsUrl + '#/')
      await page.waitForLoadState('networkidle')
      await forceDarkMode(page)
      await page.waitForTimeout(300)
      await capture(page, '01-dashboard-dark', 'Dashboard in dark mode', { theme: 'dark' })

      // Check for contrast issues (basic check)
      const hasLowContrastText = await page.evaluate(() => {
        const elements = document.querySelectorAll('p, span, div, label, h1, h2, h3, h4')
        for (const el of elements) {
          const style = getComputedStyle(el as Element)
          const color = style.color
          const bgColor = style.backgroundColor
          // Very basic check - if text is too similar to background in dark mode
          if (color === bgColor && color !== 'rgba(0, 0, 0, 0)') {
            return true
          }
        }
        return false
      })

      if (hasLowContrastText) {
        observe('dark-mode', 'accessibility', 'major', 'Potential contrast issues detected in dark mode')
      }

      // Settings in dark mode
      await page.goto(optionsUrl + '#/settings')
      await page.waitForLoadState('networkidle')
      await forceDarkMode(page)
      await page.waitForTimeout(300)
      await capture(page, '02-settings-dark', 'Settings in dark mode', { theme: 'dark' })

      // Sidepanel in dark mode
      const sidepanel = await openSidepanel()
      await waitForConnectionStore(sidepanel, 'dark-sidepanel')
      await forceConnected(sidepanel)
      await forceDarkMode(sidepanel)
      await sidepanel.setViewportSize({ width: 400, height: 600 })
      await sidepanel.waitForTimeout(300)
      await capture(sidepanel, '03-sidepanel-dark', 'Sidepanel in dark mode', { theme: 'dark' })

      // Command palette in dark mode
      await page.keyboard.press('Meta+k')
      await page.waitForTimeout(300)
      const dialogOpen = await checkVisible(page, '[role="dialog"]')
      if (dialogOpen) {
        await capture(page, '04-palette-dark', 'Command palette in dark mode', { theme: 'dark' })

        // Check if palette matches dark theme
        const paletteHasDarkBg = await page.evaluate(() => {
          const dialog = document.querySelector('[role="dialog"]')
          if (!dialog) return false
          const style = getComputedStyle(dialog)
          const bg = style.backgroundColor
          // Check if background is dark (rough check)
          const match = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
          if (match) {
            const [, r, g, b] = match.map(Number)
            return r < 100 && g < 100 && b < 100
          }
          return false
        })

        if (!paletteHasDarkBg) {
          observe(
            'dark-mode',
            'visual',
            'minor',
            'Command palette may not fully respect dark mode theme'
          )
        }

        await page.keyboard.press('Escape')
      }

      observe('dark-mode', 'visual', 'info', 'Dark mode screenshots captured for review')
    } finally {
      await context.close()
    }
  })

  // =============================================================================
  // FLOW 7: KEYBOARD & ACCESSIBILITY
  // =============================================================================

  test('Flow 7: Keyboard Navigation & Accessibility', async () => {
    startFlow('07-Accessibility')

    const { context, page, optionsUrl } = await launchWithExtension('', {
      seedConfig: withAllFeaturesEnabled({
        serverUrl: LIVE_SERVER_URL,
        authMode: 'single-user',
        apiKey: API_KEY
      })
    })
    captureConsole(page)

    try {
      await waitForConnectionStore(page, 'a11y-init')
      await forceConnected(page)
      await page.setViewportSize({ width: 1280, height: 900 })

      await page.goto(optionsUrl + '#/settings')
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(500)

      // Test tab navigation
      const tabOrder: { tag: string; text: string }[] = []
      for (let i = 0; i < 15; i++) {
        await page.keyboard.press('Tab')
        const focused = await page.evaluate(() => {
          const el = document.activeElement
          return {
            tag: el?.tagName || 'NONE',
            text: (el?.textContent || '').slice(0, 30)
          }
        })
        tabOrder.push(focused)
      }

      await capture(page, '01-tab-focus', 'Tab navigation focus position')

      // Check if focus is visible
      const hasFocusIndicator = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement
        if (!el) return false
        const style = getComputedStyle(el)
        return (
          style.outlineStyle !== 'none' ||
          style.boxShadow !== 'none' ||
          el.classList.contains('focus-visible') ||
          el.matches(':focus-visible')
        )
      })

      if (hasFocusIndicator) {
        observe('accessibility', 'accessibility', 'info', 'Focus indicator is visible on Tab navigation')
      } else {
        observe(
          'accessibility',
          'accessibility',
          'major',
          'Focus indicator may not be visible - keyboard users cannot see current position'
        )
      }

      // Check for ARIA issues
      const ariaIssues: string[] = []

      // Buttons without labels
      const unlabeledButtons = await page.evaluate(() => {
        const buttons = document.querySelectorAll('button')
        const issues: string[] = []
        buttons.forEach((btn) => {
          const text = btn.textContent?.trim()
          const ariaLabel = btn.getAttribute('aria-label')
          const title = btn.getAttribute('title')
          if (!text && !ariaLabel && !title) {
            issues.push(`Button without accessible name: ${btn.outerHTML.slice(0, 80)}`)
          }
        })
        return issues
      })
      ariaIssues.push(...unlabeledButtons)

      // Inputs without labels
      const unlabeledInputs = await page.evaluate(() => {
        const inputs = document.querySelectorAll('input, textarea, select')
        const issues: string[] = []
        inputs.forEach((input) => {
          const id = input.getAttribute('id')
          const ariaLabel = input.getAttribute('aria-label')
          const ariaLabelledBy = input.getAttribute('aria-labelledby')
          const placeholder = input.getAttribute('placeholder')
          const hasLabel = id ? document.querySelector(`label[for="${id}"]`) : false
          if (!ariaLabel && !ariaLabelledBy && !hasLabel && !placeholder) {
            issues.push(`Input without label: ${input.outerHTML.slice(0, 80)}`)
          }
        })
        return issues
      })
      ariaIssues.push(...unlabeledInputs)

      if (ariaIssues.length > 0) {
        observe(
          'accessibility',
          'accessibility',
          'major',
          `${ariaIssues.length} ARIA/labeling issues found`
        )
        // Save issues to file
        fs.writeFileSync(
          path.join(ARTIFACTS_DIR, '07-accessibility', 'aria-issues.txt'),
          ariaIssues.join('\n\n')
        )
      } else {
        observe('accessibility', 'accessibility', 'info', 'No obvious ARIA/labeling issues detected')
      }

      // Test keyboard shortcut (Cmd+K)
      await page.keyboard.press('Meta+k')
      await page.waitForTimeout(300)
      const paletteOpened = await checkVisible(page, '[role="dialog"]')

      if (paletteOpened) {
        observe('accessibility', 'interaction', 'info', 'Command palette opens with Cmd+K shortcut')
        await capture(page, '02-cmd-k-palette', 'Command palette opened via keyboard')
        await page.keyboard.press('Escape')
      } else {
        // Try Ctrl+K
        await page.keyboard.press('Control+k')
        await page.waitForTimeout(300)
        const paletteOpenedCtrl = await checkVisible(page, '[role="dialog"]')
        if (paletteOpenedCtrl) {
          observe('accessibility', 'interaction', 'info', 'Command palette opens with Ctrl+K shortcut')
          await page.keyboard.press('Escape')
        }
      }

      // Save tab order for review
      fs.mkdirSync(path.join(ARTIFACTS_DIR, '07-accessibility'), { recursive: true })
      fs.writeFileSync(
        path.join(ARTIFACTS_DIR, '07-accessibility', 'tab-order.json'),
        JSON.stringify(tabOrder, null, 2)
      )
    } finally {
      await context.close()
    }
  })

  // =============================================================================
  // REPORT GENERATION
  // =============================================================================

  test('Generate UX Report', async () => {
    startFlow('08-Report')

    // Compile final report
    const criticalObs = report.flows.flatMap((f) =>
      f.observations.filter((o) => o.severity === 'critical')
    )
    const majorObs = report.flows.flatMap((f) =>
      f.observations.filter((o) => o.severity === 'major')
    )

    // Generate markdown report
    let markdown = `# UX Review Report

**Generated:** ${report.timestamp}
**Server:** ${report.serverUrl}

---

## Summary

| Metric | Count |
|--------|-------|
| Total Screenshots | ${report.summary.totalScreenshots} |
| Total Observations | ${report.summary.totalObservations} |
| Critical Issues | ${report.summary.criticalIssues} |
| Major Issues | ${report.summary.majorIssues} |

---

## Critical Issues

${criticalObs.length > 0 ? criticalObs.map((o) => `- **${o.screen}**: ${o.description}`).join('\n') : '_None detected_'}

---

## Major Issues

${majorObs.length > 0 ? majorObs.map((o) => `- **${o.screen}**: ${o.description}`).join('\n') : '_None detected_'}

---

## Flow Details

`

    for (const flow of report.flows) {
      if (flow.name === '08-Report') continue

      markdown += `### ${flow.name}

**Screenshots:** ${flow.screenshots.length}

${flow.screenshots.map((s) => `- \`${s.path}\`: ${s.description}`).join('\n')}

**Observations:**

${flow.observations.map((o) => {
  const icon =
    o.severity === 'critical' ? '🔴' : o.severity === 'major' ? '🟠' : o.severity === 'minor' ? '🟡' : '🔵'
  return `- ${icon} [${o.category}] ${o.description}`
}).join('\n')}

${flow.consoleErrors.length > 0 ? `**Console Errors:**\n${flow.consoleErrors.map((e) => `- ${e}`).join('\n')}` : ''}

---

`
    }

    markdown += `
## UX Checklist

Review these items manually using the screenshots:

### Visual Design
- [ ] Typography is consistent and readable
- [ ] Color contrast meets WCAG AA standards
- [ ] Spacing is consistent throughout
- [ ] Primary actions are visually prominent
- [ ] Dark mode is fully supported

### Interaction Design
- [ ] All interactive elements have hover states
- [ ] Focus states are visible for keyboard navigation
- [ ] Loading states communicate progress
- [ ] Error messages are helpful and actionable
- [ ] Empty states guide users to take action

### Accessibility
- [ ] All buttons have accessible names
- [ ] All form inputs have labels
- [ ] Tab order is logical
- [ ] Focus trapping works in modals
- [ ] Screen reader navigation is supported

### Responsive Design
- [ ] Sidepanel is usable at 320px width
- [ ] No horizontal overflow at any viewport
- [ ] Touch targets are large enough on mobile

---

## Artifacts Location

All screenshots and data files: \`${ARTIFACTS_DIR}\`
`

    // Save markdown report
    fs.writeFileSync(path.join(ARTIFACTS_DIR, 'UX-REVIEW-REPORT.md'), markdown)

    // Save JSON report
    fs.writeFileSync(path.join(ARTIFACTS_DIR, 'ux-review-data.json'), JSON.stringify(report, null, 2))

    // Console output
    console.log('\n' + '='.repeat(60))
    console.log('UX REVIEW COMPLETE')
    console.log('='.repeat(60))
    console.log(`\n📸 Screenshots: ${report.summary.totalScreenshots}`)
    console.log(`📝 Observations: ${report.summary.totalObservations}`)
    console.log(`🔴 Critical: ${report.summary.criticalIssues}`)
    console.log(`🟠 Major: ${report.summary.majorIssues}`)
    console.log(`\n📁 Report: ${path.join(ARTIFACTS_DIR, 'UX-REVIEW-REPORT.md')}`)
    console.log('='.repeat(60))

    expect(true).toBe(true)
  })
})
