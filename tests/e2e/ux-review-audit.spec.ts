/**
 * UX Review Audit
 *
 * Comprehensive UX review of the tldw Assistant browser extension.
 * Captures screenshots of all routes, performs accessibility audits,
 * and generates a UX report with findings.
 *
 * Usage: bun run test:e2e ux-review-audit
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

import { launchWithExtension } from './utils/extension'
import {
  forceConnected,
  forceUnconfigured,
  forceErrorUnreachable,
  waitForConnectionStore
} from './utils/connection'
import { withAllFeaturesEnabled } from './utils/feature-flags'
import { injectSyntheticMessages } from './utils/synthetic-messages'

// ============================================================================
// CONFIGURATION
// ============================================================================

const ARTIFACTS_DIR = path.resolve('playwright-mcp-artifacts/ux-audit')
const SCREENSHOTS_DIR = path.join(ARTIFACTS_DIR, 'screenshots')
const A11Y_DIR = path.join(ARTIFACTS_DIR, 'accessibility')
const REPORTS_DIR = path.join(ARTIFACTS_DIR, 'reports')

const LIVE_SERVER_URL = process.env.TLDW_E2E_SERVER_URL || 'http://127.0.0.1:8000'
const API_KEY = process.env.TLDW_E2E_API_KEY || 'test-api-key'

// ============================================================================
// ROUTE DEFINITIONS
// ============================================================================

interface RouteConfig {
  path: string
  name: string
  category: 'settings' | 'workspace' | 'admin' | 'special'
  description?: string
}

const OPTIONS_ROUTES: RouteConfig[] = [
  // Home
  { path: '/', name: 'home', category: 'settings', description: 'Main home/playground' },

  // Settings Routes
  { path: '/settings', name: 'settings-general', category: 'settings', description: 'General settings' },
  { path: '/settings/tldw', name: 'settings-tldw', category: 'settings', description: 'Server configuration' },
  { path: '/settings/model', name: 'settings-model', category: 'settings', description: 'Model management' },
  { path: '/settings/prompt', name: 'settings-prompt', category: 'settings', description: 'Prompt settings' },
  { path: '/settings/evaluations', name: 'settings-evaluations', category: 'settings', description: 'Evaluations settings' },
  { path: '/settings/chat', name: 'settings-chat', category: 'settings', description: 'Chat settings' },
  { path: '/settings/share', name: 'settings-share', category: 'settings', description: 'Share settings' },
  { path: '/settings/processed', name: 'settings-processed', category: 'settings', description: 'Processed content' },
  { path: '/settings/health', name: 'settings-health', category: 'settings', description: 'Health check' },
  { path: '/settings/prompt-studio', name: 'settings-prompt-studio', category: 'settings', description: 'Prompt studio settings' },
  { path: '/settings/knowledge', name: 'settings-knowledge', category: 'settings', description: 'Knowledge base' },
  { path: '/settings/characters', name: 'settings-characters', category: 'settings', description: 'Characters' },
  { path: '/settings/world-books', name: 'settings-world-books', category: 'settings', description: 'World books' },
  { path: '/settings/chat-dictionaries', name: 'settings-dictionaries', category: 'settings', description: 'Dictionaries' },
  { path: '/settings/rag', name: 'settings-rag', category: 'settings', description: 'RAG settings' },
  { path: '/settings/about', name: 'settings-about', category: 'settings', description: 'About page' },

  // Workspace Routes
  { path: '/media', name: 'workspace-media', category: 'workspace', description: 'Single media' },
  { path: '/media-multi', name: 'workspace-media-multi', category: 'workspace', description: 'Multi-item review' },
  { path: '/review', name: 'workspace-review', category: 'workspace', description: 'Review (alias)' },
  { path: '/notes', name: 'workspace-notes', category: 'workspace', description: 'Notes workspace' },
  { path: '/knowledge', name: 'workspace-knowledge', category: 'workspace', description: 'Knowledge QA' },
  { path: '/world-books', name: 'workspace-world-books', category: 'workspace', description: 'World books' },
  { path: '/dictionaries', name: 'workspace-dictionaries', category: 'workspace', description: 'Dictionaries' },
  { path: '/characters', name: 'workspace-characters', category: 'workspace', description: 'Characters' },
  { path: '/prompts', name: 'workspace-prompts', category: 'workspace', description: 'Prompts' },
  { path: '/prompt-studio', name: 'workspace-prompt-studio', category: 'workspace', description: 'Prompt studio' },
  { path: '/tts', name: 'workspace-tts', category: 'workspace', description: 'Text-to-speech' },
  { path: '/stt', name: 'workspace-stt', category: 'workspace', description: 'Speech-to-text' },
  { path: '/evaluations', name: 'workspace-evaluations', category: 'workspace', description: 'Evaluations' },
  { path: '/flashcards', name: 'workspace-flashcards', category: 'workspace', description: 'Flashcards' },

  // Admin Routes
  { path: '/admin/server', name: 'admin-server', category: 'admin', description: 'Server admin' },
  { path: '/admin/llamacpp', name: 'admin-llamacpp', category: 'admin', description: 'LlamaCpp admin' },
  { path: '/admin/mlx', name: 'admin-mlx', category: 'admin', description: 'MLX admin' },

  // Special Routes
  { path: '/onboarding-test', name: 'special-onboarding', category: 'special', description: 'Onboarding wizard' },
  { path: '/quick-chat-popout', name: 'special-popout', category: 'special', description: 'Quick chat popout' }
]

const SIDEPANEL_ROUTES: RouteConfig[] = [
  { path: '/', name: 'sidepanel-chat', category: 'settings', description: 'Chat interface' },
  { path: '/settings', name: 'sidepanel-settings', category: 'settings', description: 'Sidepanel settings' }
]

// ============================================================================
// UX ISSUE TRACKING
// ============================================================================

interface UXIssue {
  severity: 'critical' | 'major' | 'minor' | 'enhancement'
  category: 'accessibility' | 'visual' | 'interaction' | 'navigation' | 'error-handling'
  route: string
  issue: string
  expected: string
  screenshot?: string
}

const allUxIssues: UXIssue[] = []

function logIssue(issue: UXIssue) {
  allUxIssues.push(issue)
  const icon = {
    critical: '🔴',
    major: '🟠',
    minor: '🟡',
    enhancement: '🔵'
  }[issue.severity]
  console.log(`${icon} [${issue.severity.toUpperCase()}] ${issue.route}: ${issue.issue}`)
}

// ============================================================================
// HELPERS
// ============================================================================

async function ensureDirectories() {
  const dirs = [
    SCREENSHOTS_DIR,
    path.join(SCREENSHOTS_DIR, 'settings'),
    path.join(SCREENSHOTS_DIR, 'workspace'),
    path.join(SCREENSHOTS_DIR, 'admin'),
    path.join(SCREENSHOTS_DIR, 'special'),
    path.join(SCREENSHOTS_DIR, 'sidepanel'),
    path.join(SCREENSHOTS_DIR, 'states'),
    A11Y_DIR,
    REPORTS_DIR
  ]
  for (const dir of dirs) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

async function saveScreenshot(page: any, name: string, category: string = 'settings', fullPage = true) {
  const filePath = path.join(SCREENSHOTS_DIR, category, `${name}.png`)
  await page.screenshot({ path: filePath, fullPage })
  console.log(`  📸 ${name}.png`)
  return filePath
}

async function setDarkMode(page: any, enabled: boolean) {
  await page.evaluate((dark: boolean) => {
    if (dark) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, enabled)
  await page.waitForTimeout(200) // Allow CSS transition
}

async function captureConsoleErrors(page: any): Promise<string[]> {
  const errors: string[] = []
  page.on('console', (msg: any) => {
    if (msg.type() === 'error') {
      errors.push(msg.text())
    }
  })
  return errors
}

// ============================================================================
// ACCESSIBILITY AUDIT HELPERS
// ============================================================================

interface A11yCheck {
  passed: boolean
  issue?: string
  count?: number
}

async function checkInputsHaveLabels(page: any): Promise<A11yCheck> {
  const result = await page.evaluate(() => {
    const inputs = document.querySelectorAll('input:not([type="hidden"]), textarea, select')
    let unlabeled = 0
    inputs.forEach((input) => {
      const id = input.getAttribute('id')
      const ariaLabel = input.getAttribute('aria-label')
      const ariaLabelledby = input.getAttribute('aria-labelledby')
      const placeholder = input.getAttribute('placeholder')
      const hasLabel = id ? document.querySelector(`label[for="${id}"]`) : null

      if (!ariaLabel && !ariaLabelledby && !hasLabel && !placeholder) {
        unlabeled++
      }
    })
    return { total: inputs.length, unlabeled }
  })

  if (result.unlabeled > 0) {
    return {
      passed: false,
      issue: `${result.unlabeled}/${result.total} inputs lack accessible labels`,
      count: result.unlabeled
    }
  }
  return { passed: true }
}

async function checkButtonsHaveNames(page: any): Promise<A11yCheck> {
  const result = await page.evaluate(() => {
    const buttons = document.querySelectorAll('button, [role="button"]')
    let unnamed = 0
    buttons.forEach((btn) => {
      const text = btn.textContent?.trim()
      const ariaLabel = btn.getAttribute('aria-label')
      const title = btn.getAttribute('title')

      if (!text && !ariaLabel && !title) {
        unnamed++
      }
    })
    return { total: buttons.length, unnamed }
  })

  if (result.unnamed > 0) {
    return {
      passed: false,
      issue: `${result.unnamed}/${result.total} buttons lack accessible names`,
      count: result.unnamed
    }
  }
  return { passed: true }
}

async function checkFocusVisibility(page: any): Promise<A11yCheck> {
  // Tab through first 5 elements and check focus visibility
  const focusResults: boolean[] = []

  for (let i = 0; i < 5; i++) {
    await page.keyboard.press('Tab')
    const hasFocusRing = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null
      if (!el || el === document.body) return true // Skip if no focusable element

      const styles = window.getComputedStyle(el)
      const outlineVisible = styles.outlineStyle !== 'none' && styles.outlineWidth !== '0px'
      const boxShadowVisible = !!styles.boxShadow && styles.boxShadow !== 'none'
      const ringClass = el.className.includes('ring') || el.className.includes('focus')

      return outlineVisible || boxShadowVisible || ringClass
    })
    focusResults.push(hasFocusRing)
  }

  const visibleCount = focusResults.filter(Boolean).length
  if (visibleCount < focusResults.length) {
    return {
      passed: false,
      issue: `${focusResults.length - visibleCount}/${focusResults.length} focused elements lack visible focus ring`
    }
  }
  return { passed: true }
}

async function runA11yAudit(page: any, routeName: string): Promise<UXIssue[]> {
  const issues: UXIssue[] = []

  // Check inputs
  const inputCheck = await checkInputsHaveLabels(page)
  if (!inputCheck.passed) {
    issues.push({
      severity: 'major',
      category: 'accessibility',
      route: routeName,
      issue: inputCheck.issue!,
      expected: 'All form inputs should have associated labels or aria-label'
    })
  }

  // Check buttons
  const buttonCheck = await checkButtonsHaveNames(page)
  if (!buttonCheck.passed) {
    issues.push({
      severity: 'major',
      category: 'accessibility',
      route: routeName,
      issue: buttonCheck.issue!,
      expected: 'All buttons should have accessible names via text, aria-label, or title'
    })
  }

  // Check focus visibility
  const focusCheck = await checkFocusVisibility(page)
  if (!focusCheck.passed) {
    issues.push({
      severity: 'major',
      category: 'accessibility',
      route: routeName,
      issue: focusCheck.issue!,
      expected: 'All focusable elements should show visible focus indicator'
    })
  }

  // Save accessibility snapshot
  try {
    const snapshot = await page.accessibility.snapshot()
    if (snapshot) {
      fs.writeFileSync(
        path.join(A11Y_DIR, `${routeName}-a11y.json`),
        JSON.stringify(snapshot, null, 2)
      )
    }
  } catch (e) {
    // Accessibility snapshot may not be available in all contexts
  }

  return issues
}

// ============================================================================
// REPORT GENERATION
// ============================================================================

function generateReport() {
  const timestamp = new Date().toISOString()

  const critical = allUxIssues.filter((i) => i.severity === 'critical')
  const major = allUxIssues.filter((i) => i.severity === 'major')
  const minor = allUxIssues.filter((i) => i.severity === 'minor')
  const enhancement = allUxIssues.filter((i) => i.severity === 'enhancement')

  const a11yIssues = allUxIssues.filter((i) => i.category === 'accessibility')
  const visualIssues = allUxIssues.filter((i) => i.category === 'visual')
  const interactionIssues = allUxIssues.filter((i) => i.category === 'interaction')

  const report = `# tldw Extension UX Review Report

Generated: ${timestamp}

## Executive Summary

- **Total Issues Found**: ${allUxIssues.length}
  - Critical: ${critical.length}
  - Major: ${major.length}
  - Minor: ${minor.length}
  - Enhancement: ${enhancement.length}

- **By Category**:
  - Accessibility: ${a11yIssues.length}
  - Visual: ${visualIssues.length}
  - Interaction: ${interactionIssues.length}

---

## Screenshot Gallery

Screenshots are organized in \`${SCREENSHOTS_DIR}\`:

### Sidepanel
| Route | Light | Dark |
|-------|-------|------|
| Chat | sidepanel-chat_light.png | sidepanel-chat_dark.png |
| Settings | sidepanel-settings_light.png | sidepanel-settings_dark.png |

### Options - Settings
| Route | Light | Dark |
|-------|-------|------|
${OPTIONS_ROUTES.filter((r) => r.category === 'settings')
  .map((r) => `| ${r.description} | ${r.name}_light.png | ${r.name}_dark.png |`)
  .join('\n')}

### Options - Workspaces
| Route | Light | Dark |
|-------|-------|------|
${OPTIONS_ROUTES.filter((r) => r.category === 'workspace')
  .map((r) => `| ${r.description} | ${r.name}_light.png | ${r.name}_dark.png |`)
  .join('\n')}

### Options - Admin
| Route | Light | Dark |
|-------|-------|------|
${OPTIONS_ROUTES.filter((r) => r.category === 'admin')
  .map((r) => `| ${r.description} | ${r.name}_light.png | ${r.name}_dark.png |`)
  .join('\n')}

---

## Accessibility Findings

${critical.length > 0 ? `### Critical Issues\n\n${critical.map((i, idx) => `${idx + 1}. **[${i.route}]** ${i.issue}\n   - Expected: ${i.expected}`).join('\n\n')}` : '### Critical Issues\n\nNone found.'}

${major.length > 0 ? `### Major Issues\n\n${major.map((i, idx) => `${idx + 1}. **[${i.route}]** ${i.issue}\n   - Expected: ${i.expected}`).join('\n\n')}` : '### Major Issues\n\nNone found.'}

${minor.length > 0 ? `### Minor Issues\n\n${minor.map((i, idx) => `${idx + 1}. **[${i.route}]** ${i.issue}\n   - Expected: ${i.expected}`).join('\n\n')}` : '### Minor Issues\n\nNone found.'}

---

## Enhancement Suggestions

${enhancement.length > 0 ? enhancement.map((i, idx) => `${idx + 1}. **[${i.route}]** ${i.issue}\n   - Suggestion: ${i.expected}`).join('\n\n') : 'No enhancement suggestions.'}

---

## Recommendations

1. **Immediate (Critical/Major)**:
   ${critical.concat(major).slice(0, 5).map((i) => `- Fix ${i.issue} on ${i.route}`).join('\n   ') || '- No immediate fixes needed'}

2. **Short-term (Minor)**:
   ${minor.slice(0, 5).map((i) => `- Address ${i.issue} on ${i.route}`).join('\n   ') || '- No short-term fixes needed'}

3. **Long-term (Enhancements)**:
   ${enhancement.slice(0, 5).map((i) => `- Consider ${i.issue} on ${i.route}`).join('\n   ') || '- No long-term enhancements suggested'}

---

## Appendix

- **Full Screenshot Index**: \`${SCREENSHOTS_DIR}\`
- **Accessibility Snapshots**: \`${A11Y_DIR}\`
- **Raw Issues JSON**: \`${path.join(REPORTS_DIR, 'issues.json')}\`
`

  fs.writeFileSync(path.join(REPORTS_DIR, 'ux-report.md'), report)
  fs.writeFileSync(path.join(REPORTS_DIR, 'issues.json'), JSON.stringify(allUxIssues, null, 2))

  console.log('\n' + '='.repeat(60))
  console.log('UX REVIEW COMPLETE')
  console.log('='.repeat(60))
  console.log(`\nTotal Issues: ${allUxIssues.length}`)
  console.log(`  Critical: ${critical.length}`)
  console.log(`  Major: ${major.length}`)
  console.log(`  Minor: ${minor.length}`)
  console.log(`  Enhancement: ${enhancement.length}`)
  console.log(`\nReports saved to: ${REPORTS_DIR}`)
  console.log('='.repeat(60))
}

// ============================================================================
// TEST SETUP
// ============================================================================

test.beforeAll(async () => {
  await ensureDirectories()
})

test.afterAll(async () => {
  generateReport()
})

// ============================================================================
// OPTIONS PAGE ROUTE CAPTURE
// ============================================================================

test.describe('Options Page Screenshots', () => {
  for (const route of OPTIONS_ROUTES) {
    test(`capture ${route.name}`, async () => {
      const { context, page, optionsUrl } = await launchWithExtension('', {
        seedConfig: withAllFeaturesEnabled({
          serverUrl: LIVE_SERVER_URL,
          authMode: 'single-user',
          apiKey: API_KEY
        })
      })

      try {
        await waitForConnectionStore(page, 'init')
        await forceConnected(page)

        // Navigate to route
        await page.goto(`${optionsUrl}#${route.path}`)
        await page.waitForLoadState('networkidle')
        await page.waitForTimeout(500)

        // Capture light mode
        await setDarkMode(page, false)
        await saveScreenshot(page, `${route.name}_light`, route.category)

        // Capture dark mode
        await setDarkMode(page, true)
        await saveScreenshot(page, `${route.name}_dark`, route.category)

        // Run accessibility audit
        const a11yIssues = await runA11yAudit(page, route.name)
        a11yIssues.forEach(logIssue)
      } finally {
        await context.close()
      }
    })
  }
})

// ============================================================================
// SIDEPANEL ROUTE CAPTURE
// ============================================================================

test.describe('Sidepanel Screenshots', () => {
  for (const route of SIDEPANEL_ROUTES) {
    test(`capture ${route.name}`, async () => {
      const { context, page, openSidepanel } = await launchWithExtension('', {
        seedConfig: withAllFeaturesEnabled({
          serverUrl: LIVE_SERVER_URL,
          authMode: 'single-user',
          apiKey: API_KEY
        })
      })

      try {
        await waitForConnectionStore(page, 'init')
        await forceConnected(page)

        const sidepanel = await openSidepanel()
        await waitForConnectionStore(sidepanel, 'sidepanel-init')
        await forceConnected(sidepanel)

        // Navigate if not root
        if (route.path !== '/') {
          await sidepanel.goto(`${sidepanel.url()}#${route.path}`)
        }
        await sidepanel.waitForLoadState('networkidle')
        await sidepanel.waitForTimeout(500)

        // Capture light mode
        await setDarkMode(sidepanel, false)
        await saveScreenshot(sidepanel, `${route.name}_light`, 'sidepanel')

        // Capture dark mode
        await setDarkMode(sidepanel, true)
        await saveScreenshot(sidepanel, `${route.name}_dark`, 'sidepanel')

        // Run accessibility audit
        const a11yIssues = await runA11yAudit(sidepanel, route.name)
        a11yIssues.forEach(logIssue)
      } finally {
        await context.close()
      }
    })
  }
})

// ============================================================================
// STATE CAPTURES
// ============================================================================

test.describe('State Captures', () => {
  test('capture unconfigured state', async () => {
    const { context, page } = await launchWithExtension('', {
      seedConfig: withAllFeaturesEnabled()
      // No serverUrl = unconfigured
    })

    try {
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(1000)

      // Light mode
      await setDarkMode(page, false)
      await saveScreenshot(page, 'state_unconfigured_light', 'states')

      // Dark mode
      await setDarkMode(page, true)
      await saveScreenshot(page, 'state_unconfigured_dark', 'states')

      // Check for onboarding/setup guidance
      const hasSetupGuide = await page
        .getByText(/welcome|get started|connect|configure/i)
        .isVisible()
        .catch(() => false)

      if (!hasSetupGuide) {
        logIssue({
          severity: 'major',
          category: 'interaction',
          route: 'unconfigured',
          issue: 'No clear onboarding guidance when unconfigured',
          expected: 'Show welcome message with setup instructions'
        })
      }
    } finally {
      await context.close()
    }
  })

  test('capture error state (unreachable server)', async () => {
    const { context, page } = await launchWithExtension('', {
      seedConfig: withAllFeaturesEnabled({
        serverUrl: 'http://localhost:9999', // Non-existent
        authMode: 'single-user',
        apiKey: 'test'
      })
    })

    try {
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(1500)

      // Light mode
      await setDarkMode(page, false)
      await saveScreenshot(page, 'state_error_light', 'states')

      // Dark mode
      await setDarkMode(page, true)
      await saveScreenshot(page, 'state_error_dark', 'states')

      // Check for error indication
      const hasErrorIndicator = await page
        .getByText(/cannot.*connect|error|offline|unreachable/i)
        .isVisible()
        .catch(() => false)

      if (!hasErrorIndicator) {
        logIssue({
          severity: 'critical',
          category: 'error-handling',
          route: 'error-state',
          issue: 'No visible error message when server is unreachable',
          expected: 'Clear error message with retry option'
        })
      }

      // Check for retry button
      const hasRetry = await page
        .getByRole('button', { name: /retry|try again|reconnect/i })
        .isVisible()
        .catch(() => false)

      if (!hasRetry) {
        logIssue({
          severity: 'major',
          category: 'error-handling',
          route: 'error-state',
          issue: 'No retry button when connection fails',
          expected: 'Retry Connection button for easy recovery'
        })
      }
    } finally {
      await context.close()
    }
  })

  test('capture connected state', async () => {
    const { context, page } = await launchWithExtension('', {
      seedConfig: withAllFeaturesEnabled({
        serverUrl: LIVE_SERVER_URL,
        authMode: 'single-user',
        apiKey: API_KEY
      })
    })

    try {
      await waitForConnectionStore(page, 'init')
      await forceConnected(page)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(500)

      // Light mode
      await setDarkMode(page, false)
      await saveScreenshot(page, 'state_connected_light', 'states')

      // Dark mode
      await setDarkMode(page, true)
      await saveScreenshot(page, 'state_connected_dark', 'states')
    } finally {
      await context.close()
    }
  })
})

// ============================================================================
// INTERACTION FLOW TESTS
// ============================================================================

test.describe('Interaction Flows', () => {
  test('onboarding wizard flow', async () => {
    const { context, page, optionsUrl } = await launchWithExtension('', {
      seedConfig: withAllFeaturesEnabled()
    })

    try {
      await page.goto(`${optionsUrl}#/onboarding-test`)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(500)

      await saveScreenshot(page, 'flow_onboarding_step1', 'special')

      // Look for URL input
      const urlInput = page.locator('input').first()
      if (await urlInput.isVisible()) {
        await urlInput.fill(LIVE_SERVER_URL)
        await page.waitForTimeout(300)
        await saveScreenshot(page, 'flow_onboarding_step2_url_filled', 'special')
      }

      // Look for next/connect button
      const nextButton = page.getByRole('button', { name: /next|connect|continue/i })
      if (await nextButton.isVisible()) {
        await nextButton.click()
        await page.waitForTimeout(1000)
        await saveScreenshot(page, 'flow_onboarding_step3_after_connect', 'special')
      }
    } finally {
      await context.close()
    }
  })

  test('chat message flow', async () => {
    const { context, page, openSidepanel } = await launchWithExtension('', {
      seedConfig: withAllFeaturesEnabled({
        serverUrl: LIVE_SERVER_URL,
        authMode: 'single-user',
        apiKey: API_KEY
      })
    })

    try {
      await waitForConnectionStore(page, 'init')
      await forceConnected(page)

      const sidepanel = await openSidepanel()
      await waitForConnectionStore(sidepanel, 'sidepanel')
      await forceConnected(sidepanel)
      await sidepanel.waitForTimeout(500)

      // Capture empty state
      await saveScreenshot(sidepanel, 'flow_chat_empty', 'sidepanel')

      // Check for empty state guidance
      const hasEmptyGuidance = await sidepanel
        .getByText(/start.*conversation|type.*message|ask/i)
        .isVisible()
        .catch(() => false)

      if (!hasEmptyGuidance) {
        logIssue({
          severity: 'minor',
          category: 'interaction',
          route: 'sidepanel-chat',
          issue: 'Empty chat shows no guidance for new users',
          expected: 'Show helpful text or example prompts'
        })
      }

      // Fill message input
      const input = sidepanel.locator('textarea').or(sidepanel.getByRole('textbox')).first()
      if (await input.isVisible()) {
        await input.fill('Hello, this is a test message')
        await sidepanel.waitForTimeout(200)
        await saveScreenshot(sidepanel, 'flow_chat_typing', 'sidepanel')
      }

      // Inject synthetic messages to show conversation
      const result = await injectSyntheticMessages(sidepanel, 4)
      if (result.ok) {
        await sidepanel.waitForTimeout(500)
        await saveScreenshot(sidepanel, 'flow_chat_conversation', 'sidepanel')
      }
    } finally {
      await context.close()
    }
  })

  test('settings navigation flow', async () => {
    const { context, page, optionsUrl } = await launchWithExtension('', {
      seedConfig: withAllFeaturesEnabled({
        serverUrl: LIVE_SERVER_URL,
        authMode: 'single-user',
        apiKey: API_KEY
      })
    })

    try {
      await waitForConnectionStore(page, 'init')
      await forceConnected(page)

      // Navigate to settings
      await page.goto(`${optionsUrl}#/settings`)
      await page.waitForLoadState('networkidle')
      await saveScreenshot(page, 'flow_nav_settings_root', 'settings')

      // Navigate to a nested settings page
      await page.goto(`${optionsUrl}#/settings/knowledge`)
      await page.waitForLoadState('networkidle')
      await saveScreenshot(page, 'flow_nav_settings_nested', 'settings')

      // Check for breadcrumbs or back navigation
      const hasBackNav = await page
        .getByRole('button', { name: /back/i })
        .or(page.locator('[aria-label*="back"]'))
        .isVisible()
        .catch(() => false)

      const hasBreadcrumb = await page
        .getByText(/settings.*knowledge/i)
        .isVisible()
        .catch(() => false)

      if (!hasBackNav && !hasBreadcrumb) {
        logIssue({
          severity: 'minor',
          category: 'navigation',
          route: 'settings-knowledge',
          issue: 'Nested settings page lacks breadcrumbs or back navigation',
          expected: 'Show breadcrumb trail or back button for context'
        })
      }
    } finally {
      await context.close()
    }
  })

  test('mode switching via header', async () => {
    const { context, page, optionsUrl } = await launchWithExtension('', {
      seedConfig: withAllFeaturesEnabled({
        serverUrl: LIVE_SERVER_URL,
        authMode: 'single-user',
        apiKey: API_KEY
      })
    })

    try {
      await waitForConnectionStore(page, 'init')
      await forceConnected(page)
      await page.goto(optionsUrl)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(500)

      // Look for mode tabs
      const tabs = page.locator('[role="tab"]')
      const tabCount = await tabs.count()

      if (tabCount > 0) {
        await saveScreenshot(page, 'flow_mode_initial', 'settings')

        // Click second tab if available
        if (tabCount > 1) {
          await tabs.nth(1).click()
          await page.waitForTimeout(500)
          await saveScreenshot(page, 'flow_mode_switched', 'settings')
        }
      } else {
        logIssue({
          severity: 'enhancement',
          category: 'navigation',
          route: 'home',
          issue: 'Mode tabs not found or not using role="tab"',
          expected: 'Mode selector should use proper tab ARIA roles'
        })
      }
    } finally {
      await context.close()
    }
  })

  test('keyboard shortcuts', async () => {
    const { context, page, optionsUrl } = await launchWithExtension('', {
      seedConfig: withAllFeaturesEnabled({
        serverUrl: LIVE_SERVER_URL,
        authMode: 'single-user',
        apiKey: API_KEY
      })
    })

    try {
      await waitForConnectionStore(page, 'init')
      await forceConnected(page)
      await page.goto(optionsUrl)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(500)

      // Test Cmd+K for command palette
      await page.keyboard.press('Meta+k')
      await page.waitForTimeout(300)

      const dialogVisible = await page.locator('[role="dialog"]').isVisible().catch(() => false)
      if (dialogVisible) {
        await saveScreenshot(page, 'flow_keyboard_cmd_k', 'settings')

        // Test escape to close
        await page.keyboard.press('Escape')
        await page.waitForTimeout(200)

        const dialogClosed = !(await page.locator('[role="dialog"]').isVisible().catch(() => true))
        if (!dialogClosed) {
          logIssue({
            severity: 'minor',
            category: 'interaction',
            route: 'command-palette',
            issue: 'Escape key does not close command palette',
            expected: 'Escape should close modal dialogs'
          })
        }
      }

      // Test Cmd+N for new chat
      await page.keyboard.press('Meta+n')
      await page.waitForTimeout(300)
      await saveScreenshot(page, 'flow_keyboard_cmd_n', 'settings')
    } finally {
      await context.close()
    }
  })
})

// ============================================================================
// EMPTY STATE CAPTURES
// ============================================================================

test.describe('Empty States', () => {
  const emptyStateRoutes = [
    { path: '/notes', name: 'Notes' },
    { path: '/flashcards', name: 'Flashcards' },
    { path: '/prompts', name: 'Prompts' },
    { path: '/knowledge', name: 'Knowledge' }
  ]

  for (const route of emptyStateRoutes) {
    test(`capture ${route.name} empty state`, async () => {
      const { context, page, optionsUrl } = await launchWithExtension('', {
        seedConfig: withAllFeaturesEnabled({
          serverUrl: LIVE_SERVER_URL,
          authMode: 'single-user',
          apiKey: API_KEY
        })
      })

      try {
        await waitForConnectionStore(page, 'init')
        await forceConnected(page)

        await page.goto(`${optionsUrl}#${route.path}`)
        await page.waitForLoadState('networkidle')
        await page.waitForTimeout(500)

        await saveScreenshot(page, `empty_${route.name.toLowerCase()}`, 'workspace')

        // Check for helpful empty state
        const hasEmptyState = await page
          .getByText(/no.*items|empty|get.*started|create.*first/i)
          .isVisible()
          .catch(() => false)

        const hasAddButton = await page
          .getByRole('button', { name: /add|create|new|import/i })
          .isVisible()
          .catch(() => false)

        if (!hasEmptyState && !hasAddButton) {
          logIssue({
            severity: 'major',
            category: 'interaction',
            route: route.path,
            issue: `${route.name} shows no helpful empty state`,
            expected: 'Show empty state message with clear CTA to add first item'
          })
        }
      } finally {
        await context.close()
      }
    })
  }
})
