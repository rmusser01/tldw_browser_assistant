/**
 * List Virtualization Performance Tests
 *
 * Tests the performance of the chat message list virtualization.
 * The extension uses @tanstack/react-virtual for efficient rendering
 * of large conversation histories.
 */

import { test, expect } from "@playwright/test"
import path from "path"
import { launchWithExtension } from "./utils/extension"
import { waitForConnectionStore, forceConnected } from "./utils/connection"
import {
  measureScrollFPS,
  countDOMNodes,
  measureColdStart,
  createReport,
  logReport,
  PerfTimer
} from "./utils/performance"
import { injectSyntheticMessages } from "./utils/synthetic-messages"

// Configuration
const TEST_EXT_PATH = path.resolve(process.env.TLDW_E2E_EXT_PATH || "build/chrome-mv3")
const DEFAULT_SERVER_URL = "http://localhost:8000"
const SERVER_URL = process.env.TLDW_E2E_SERVER_URL || DEFAULT_SERVER_URL
const API_KEY = process.env.TLDW_E2E_API_KEY

// Performance targets
const TARGETS = {
  scrollFPS: 45, // FPS - minimum acceptable during scroll
  domNodesPerMessage: 20, // Max DOM nodes per rendered message
  coldStartMs: 3000 // Max time from navigation to interactive
}

