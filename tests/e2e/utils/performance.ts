/**
 * Performance testing utilities for E2E tests
 *
 * Provides helpers for measuring timing, memory, and frame rate
 * during Playwright tests against the extension.
 */

import { Page, Request } from "@playwright/test"

export interface PerformanceMetrics {
  name: string
  value: number
  unit: string
  target?: number
  higherIsBetter?: boolean
  passed?: boolean
}

export interface PerformanceReport {
  timestamp: string
  testName: string
  metrics: PerformanceMetrics[]
  duration: number
}

/**
 * High-resolution timer for measuring durations
 */
export class PerfTimer {
  private startTime: number = 0
  private marks: Map<string, number> = new Map()

  start(): void {
    this.startTime = performance.now()
  }

  mark(name: string): void {
    this.marks.set(name, performance.now())
  }

  elapsed(): number {
    return performance.now() - this.startTime
  }

  sinceMark(name: string): number {
    const markTime = this.marks.get(name)
    if (!markTime) return -1
    return performance.now() - markTime
  }

  betweenMarks(start: string, end: string): number {
    const startTime = this.marks.get(start)
    const endTime = this.marks.get(end)
    if (!startTime || !endTime) return -1
    return endTime - startTime
  }

  getStartTime(): number {
    return this.startTime
  }
}

/**
 * Measure time to first token in a streaming response
 * @param page - Playwright page
 * @param inputSelector - Selector for the chat input
 * @param message - Message to send
 * @param responseSelector - Selector for the response container
 * @returns Time in ms until first token appears
 */
export async function measureTimeToFirstToken(
  page: Page,
  inputSelector: string,
  message: string,
  responseSelector: string
): Promise<number> {
  const timer = new PerfTimer()

  // Clear any existing content first
  await page.locator(inputSelector).fill("")

  timer.start()
  timer.mark("input-start")

  // Type and send the message
  await page.locator(inputSelector).fill(message)
  await page.locator(inputSelector).press("Enter")

  timer.mark("message-sent")

  // Wait for first content to appear in response
  await page.waitForFunction(
    (selector) => {
      const el = document.querySelector(selector)
      return el && el.textContent && el.textContent.trim().length > 0
    },
    responseSelector,
    { timeout: 30000 }
  )

  timer.mark("first-token")

  return timer.betweenMarks("message-sent", "first-token")
}

/**
 * Measure streaming throughput (tokens per second)
 * @param page - Playwright page
 * @param responseSelector - Selector for the streaming response
 * @param durationMs - How long to measure (default 5s)
 * @returns Tokens per second
 */
export async function measureStreamingThroughput(
  page: Page,
  responseSelector: string,
  durationMs: number = 5000
): Promise<{ tokensPerSecond: number; totalTokens: number }> {
  const samples: { time: number; length: number }[] = []

  const startTime = Date.now()
  let lastLength = 0

  // Sample the response length periodically
  while (Date.now() - startTime < durationMs) {
    const length = await page.locator(responseSelector).evaluate((el) => {
      return el.textContent?.length || 0
    })

    if (length > lastLength) {
      samples.push({ time: Date.now() - startTime, length })
      lastLength = length
    }

    await page.waitForTimeout(50) // Sample every 50ms
  }

  if (samples.length < 2) {
    return { tokensPerSecond: 0, totalTokens: lastLength }
  }

  // Note: Token estimation uses ~4 chars/token which is approximate for English text
  // Actual tokenization varies by model and language
  // Estimate tokens (roughly 4 chars per token)
  const CHARS_PER_TOKEN = 4 // Approximate for English; adjust as needed
  const totalChars = samples[samples.length - 1].length - samples[0].length
  const totalTokens = Math.ceil(totalChars / CHARS_PER_TOKEN)
  const elapsedSeconds = (samples[samples.length - 1].time - samples[0].time) / 1000

  return {
    tokensPerSecond: elapsedSeconds > 0 ? totalTokens / elapsedSeconds : 0,
    totalTokens
  }
}

/**
 * Measure memory usage delta during an operation
 * @param page - Playwright page
 * @param operation - Async function to measure
 * @returns Memory delta in MB
 */
export async function measureMemoryDelta(
  page: Page,
  operation: () => Promise<void>
): Promise<{ beforeMB: number; afterMB: number; deltaMB: number }> {
  // Force garbage collection if available
  await page.evaluate(() => {
    if ((window as any).gc) {
      (window as any).gc()
    }
  })

  const beforeMB = await page.evaluate(() => {
    if ((performance as any).memory) {
      return (performance as any).memory.usedJSHeapSize / 1024 / 1024
    }
    return 0
  })

  await operation()

  // Force GC again to get accurate reading
  await page.evaluate(() => {
    if ((window as any).gc) {
      (window as any).gc()
    }
  })

  const afterMB = await page.evaluate(() => {
    if ((performance as any).memory) {
      return (performance as any).memory.usedJSHeapSize / 1024 / 1024
    }
    return 0
  })

  return {
    beforeMB,
    afterMB,
    deltaMB: afterMB - beforeMB
  }
}

/**
 * Measure scroll performance (FPS) during rapid scrolling
 * @param page - Playwright page
 * @param containerSelector - Selector for the scrollable container
 * @param scrollDistance - Total distance to scroll in pixels
 * @returns Average FPS during scroll
 */
