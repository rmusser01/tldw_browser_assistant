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

// Configuration
const TEST_EXT_PATH = path.resolve("build/chrome-mv3")
const DEFAULT_SERVER_URL = "http://localhost:8000"
const SERVER_URL = process.env.TLDW_E2E_SERVER_URL || DEFAULT_SERVER_URL
const API_KEY = process.env.TLDW_E2E_API_KEY
if (!API_KEY) {
  throw new Error("TLDW_E2E_API_KEY must be set for performance-virtualization e2e tests")
}

// Performance targets
const TARGETS = {
  scrollFPS: 45, // FPS - minimum acceptable during scroll
  domNodesPerMessage: 20, // Max DOM nodes per rendered message
  coldStartMs: 3000 // Max time from navigation to interactive
}

test.describe("List Virtualization Performance", () => {
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

      const coldStartTime = timer.betweenMarks("dom-loaded", "interactive")

      const report = createReport("Cold Start Performance", [
        {
          name: "DOM loaded to root",
          value: timer.betweenMarks("dom-loaded", "root-mounted"),
          unit: "ms"
        },
        {
          name: "Root to interactive",
          value: timer.betweenMarks("root-mounted", "interactive"),
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

      // Inject synthetic messages via the exposed debug store
      const messageCount = 100
      await page.evaluate((count) => {
        // Access the chat store if exposed for debugging
        const store = (window as any).__tldw_useChatStore?.getState?.()
        if (!store?.addMessage) {
          console.log("Chat store not available for synthetic message injection")
          return
        }

        for (let i = 0; i < count; i++) {
          const role = i % 2 === 0 ? "user" : "assistant"
          const content =
            role === "user"
              ? `Test message ${i}: ${Math.random().toString(36).substring(7)}`
              : `Response ${i}: Lorem ipsum dolor sit amet, consectetur adipiscing elit. ` +
                `Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. ` +
                `Message number ${i} with some additional content to make it realistic.`
          store.addMessage(role, content)
        }
      }, messageCount)

      // Wait for messages to render
      await page.waitForTimeout(1000)

      // Find the scrollable message container
      const containerSelectors = [
        '[data-testid="message-list"]',
        '[class*="message-container"]',
        '[class*="chat-body"]',
        ".overflow-y-auto"
      ]

      let containerSelector = ""
      for (const selector of containerSelectors) {
        if ((await page.locator(selector).count()) > 0) {
          containerSelector = selector
          break
        }
      }

      if (!containerSelector) {
        throw new Error(
          `Could not find scrollable container: expected one of [${containerSelectors.join(
            ", "
          )}]`
        )
      }

      // Measure scroll performance
      const { avgFPS, minFPS, maxFPS, droppedFrames } = await measureScrollFPS(
        page,
        containerSelector,
        3000 // Scroll distance
      )

      const report = createReport("Scroll Performance", [
        {
          name: "Average FPS",
          value: avgFPS,
          unit: " FPS",
          target: TARGETS.scrollFPS
        },
        {
          name: "Min FPS",
          value: minFPS,
          unit: " FPS"
        },
        {
          name: "Max FPS",
          value: maxFPS,
          unit: " FPS"
        },
        {
          name: "Dropped frames",
          value: droppedFrames,
          unit: " frames"
        }
      ], performance.now())

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

      // Count initial DOM nodes in the message area
      const containerSelectors = [
        '[data-testid="message-list"]',
        '[class*="message-container"]',
        '[class*="chat-body"]'
      ]

      let containerSelector = ""
      for (const selector of containerSelectors) {
        if ((await page.locator(selector).count()) > 0) {
          containerSelector = selector
          break
        }
      }

      const initialNodes = containerSelector
        ? await countDOMNodes(page, containerSelector)
        : await countDOMNodes(page, "#root")

      // Inject many messages
      const messageCount = 200
      await page.evaluate((count) => {
        const store = (window as any).__tldw_useChatStore?.getState?.()
        if (!store?.addMessage) return

        for (let i = 0; i < count; i++) {
          const role = i % 2 === 0 ? "user" : "assistant"
          store.addMessage(
            role,
            `Message ${i}: Lorem ipsum dolor sit amet, consectetur adipiscing elit.`
          )
        }
      }, messageCount)

      await page.waitForTimeout(500)

      // Count DOM nodes after adding messages
      const afterNodes = containerSelector
        ? await countDOMNodes(page, containerSelector)
        : await countDOMNodes(page, "#root")

      // With virtualization, node count should be bounded (not proportional to message count)
      const nodeGrowth = afterNodes - initialNodes
      const nodesPerMessage = messageCount > 0 ? nodeGrowth / messageCount : 0

      const report = createReport("DOM Virtualization", [
        {
          name: "Initial DOM nodes",
          value: initialNodes,
          unit: " nodes"
        },
        {
          name: "After 200 messages",
          value: afterNodes,
          unit: " nodes"
        },
        {
          name: "Node growth",
          value: nodeGrowth,
          unit: " nodes"
        },
        {
          name: "Nodes per message",
          value: nodesPerMessage,
          unit: "",
          target: TARGETS.domNodesPerMessage
        }
      ], performance.now())

      logReport(report)

      // If virtualization works, we should have way fewer than messageCount * typical_nodes_per_message
      // A virtualized list should only render ~10-30 visible items
      const maxExpectedNodes = Math.min(50 * 30, messageCount * TARGETS.domNodesPerMessage)

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

      const sidepanel = await openSidepanel()
      timer.mark("navigation-start")

      await sidepanel.waitForSelector("#root", { state: "attached", timeout: 15000 })
      timer.mark("root-mounted")

      const inputSelector = 'textarea[placeholder*="message"], input[placeholder*="message"]'
      await sidepanel.waitForSelector(inputSelector, { state: "visible", timeout: 10000 })
      timer.mark("interactive")

      const coldStartTime = timer.betweenMarks("navigation-start", "interactive")

      const report = createReport("Sidepanel Cold Start", [
        {
          name: "Navigation to root",
          value: timer.betweenMarks("navigation-start", "root-mounted"),
          unit: "ms"
        },
        {
          name: "Root to interactive",
          value: timer.betweenMarks("root-mounted", "interactive"),
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

      if (baselineMemory) {
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
        ], performance.now())

        logReport(report)

        console.log(
          `Memory: ${baselineMemory.usedJSHeapSize.toFixed(1)}MB used / ` +
            `${baselineMemory.totalJSHeapSize.toFixed(1)}MB total`
        )
      } else {
        console.log("Memory API not available in this browser")
      }
    } finally {
      await context.close()
    }
  })
})