test.describe("List Virtualization Performance", () => {
  test.skip(!API_KEY, "TLDW_E2E_API_KEY must be set for performance-virtualization e2e tests")
  test("cold start time to interactive", async () => {
    const { context, page, optionsUrl } = await launchWithExtension(TEST_EXT_PATH, {
      seedConfig: {
        serverUrl: SERVER_URL,
        authMode: "single-user",
        apiKey: API_KEY
      }
    })

    try {
      const timer = new PerfTimer()
      timer.start()

      // Navigate to options page
      await page.goto(optionsUrl, { waitUntil: "domcontentloaded" })
      timer.mark("dom-loaded")

      // Wait for React root to mount
      await page.waitForSelector("#root", { state: "attached", timeout: 15000 })
      timer.mark("root-mounted")

      // Bypass onboarding by forcing connected state
      await waitForConnectionStore(page, "coldstart-test-init")
      await forceConnected(page, { serverUrl: SERVER_URL }, "coldstart-test-connected")

      // Wait for chat input to be interactive
      const inputSelector = 'textarea[placeholder*="message"], input[placeholder*="message"]'
      await page.waitForSelector(inputSelector, { state: "visible", timeout: 10000 })
      timer.mark("interactive")

      const domLoadedToRoot = timer.betweenMarks("dom-loaded", "root-mounted")
      const rootToInteractive = timer.betweenMarks("root-mounted", "interactive")
      const coldStartTime = timer.betweenMarks("dom-loaded", "interactive")

      // Guard against missing or renamed marks (betweenMarks returns -1).
      expect(domLoadedToRoot).toBeGreaterThan(0)
      expect(rootToInteractive).toBeGreaterThan(0)
      expect(coldStartTime).toBeGreaterThan(0)

      const report = createReport("Cold Start Performance", [
        {
          name: "DOM loaded to root",
          value: domLoadedToRoot,
          unit: "ms"
        },
        {
          name: "Root to interactive",
          value: rootToInteractive,
          unit: "ms"
        },
        {
          name: "Total cold start",
          value: coldStartTime,
          unit: "ms",
          target: TARGETS.coldStartMs
        }
      ], timer.getStartTime())

      logReport(report)

      console.log(`Cold start: ${coldStartTime.toFixed(0)}ms (target: <${TARGETS.coldStartMs}ms)`)
      expect(coldStartTime).toBeLessThan(TARGETS.coldStartMs * 1.5)
    } finally {
      await context.close()
    }
  })

  test("scroll performance with synthetic messages", async () => {
    const { context, page, optionsUrl } = await launchWithExtension(TEST_EXT_PATH, {
      seedConfig: {
        serverUrl: SERVER_URL,
        authMode: "single-user",
        apiKey: API_KEY
      }
    })

    try {
      await page.goto(optionsUrl, { waitUntil: "domcontentloaded" })
      await page.waitForSelector("#root", { state: "attached", timeout: 15000 })

      // Bypass onboarding / ensure stores are ready for deterministic injection.
      await waitForConnectionStore(page, "virtualization-test-init")
      await forceConnected(page, { serverUrl: SERVER_URL }, "virtualization-test-connected")

      const containerSelector = '.quick-chat-helper-modal [role="log"]'
      // Inject synthetic messages via the exposed debug store
      const messageCount = 100
      const injected = await injectSyntheticMessages(page, messageCount)

      test.skip(
        !injected.ok,
        injected.reason || "Synthetic message injection unavailable"
      )

      // Ensure the injected messages have a visible container to render into.
      await page.evaluate(() => {
        ;(window as any).__tldw_useQuickChatStore?.getState?.()?.setIsOpen?.(true)
      })
      await page.waitForSelector(containerSelector, { state: "attached", timeout: 15000 })

      // Deterministic render signal: store has messages + UI has at least one message node.
      await page.waitForFunction(
        ({ expectedCount, selector }) => {
          const store = (window as any).__tldw_useQuickChatStore?.getState?.()
          const n = store?.messages?.length
          if (typeof n !== "number" || n < expectedCount) return false
          const el = document.querySelector(selector) as HTMLElement | null
          if (!el) return false
          const rendered = el.querySelectorAll('[role="article"]').length
          return rendered > 0 && el.scrollHeight > el.clientHeight
        },
        { expectedCount: messageCount, selector: containerSelector },
        { timeout: 15000 }
      )

      // Reset to the top so the scroll measurement starts from a stable state.
      await page.evaluate((selector) => {
        const el = document.querySelector(selector) as HTMLElement | null
        if (el) el.scrollTop = 0
      }, containerSelector)

      // Measure scroll performance
      const startTime = performance.now()
      const { avgFPS, minFPS, maxFPS, droppedFrames } = await measureScrollFPS(
        page,
        containerSelector,
        3000 // Scroll distance
      )

      const report = createReport("Scroll Performance", [
        {
          name: "Average FPS",
          value: avgFPS,
          unit: "FPS",
          target: TARGETS.scrollFPS,
          higherIsBetter: true
        },
        {
          name: "Min FPS",
          value: minFPS,
          unit: "FPS"
        },
        {
          name: "Max FPS",
          value: maxFPS,
          unit: "FPS"
        },
        {
          name: "Dropped frames",
          value: droppedFrames,
          unit: "frames"
        }
      ], startTime)

      logReport(report)

      console.log(`Scroll FPS: avg=${avgFPS.toFixed(0)}, min=${minFPS.toFixed(0)} (target: >${TARGETS.scrollFPS})`)

      // FPS measurement may not work in all environments
      if (avgFPS > 0) {
        expect(avgFPS).toBeGreaterThan(TARGETS.scrollFPS * 0.8)
      }
    } finally {
      await context.close()
    }
  })

  test("DOM node count stays bounded with virtualization", async () => {
    const { context, page, optionsUrl } = await launchWithExtension(TEST_EXT_PATH, {
      seedConfig: {
        serverUrl: SERVER_URL,
        authMode: "single-user",
        apiKey: API_KEY
      }
    })

    try {
      await page.goto(optionsUrl, { waitUntil: "domcontentloaded" })
      await page.waitForSelector("#root", { state: "attached", timeout: 15000 })

      // Bypass onboarding / ensure stores are ready for deterministic injection.
      await waitForConnectionStore(page, "virtualization-test-init")
      await forceConnected(page, { serverUrl: SERVER_URL }, "virtualization-test-connected")

      const containerSelector = '.quick-chat-helper-modal [role="log"]'
      const probe = await injectSyntheticMessages(page, 0)
      test.skip(!probe.ok, probe.reason || "Synthetic message injection unavailable")

      // Ensure the injected messages have a visible container to render into.
      await page.evaluate(() => {
        ;(window as any).__tldw_useQuickChatStore?.getState?.()?.setIsOpen?.(true)
      })
      await page.waitForSelector(containerSelector, { state: "attached", timeout: 15000 })

      const initialNodes = await countDOMNodes(page, containerSelector)

      // Inject many messages
      const startTime = performance.now()
      const messageCount = 200
      const injected = await injectSyntheticMessages(page, messageCount)

      test.skip(
        !injected.ok,
        injected.reason || "Synthetic message injection unavailable"
      )

      // Deterministic render signal: store has messages + UI has at least one message node.
      await page.waitForFunction(
        ({ expectedCount, selector }) => {
          const store = (window as any).__tldw_useQuickChatStore?.getState?.()
          const n = store?.messages?.length
          if (typeof n !== "number" || n < expectedCount) return false
          const el = document.querySelector(selector) as HTMLElement | null
          if (!el) return false
          const rendered = el.querySelectorAll('[role="article"]').length
          return rendered > 0 && el.scrollHeight > el.clientHeight
        },
        { expectedCount: messageCount, selector: containerSelector },
        { timeout: 15000 }
      )

      // Count DOM nodes after adding messages
      const afterNodes = await countDOMNodes(page, containerSelector)

      // With virtualization, node count should be bounded (not proportional to message count)
      const nodeGrowth = afterNodes - initialNodes
      const nodesPerMessage = messageCount > 0 ? nodeGrowth / messageCount : 0

      const report = createReport("DOM Virtualization", [
        {
          name: "Initial DOM nodes",
          value: initialNodes,
          unit: "nodes"
        },
        {
          name: "After 200 messages",
          value: afterNodes,
          unit: "nodes"
        },
        {
          name: "Node growth",
          value: nodeGrowth,
          unit: "nodes"
        },
        {
          name: "Nodes per message",
          value: nodesPerMessage,
          unit: "",
          target: TARGETS.domNodesPerMessage
        }
      ], startTime)

      logReport(report)

      // If virtualization works, we should have way fewer than messageCount * typical_nodes_per_message
      // A virtualized list should only render ~10-30 visible items
      console.log(`DOM nodes: ${afterNodes} (${nodesPerMessage.toFixed(1)} per message)`)

      if (nodesPerMessage > 0) {
        // With proper virtualization, nodes per message should be very low
        // (only visible items are rendered)
        expect(nodesPerMessage).toBeLessThan(TARGETS.domNodesPerMessage)
      }
    } finally {
      await context.close()
    }
  })

  test("sidepanel cold start time", async () => {
    const { context, openSidepanel } = await launchWithExtension(TEST_EXT_PATH, {
      seedConfig: {
        serverUrl: SERVER_URL,
        authMode: "single-user",
        apiKey: API_KEY
      }
    })

    try {
      const timer = new PerfTimer()
      timer.start()

      timer.mark("navigation-start")
      const sidepanel = await openSidepanel()

      await sidepanel.waitForSelector("#root", { state: "attached", timeout: 15000 })
      timer.mark("root-mounted")

      const inputSelector = 'textarea[placeholder*="message"], input[placeholder*="message"]'
      await sidepanel.waitForSelector(inputSelector, { state: "visible", timeout: 10000 })
      timer.mark("interactive")

      const navigationToRoot = timer.betweenMarks("navigation-start", "root-mounted")
      const rootToInteractive = timer.betweenMarks("root-mounted", "interactive")
      const coldStartTime = timer.betweenMarks("navigation-start", "interactive")

      // Guard against missing or renamed marks (betweenMarks returns -1).
      expect(navigationToRoot).toBeGreaterThan(0)
      expect(rootToInteractive).toBeGreaterThan(0)
      expect(coldStartTime).toBeGreaterThan(0)

      const report = createReport("Sidepanel Cold Start", [
        {
          name: "Navigation to root",
          value: navigationToRoot,
          unit: "ms"
        },
        {
          name: "Root to interactive",
          value: rootToInteractive,
          unit: "ms"
        },
        {
          name: "Total cold start",
          value: coldStartTime,
          unit: "ms",
          target: TARGETS.coldStartMs
        }
      ], timer.getStartTime())

      logReport(report)

      console.log(`Sidepanel cold start: ${coldStartTime.toFixed(0)}ms`)
      expect(coldStartTime).toBeLessThan(TARGETS.coldStartMs * 1.5)
    } finally {
      await context.close()
    }
  })
})

