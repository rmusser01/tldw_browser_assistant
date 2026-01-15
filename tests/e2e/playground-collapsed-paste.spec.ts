import { test, expect } from "@playwright/test"
import { launchWithExtension } from "./utils/extension"
import { waitForConnectionStore, forceConnected } from "./utils/connection"

const pasteInto = async (
  page: any,
  selector: string,
  text: string
) => {
  await page.evaluate(
    ({ selector: sel, text: payload }) => {
      const el = document.querySelector(sel)
      if (!el) {
        throw new Error(`Missing element: ${sel}`)
      }
      const data = new DataTransfer()
      data.setData("text/plain", payload)
      const event = new ClipboardEvent("paste", {
        clipboardData: data,
        bubbles: true,
        cancelable: true
      })
      el.dispatchEvent(event)
    },
    { selector, text }
  )
}

const ensureComposer = async (page: any) => {
  const startButton = page.getByRole("button", { name: /Start chatting/i })
  if ((await startButton.count()) > 0) {
    await startButton.first().click()
  }

  let input = page.locator("#textarea-message")
  if ((await input.count()) === 0) {
    input = page.getByPlaceholder(/Type a message/i)
  }
  await expect(input).toBeVisible({ timeout: 15000 })
  await input.click()
  return input
}

test.describe("Playground collapsed paste", () => {
  test("keeps caret after label when typing", async () => {
    const { context, page, optionsUrl } = await launchWithExtension("", {
      seedConfig: {
        __tldw_first_run_complete: true,
        __tldw_allow_offline: true
      }
    })

    try {
      await page.goto(`${optionsUrl}#/`, { waitUntil: "domcontentloaded" })
      await waitForConnectionStore(page, "collapsed-paste:options")
      await forceConnected(page, {}, "collapsed-paste:force-connected")

      const textarea = await ensureComposer(page)

      const prefix = "Hello "
      await page.keyboard.type(prefix)

      const blockText = "x".repeat(2000)
      await pasteInto(page, "#textarea-message", blockText)

      const valueAfterPaste = await textarea.inputValue()
      expect(valueAfterPaste.startsWith(prefix)).toBe(true)
      expect(valueAfterPaste.length).toBeGreaterThan(prefix.length)
      const label = valueAfterPaste.slice(prefix.length)

      await page.keyboard.press("Shift+Enter")
      await page.keyboard.type("after")

      const valueAfterType = await textarea.inputValue()
      expect(valueAfterType).toBe(`${prefix}${label}\nafter`)

      const selection = await page.evaluate(() => {
        const el = document.querySelector<HTMLTextAreaElement>(
          "#textarea-message"
        )
        if (!el) return { start: -1, end: -1, length: -1 }
        return {
          start: el.selectionStart ?? -1,
          end: el.selectionEnd ?? -1,
          length: el.value.length
        }
      })
      expect(selection.start).toBe(selection.length)
      expect(selection.end).toBe(selection.length)
    } finally {
      await context.close()
    }
  })

  test("backspace deletes the collapsed block", async () => {
    const { context, page, optionsUrl } = await launchWithExtension("", {
      seedConfig: {
        __tldw_first_run_complete: true,
        __tldw_allow_offline: true
      }
    })

    try {
      await page.goto(`${optionsUrl}#/`, { waitUntil: "domcontentloaded" })
      await waitForConnectionStore(page, "collapsed-paste:delete")
      await forceConnected(page, {}, "collapsed-paste:delete-connected")

      const textarea = await ensureComposer(page)

      const prefix = "Hello "
      await page.keyboard.type(prefix)
      await pasteInto(page, "#textarea-message", "y".repeat(2000))

      const valueAfterPaste = await textarea.inputValue()
      expect(valueAfterPaste.startsWith(prefix)).toBe(true)
      expect(valueAfterPaste.length).toBeGreaterThan(prefix.length)

      await page.keyboard.press("Backspace")
      await expect(textarea).toHaveValue(prefix)
    } finally {
      await context.close()
    }
  })
})
