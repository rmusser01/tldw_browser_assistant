/**
 * React Query Cache Coherency Tests
 *
 * Tests that React Query caching is working correctly to prevent
 * duplicate API requests and ensure data is shared across components.
 */

import { test, expect } from "@playwright/test"
import path from "path"
import { launchWithExtension } from "./utils/extension"
import { createReport, logReport } from "./utils/performance"

// Configuration
const TEST_EXT_PATH = path.resolve("build/chrome-mv3")
const DEFAULT_SERVER_URL = "http://localhost:8000"
const SERVER_URL = process.env.TLDW_E2E_SERVER_URL || DEFAULT_SERVER_URL
const SERVER_ORIGIN = new URL(SERVER_URL).origin
const API_KEY = process.env.TLDW_E2E_API_KEY

// Performance targets
const TARGETS = {
  maxDuplicateRequests: 2, // Allow some duplicate requests for polling
  modelFetchDeduplication: true // Models should only be fetched once
}

test.describe("React Query Cache Performance", () => {
  test.skip(!API_KEY, "TLDW_E2E_API_KEY must be set for performance-cache e2e tests")

  test("tracks API requests on initial load", async () => {
    const { context, page, optionsUrl } = await launchWithExtension(TEST_EXT_PATH, {
      seedConfig: {
        serverUrl: SERVER_URL,
        authMode: "single-user",
        apiKey: API_KEY!
      }
    })

    try {
      const apiRequests: { url: string; method: string }[] = []

      // Track API requests to the configured tldw server origin
      page.on("request", (request) => {
        const rawUrl = request.url()
        let parsed: URL
        try {
          parsed = new URL(rawUrl)
        } catch {
          return
        }
        if (parsed.origin !== SERVER_ORIGIN) return

        const relative = parsed.pathname + (parsed.search || "")
        apiRequests.push({
          url: relative,
          method: request.method()
        })
      })

      await page.goto(optionsUrl, { waitUntil: "domcontentloaded" })
      await page.waitForSelector("#root", { state: "attached", timeout: 15000 })

      // Wait for initial data fetching to complete
      await page.waitForTimeout(3000)

      // Analyze request patterns
      const endpointCounts = new Map<string, number>()
      for (const req of apiRequests) {
        const key = `${req.method} ${req.url.split("?")[0]}`
        endpointCounts.set(key, (endpointCounts.get(key) || 0) + 1)
      }

      // Find duplicates
      const duplicates = Array.from(endpointCounts.entries())
        .filter(([, count]) => count > TARGETS.maxDuplicateRequests)
        .map(([endpoint, count]) => ({ endpoint, count }))

      const report = createReport("Initial Load API Requests", [
        {
          name: "Total requests",
          value: apiRequests.length,
          unit: " requests"
        },
        {
          name: "Unique endpoints",
          value: endpointCounts.size,
          unit: " endpoints"
        },
        {
          name: "Excessive duplicates",
          value: duplicates.length,
          unit: " endpoints",
          target: 0
        }
      ], performance.now())

      logReport(report)

      // Log detailed request breakdown
      console.log("\nAPI Request Breakdown:")
      for (const [endpoint, count] of endpointCounts.entries()) {
        const warning = count > TARGETS.maxDuplicateRequests ? " ⚠️ DUPLICATE" : ""
        console.log(`  ${endpoint}: ${count}${warning}`)
      }

      if (duplicates.length > 0) {
        console.log("\n⚠️ Excessive duplicate requests detected:")
        for (const { endpoint, count } of duplicates) {
          console.log(`  ${endpoint}: ${count} times`)
        }
      }
    } finally {
      await context.close()
    }
  })

  test("navigation between routes reuses cached data", async () => {
    const { context, page, optionsUrl } = await launchWithExtension(TEST_EXT_PATH, {
      seedConfig: {
        serverUrl: SERVER_URL,
        authMode: "single-user",
        apiKey: API_KEY!
      }
    })

    try {
      // Initial load
      await page.goto(optionsUrl, { waitUntil: "domcontentloaded" })
      await page.waitForSelector("#root", { state: "attached", timeout: 15000 })
      await page.waitForTimeout(2000)

      // Start tracking requests after initial load
      const apiRequests: { url: string; method: string; route: string }[] = []
      let currentRoute = "home"

      page.on("request", (request) => {
        const rawUrl = request.url()
        let parsed: URL
        try {
          parsed = new URL(rawUrl)
        } catch {
          return
        }
        if (parsed.origin !== SERVER_ORIGIN) return

        const relative = parsed.pathname + (parsed.search || "")
        apiRequests.push({
          url: relative,
          method: request.method(),
          route: currentRoute
        })
      })

      // Navigate through routes
      const routes = [
        { hash: "#/media", name: "media" },
        { hash: "#/notes", name: "notes" },
        { hash: "#/settings", name: "settings" },
        { hash: "#/", name: "home-return" }
      ]

      for (const route of routes) {
        currentRoute = route.name
        await page.goto(optionsUrl + route.hash, { waitUntil: "domcontentloaded" })
        await page.waitForTimeout(1000)
      }

      // Analyze requests per route
      const requestsByRoute = new Map<string, number>()
      for (const req of apiRequests) {
        requestsByRoute.set(req.route, (requestsByRoute.get(req.route) || 0) + 1)
      }

      const report = createReport("Route Navigation Cache", [
        {
          name: "Total navigation requests",
          value: apiRequests.length,
          unit: " requests"
        },
        ...Array.from(requestsByRoute.entries()).map(([route, count]) => ({
          name: `${route} route`,
          value: count,
          unit: " requests"
        }))
      ], performance.now())

      logReport(report)

      // Returning to home should trigger minimal requests if cache is working
      const homeReturnRequests = requestsByRoute.get("home-return") || 0
      console.log(`Requests on return to home: ${homeReturnRequests}`)

      // Cache should prevent most refetches
      expect(homeReturnRequests).toBeLessThan(10)
    } finally {
      await context.close()
    }
  })

  test("model selector shares cached data", async () => {
    const { context, page, optionsUrl } = await launchWithExtension(TEST_EXT_PATH, {
      seedConfig: {
        serverUrl: SERVER_URL,
        authMode: "single-user",
        apiKey: API_KEY!
      }
    })

    try {
      await page.goto(optionsUrl, { waitUntil: "domcontentloaded" })
      await page.waitForSelector("#root", { state: "attached", timeout: 15000 })

      // Wait for initial load
      await page.waitForTimeout(2000)

      // Track model-related requests
      const modelRequests: string[] = []

      page.on("request", (request) => {
        const url = request.url()
        if (url.includes("/models") || url.includes("/chat/models")) {
          modelRequests.push(url)
        }
      })

      // Click on model selector multiple times
      const modelSelector = page.locator('[data-testid="model-select"], [class*="model-select"], button:has-text("Model")')

      if (await modelSelector.isVisible({ timeout: 5000 }).catch(() => false)) {
        // Open and close model selector several times
        for (let i = 0; i < 3; i++) {
          await modelSelector.click()
          await page.waitForTimeout(500)
          await page.keyboard.press("Escape")
          await page.waitForTimeout(300)
        }

        console.log(`Model API requests during interactions: ${modelRequests.length}`)

        // With proper caching, models should be fetched once initially
        // Subsequent opens should use cached data
        expect(modelRequests.length).toBeLessThan(3)
      } else {
        console.log("Model selector not found, skipping cache test")
      }
    } finally {
      await context.close()
    }
  })

  test("connection status polling is efficient", async () => {
    const { context, page, optionsUrl } = await launchWithExtension(TEST_EXT_PATH, {
      seedConfig: {
        serverUrl: SERVER_URL,
        authMode: "single-user",
        apiKey: API_KEY!
      }
    })

    try {
      await page.goto(optionsUrl, { waitUntil: "domcontentloaded" })
      await page.waitForSelector("#root", { state: "attached", timeout: 15000 })

      const healthRequests: number[] = []
      const startTime = Date.now()

      page.on("request", (request) => {
        const url = request.url()
        if (url.includes("/health") || url.includes("/status")) {
          healthRequests.push(Date.now() - startTime)
        }
      })

      // Wait and observe polling behavior
      await page.waitForTimeout(10000)

      // Analyze polling intervals
      const intervals: number[] = []
      for (let i = 1; i < healthRequests.length; i++) {
        intervals.push(healthRequests[i] - healthRequests[i - 1])
      }

      const avgInterval = intervals.length > 0
        ? intervals.reduce((a, b) => a + b, 0) / intervals.length
        : 0

      const report = createReport("Connection Status Polling", [
        {
          name: "Health check count (10s)",
          value: healthRequests.length,
          unit: " requests"
        },
        {
          name: "Average interval",
          value: avgInterval,
          unit: "ms"
        },
        {
          name: "Requests per minute",
          value: healthRequests.length * 6,
          unit: " req/min"
        }
      ], performance.now())

      logReport(report)

      console.log(`Health checks in 10s: ${healthRequests.length}`)

      // Polling should be reasonable (not more than once per second on average)
      expect(healthRequests.length).toBeLessThan(15)
    } finally {
      await context.close()
    }
  })

  test("background script message deduplication", async () => {
    const { context, page, optionsUrl } = await launchWithExtension(TEST_EXT_PATH, {
      seedConfig: {
        serverUrl: SERVER_URL,
        authMode: "single-user",
        apiKey: API_KEY!
      }
    })

    try {
      await page.goto(optionsUrl, { waitUntil: "domcontentloaded" })
      await page.waitForSelector("#root", { state: "attached", timeout: 15000 })

      // Inject a message counter into the page
      await page.evaluate(() => {
        (window as any).__messageCount = 0
        const originalSendMessage = chrome?.runtime?.sendMessage

        if (originalSendMessage) {
          chrome.runtime.sendMessage = function (...args: any[]) {
            (window as any).__messageCount++
            return originalSendMessage.apply(this, args as any)
          }
        }
      })

      // Perform some actions that trigger background messages
      await page.waitForTimeout(5000)

      const messageCount = await page.evaluate(() => (window as any).__messageCount || 0)

      const report = createReport("Background Message Volume", [
        {
          name: "Messages in 5s",
          value: messageCount,
          unit: " messages"
        },
        {
          name: "Messages per second",
          value: messageCount / 5,
          unit: " msg/s"
        }
      ], performance.now())

      logReport(report)

      console.log(`Background messages: ${messageCount} in 5s`)

      // Should not be excessively chatty
      expect(messageCount).toBeLessThan(50)
    } finally {
      await context.close()
    }
  })
})

