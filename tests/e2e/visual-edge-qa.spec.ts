import { test, expect } from "@playwright/test"
import fs from "node:fs"
import path from "node:path"
import { launchWithExtension } from "./utils/extension"
import { forceConnected, waitForConnectionStore } from "./utils/connection"
import { withAllFeaturesEnabled } from "./utils/feature-flags"

const ARTIFACTS_DIR = path.resolve("playwright-mcp-artifacts/visual-edge")

const normalizeServerUrl = (value: string) =>
  value.match(/^https?:\/\//) ? value : `http://${value}`

const ensureChatInput = async (page: any, attempts = 4) => {
  const startButton = page.getByRole("button", { name: /Start chatting/i })
  const tryDemoButton = page.getByRole("button", { name: /Try Demo/i })
  const connectButton = page.getByRole("button", { name: /^Connect$/i })
  const skipButton = page.getByRole("button", { name: /Skip for now/i })
  const finishButton = page.getByRole("button", { name: /^Finish$/i })
  const finishAnywayButton = page.getByRole("button", {
    name: /Finish without connecting|Finish anyway/i
  })
  const continueAnywayButton = page.getByRole("button", {
    name: /Continue anyway/i
  })
  const remindLaterButton = page.getByRole("button", {
    name: /Remind me later/i
  })

  const resolveInput = async () => {
    let input = page.locator("#textarea-message")
    if ((await input.count()) === 0) {
      input = page.getByTestId("chat-input")
    }
    if ((await input.count()) === 0) {
      input = page.locator("textarea").first()
    }
    if ((await input.count()) === 0) {
      input = page.getByPlaceholder(/Type a message|Connect to tldw/i)
    }
    await expect(input).toBeVisible({ timeout: 5000 })
    return input
  }

  const clickIfVisible = async (locator: typeof startButton) => {
    if ((await locator.count()) > 0) {
      const target = locator.first()
      if (await target.isVisible().catch(() => false)) {
        await target.click()
        return true
      }
    }
    return false
  }

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await resolveInput()
    } catch {
      // fall through to CTA clicks below
    }

    if (await clickIfVisible(startButton)) {
      await page.waitForTimeout(300)
      continue
    }
    if (await clickIfVisible(tryDemoButton)) {
      await page.waitForTimeout(300)
      continue
    }
    if (await clickIfVisible(connectButton)) {
      await page.waitForTimeout(300)
      continue
    }
    if (await clickIfVisible(skipButton)) {
      await page.waitForTimeout(500)
      continue
    }
    if (await clickIfVisible(finishAnywayButton)) {
      await page.waitForTimeout(500)
      continue
    }
    if (await clickIfVisible(finishButton)) {
      await page.waitForTimeout(500)
      continue
    }
    if (await clickIfVisible(continueAnywayButton)) {
      await page.waitForTimeout(500)
      continue
    }
    if (await clickIfVisible(remindLaterButton)) {
      await page.waitForTimeout(500)
      continue
    }
    await page.waitForTimeout(300)
  }

  return resolveInput()
}

const dumpPageState = async (page: any, name: string) => {
  const html = await page.content()
  fs.writeFileSync(path.join(ARTIFACTS_DIR, `${name}.html`), html)
  const state = await page.evaluate(async () => {
    const root = document.querySelector("#root")
    const w: any = window as any
    const store = w.__tldw_useConnectionStore
    const storeState = store?.getState?.().state ?? null
    const readStorage = () =>
      new Promise<Record<string, any> | null>((resolve) => {
        try {
          if (!w.chrome?.storage?.local?.get) {
            resolve(null)
            return
          }
          w.chrome.storage.local.get(null, (items: any) => resolve(items || null))
        } catch {
          resolve(null)
        }
      })
    const storage = await readStorage()
    return {
      url: location.href,
      title: document.title,
      readyState: document.readyState,
      rootExists: !!root,
      rootChildren: root ? root.children.length : 0,
      bodyText: document.body?.innerText?.slice(0, 200) || "",
      storeReady: !!store?.getState,
      connectionState: storeState,
      storage
    }
  })
  fs.writeFileSync(
    path.join(ARTIFACTS_DIR, `${name}.json`),
    JSON.stringify(state, null, 2)
  )
}

