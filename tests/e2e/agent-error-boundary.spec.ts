import { test, expect } from "@playwright/test"
import path from "path"
import { launchWithExtension } from "./utils/extension"

test.describe("AgentErrorBoundary", () => {
  test("catches errors and displays fallback UI", async () => {
    const extPath = path.resolve("build/chrome-mv3")
    const { context, sidepanelUrl } = await launchWithExtension(extPath)
    const page = await context.newPage()

    // Navigate to the error boundary test route
    await page.goto(`${sidepanelUrl}#/error-boundary-test`, {
      waitUntil: "domcontentloaded"
    })

    // Verify the test page loaded correctly
    await expect(page.getByTestId("error-boundary-test-title")).toBeVisible()
    await expect(page.getByTestId("reset-count")).toHaveText("0")

    // Verify the trigger button is visible
    const triggerButton = page.getByTestId("trigger-error-button")
    await expect(triggerButton).toBeVisible()

    // Click the button to trigger an error
    await triggerButton.click()

    // Verify the error boundary fallback UI is displayed
    // The fallback should show an alert icon and error message
    await expect(page.getByText("Test error caught by boundary")).toBeVisible({
      timeout: 5000
    })

    // Verify the "Try Again" button is present
    const tryAgainButton = page.getByRole("button", { name: /try again/i })
    await expect(tryAgainButton).toBeVisible()

    // Verify error details toggle is available
    const detailsToggle = page.getByText(/view error details/i)
    await expect(detailsToggle).toBeVisible()

    // Click to expand error details
    await detailsToggle.click()

    // Verify the actual error message is shown
    await expect(
      page.getByText(/intentionally thrown for e2e testing/i)
    ).toBeVisible()

    // Click "Try Again" to reset the error boundary
    await tryAgainButton.click()

    // Verify the component has reset and is showing the test page again
    await expect(page.getByTestId("error-boundary-test-title")).toBeVisible()

    // Verify the reset count has incremented
    await expect(page.getByTestId("reset-count")).toHaveText("1")

    // Verify we can trigger the error again
    await expect(page.getByTestId("trigger-error-button")).toBeVisible()

    await context.close()
  })

  test("displays custom fallback message", async () => {
    const extPath = path.resolve("build/chrome-mv3")
    const { context, sidepanelUrl } = await launchWithExtension(extPath)
    const page = await context.newPage()

    await page.goto(`${sidepanelUrl}#/error-boundary-test`, {
      waitUntil: "domcontentloaded"
    })

    // Trigger the error
    await page.getByTestId("trigger-error-button").click()

    // Verify the custom fallback message is displayed (from the test route)
    await expect(page.getByText("Test error caught by boundary")).toBeVisible()

    await context.close()
  })

  test("shows component stack in error details", async () => {
    const extPath = path.resolve("build/chrome-mv3")
    const { context, sidepanelUrl } = await launchWithExtension(extPath)
    const page = await context.newPage()

    await page.goto(`${sidepanelUrl}#/error-boundary-test`, {
      waitUntil: "domcontentloaded"
    })

    // Trigger the error
    await page.getByTestId("trigger-error-button").click()

    // Wait for fallback UI
    await expect(page.getByText("Test error caught by boundary")).toBeVisible()

    // Expand error details
    await page.getByText(/view error details/i).click()

    // Verify component stack is shown (should mention BuggyComponent or similar)
    const preElement = page.locator("pre")
    await expect(preElement).toBeVisible()

    // The pre element should contain error information
    const preText = await preElement.textContent()
    expect(preText).toContain("Intentionally thrown for E2E testing")

    await context.close()
  })

  test("can recover multiple times", async () => {
    const extPath = path.resolve("build/chrome-mv3")
    const { context, sidepanelUrl } = await launchWithExtension(extPath)
    const page = await context.newPage()

    await page.goto(`${sidepanelUrl}#/error-boundary-test`, {
      waitUntil: "domcontentloaded"
    })

    // First error cycle
    await page.getByTestId("trigger-error-button").click()
    await expect(page.getByText("Test error caught by boundary")).toBeVisible()
    await page.getByRole("button", { name: /try again/i }).click()
    await expect(page.getByTestId("reset-count")).toHaveText("1")

    // Second error cycle
    await page.getByTestId("trigger-error-button").click()
    await expect(page.getByText("Test error caught by boundary")).toBeVisible()
    await page.getByRole("button", { name: /try again/i }).click()
    await expect(page.getByTestId("reset-count")).toHaveText("2")

    // Third error cycle
    await page.getByTestId("trigger-error-button").click()
    await expect(page.getByText("Test error caught by boundary")).toBeVisible()
    await page.getByRole("button", { name: /try again/i }).click()
    await expect(page.getByTestId("reset-count")).toHaveText("3")

    await context.close()
  })
})