test.describe("Memory Performance", () => {
  test.skip(!API_KEY, "TLDW_E2E_API_KEY must be set for performance-virtualization e2e tests")
  test("memory baseline measurement", async () => {
    const { context, page, optionsUrl } = await launchWithExtension(TEST_EXT_PATH, {
      seedConfig: {
        serverUrl: SERVER_URL,
        authMode: "single-user",
        apiKey: API_KEY
      }
    })

    try {
      await page.goto(optionsUrl, { waitUntil: "domcontentloaded" })
      await page.waitForSelector("#root", { state: "attached", timeout: 15000 })

      // Measure baseline memory
      const startTime = performance.now()
      const baselineMemory = await page.evaluate(() => {
        if ((performance as any).memory) {
          return {
            usedJSHeapSize: (performance as any).memory.usedJSHeapSize / 1024 / 1024,
            totalJSHeapSize: (performance as any).memory.totalJSHeapSize / 1024 / 1024,
            jsHeapSizeLimit: (performance as any).memory.jsHeapSizeLimit / 1024 / 1024
          }
        }
        return null
      })

      test.skip(!baselineMemory, "Memory API not available in this browser")
      if (!baselineMemory) return

      expect(baselineMemory.usedJSHeapSize).toBeGreaterThan(0)
      expect(baselineMemory.totalJSHeapSize).toBeGreaterThan(0)
      expect(baselineMemory.totalJSHeapSize).toBeGreaterThanOrEqual(baselineMemory.usedJSHeapSize)
      expect(baselineMemory.jsHeapSizeLimit).toBeGreaterThanOrEqual(baselineMemory.totalJSHeapSize)

      const report = createReport("Memory Baseline", [
        {
          name: "Used JS Heap",
          value: baselineMemory.usedJSHeapSize,
          unit: "MB"
        },
        {
          name: "Total JS Heap",
          value: baselineMemory.totalJSHeapSize,
          unit: "MB"
        },
        {
          name: "Heap Size Limit",
          value: baselineMemory.jsHeapSizeLimit,
          unit: "MB"
        }
      ], startTime)

      logReport(report)

      console.log(
        `Memory: ${baselineMemory.usedJSHeapSize.toFixed(1)}MB used / ` +
          `${baselineMemory.totalJSHeapSize.toFixed(1)}MB total`
      )
    } finally {
      await context.close()
    }
  })
})