export async function measureScrollFPS(
  page: Page,
  containerSelector: string,
  scrollDistance: number = 5000
): Promise<{ avgFPS: number; minFPS: number; maxFPS: number; droppedFrames: number }> {
  const result = await page.evaluate(
    async ({ selector, distance }) => {
      const container = document.querySelector(selector)
      if (!container) {
        return { avgFPS: 0, minFPS: 0, maxFPS: 0, droppedFrames: 0 }
      }

      const frameTimes: number[] = []
      let lastFrameTime = performance.now()
      let animationId: number
      let scrollComplete = false

      // Track frame times
      const measureFrame = () => {
        const now = performance.now()
        frameTimes.push(now - lastFrameTime)
        lastFrameTime = now
        if (!scrollComplete) {
          animationId = requestAnimationFrame(measureFrame)
        }
      }

      animationId = requestAnimationFrame(measureFrame)

      // Perform smooth scroll
      const scrollStep = distance / 50 // 50 steps
      for (let i = 0; i < 50; i++) {
        container.scrollTop += scrollStep
        await new Promise((r) => setTimeout(r, 16)) // ~60fps pace
      }

      scrollComplete = true
      cancelAnimationFrame(animationId)

      // Calculate FPS from frame times
      if (frameTimes.length < 2) {
        return { avgFPS: 0, minFPS: 0, maxFPS: 0, droppedFrames: 0 }
      }

      const fpsSamples = frameTimes.slice(1).map((dt) => 1000 / dt)
      const avgFPS = fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length
      const minFPS = Math.min(...fpsSamples)
      const maxFPS = Math.max(...fpsSamples)
      const droppedFrames = fpsSamples.filter((fps) => fps < 30).length

      return { avgFPS, minFPS, maxFPS, droppedFrames }
    },
    { selector: containerSelector, distance: scrollDistance }
  )

  return result
}

/**
 * Count mounted DOM nodes in a container
 * @param page - Playwright page
 * @param containerSelector - Selector for the container
 * @returns Number of child elements
 */
export async function countDOMNodes(
  page: Page,
  containerSelector: string
): Promise<number> {
  return page.evaluate((selector) => {
    const container = document.querySelector(selector)
    if (!container) return 0
    return container.querySelectorAll("*").length
  }, containerSelector)
}

/**
 * Measure cold start time (extension load to interactive)
 * @param page - Playwright page
 * @param readySelector - Selector that indicates the app is ready
 * @returns Time in ms until ready
 */
export async function measureColdStart(
  page: Page,
  url: string,
  readySelector: string
): Promise<number> {
  const timer = new PerfTimer()
  timer.start()

  await page.goto(url, { waitUntil: "domcontentloaded" })
  timer.mark("dom-loaded")

  await page.waitForSelector(readySelector, { state: "visible", timeout: 30000 })
  timer.mark("app-ready")

  return timer.betweenMarks("dom-loaded", "app-ready")
}

/**
 * Track network requests during an operation
 * @param page - Playwright page
 * @param operation - Async function to track
 * @returns Request details
 */
export async function trackNetworkRequests(
  page: Page,
  operation: () => Promise<void>
): Promise<{
  totalRequests: number
  byType: Record<string, number>
  duplicates: string[]
}> {
  const requests: string[] = []
  const byType: Record<string, number> = {}

  const handler = (request: Request) => {
    const url = request.url()
    requests.push(url)

    const type = request.resourceType()
    byType[type] = (byType[type] || 0) + 1
  }

  page.on("request", handler)

  await operation()

  page.off("request", handler)

  // Find duplicates
  const urlCounts = new Map<string, number>()
  for (const url of requests) {
    urlCounts.set(url, (urlCounts.get(url) || 0) + 1)
  }
  const duplicates = Array.from(urlCounts.entries())
    .filter(([, count]) => count > 1)
    .map(([url]) => url)

  return {
    totalRequests: requests.length,
    byType,
    duplicates
  }
}

/**
 * Create a performance report
 */
export function createReport(
  testName: string,
  metrics: PerformanceMetrics[],
  startTime: number
): PerformanceReport {
  // Evaluate pass/fail for each metric
  const evaluatedMetrics = metrics.map((m) => ({
    ...m,
    passed:
      m.target !== undefined
        ? m.higherIsBetter
          ? m.value >= m.target
          : m.value <= m.target
        : undefined
  }))

  return {
    timestamp: new Date().toISOString(),
    testName,
    metrics: evaluatedMetrics,
    duration: performance.now() - startTime
  }
}

/**
 * Log performance report to console in a readable format
 */
export function logReport(report: PerformanceReport): void {
  console.log("\n" + "=".repeat(60))
  console.log(`PERFORMANCE REPORT: ${report.testName}`)
  console.log("=".repeat(60))
  console.log(`Timestamp: ${report.timestamp}`)
  console.log(`Total Duration: ${report.duration.toFixed(2)}ms\n`)

  console.log("Metrics:")
  console.log("-".repeat(60))

  for (const metric of report.metrics) {
    const status =
      metric.passed === undefined ? "" : metric.passed ? " [PASS]" : " [FAIL]"
    const target = metric.target ? ` (target: ${metric.target}${metric.unit})` : ""
    console.log(`  ${metric.name}: ${metric.value.toFixed(2)}${metric.unit}${target}${status}`)
  }

  console.log("=".repeat(60) + "\n")
}

/**
 * Assert performance metric is within target
 */
export function assertPerformance(
  actual: number,
  target: number,
  metricName: string,
  unit: string = "ms"
): void {
  if (actual > target) {
    throw new Error(
      `Performance regression: ${metricName} was ${actual.toFixed(2)}${unit}, ` +
        `expected <= ${target}${unit}`
    )
  }
}