test.beforeAll(() => {
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true })
})

test.describe("Visual edge QA", () => {
  test("captures slash-menu empty state and command palette", async () => {
    const logStep = (message: string) => {
      // eslint-disable-next-line no-console
      console.log(`[visual-edge] ${message}`)
    }
    const attachDebug = (target: any, label: string) => {
      target.on("console", (msg: any) => {
        const type = msg.type()
        if (type === "error" || type === "warning") {
          // eslint-disable-next-line no-console
          console.log(`[visual-edge:${label}] ${type}: ${msg.text()}`)
        }
      })
      target.on("requestfailed", (req: any) => {
        // eslint-disable-next-line no-console
        console.log(
          `[visual-edge:${label}] requestfailed: ${req.url()} ${req.failure()?.errorText || ""}`
        )
      })
      target.on("pageerror", (err: Error) => {
        // eslint-disable-next-line no-console
        console.log(
          `[visual-edge:${label}] pageerror: ${err.message}\n${err.stack || ""}`
        )
      })
    }
    const serverUrl = normalizeServerUrl(
      process.env.TLDW_E2E_SERVER_URL || "http://127.0.0.1:8000"
    )
    const apiKey = process.env.TLDW_E2E_API_KEY || ""

    const { context, page } = await launchWithExtension("", {
      seedConfig: withAllFeaturesEnabled({
        __tldw_first_run_complete: true,
        __tldw_allow_offline: true,
        tldwConfig: {
          serverUrl,
          authMode: "single-user",
          ...(apiKey ? { apiKey } : {})
        }
      })
    })

    try {
      const activePage = page
      attachDebug(activePage, "options")
      logStep(`options url: ${activePage.url()}`)
      const root = activePage.locator("#root")
      await waitForConnectionStore(activePage, "visual-edge:options")
      await forceConnected(activePage)
      await activePage.waitForSelector("#root", {
        state: "attached",
        timeout: 15000
      })
      await activePage.waitForTimeout(500)
      await activePage.waitForSelector("#root", {
        state: "attached",
        timeout: 15000
      })
      await activePage.waitForTimeout(500)
      try {
        await activePage.waitForFunction(
          () => {
            const rootEl = document.querySelector("#root")
            return !!rootEl && rootEl.children.length > 0
          },
          undefined,
          { timeout: 8000 }
        )
      } catch {
        await activePage.reload({ waitUntil: "domcontentloaded" })
        await root.waitFor({ state: "attached", timeout: 15000 })
        await activePage.waitForTimeout(500)
      }
      let input

      try {
        logStep("ensure chat input")
        input = await ensureChatInput(activePage, 2)
      } catch {
        await dumpPageState(activePage, "input-missing")
        throw new Error("Unable to locate composer input in sidepanel.")
      }

      logStep("trigger slash empty state")
      await input.fill("/doesnotexist")
      const emptyState = activePage.getByText(/No (commands|results) found/i)
      await expect(emptyState).toBeVisible({ timeout: 5000 })
      await activePage.screenshot({
        path: path.join(ARTIFACTS_DIR, "slash-menu-empty.png"),
        fullPage: true
      })

      logStep("open command palette")
      await activePage.keyboard.press("Meta+k").catch(() => {})
      const palette = activePage.getByRole("dialog", {
        name: /Command Palette/i
      })
      if (!(await palette.isVisible().catch(() => false))) {
        await activePage.keyboard.press("Control+k").catch(() => {})
      }
      await expect(palette).toBeVisible({ timeout: 5000 })
      await activePage.screenshot({
        path: path.join(ARTIFACTS_DIR, "command-palette-open.png"),
        fullPage: true
      })
    } finally {
      await context.close()
    }
  })
})