test.describe("Stale Time Analysis", () => {
  test.skip(!API_KEY, "TLDW_E2E_API_KEY must be set for performance-cache e2e tests")

  test("documents current staleTime configurations", async () => {
    const { context, page, optionsUrl } = await launchWithExtension(TEST_EXT_PATH, {
      seedConfig: {
        serverUrl: SERVER_URL,
        authMode: "single-user",
        apiKey: API_KEY!
      }
    })

    try {
      await page.goto(optionsUrl, { waitUntil: "domcontentloaded" })
      await page.waitForSelector("#root", { state: "attached", timeout: 15000 })

      // Try to access React Query's cache state
      const cacheInfo = await page.evaluate(() => {
        // Access React Query devtools if available
        const queryClient = (window as any).__REACT_QUERY_DEVTOOLS_TARGET__?.queryClient
          || (window as any).__queryClient

        if (queryClient) {
          const cache = queryClient.getQueryCache()
          const queries = cache.getAll()

          return queries.map((q: any) => ({
            queryKey: JSON.stringify(q.queryKey),
            state: q.state.status,
            dataUpdatedAt: q.state.dataUpdatedAt,
            staleTime: q.options?.staleTime
          }))
        }

        return null
      })

      if (cacheInfo) {
        console.log("\nReact Query Cache State:")
        for (const query of cacheInfo) {
          console.log(`  ${query.queryKey}: ${query.state} (staleTime: ${query.staleTime || 'default'})`)
        }
      } else {
        console.log("React Query cache not accessible from test context")
        console.log("Consider adding __queryClient to window for debugging")
      }
    } finally {
      await context.close()
    }
  })
})
