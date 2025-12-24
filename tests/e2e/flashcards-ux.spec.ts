import { test, expect, type BrowserContext, type Locator } from "@playwright/test"
import path from "path"
import { launchWithExtension } from "./utils/extension"
import { grantHostPermission } from "./utils/permissions"
import { requireRealServerConfig } from "./utils/real-server"

test.describe("Flashcards workspace UX", () => {
  const waitForFlashcardsState = async (page: import("@playwright/test").Page) => {
    const managerTab = page.getByRole("tab", { name: "Review", exact: true })
    const offlineHeadline = page.getByText(
      /Connect to use Flashcards|Explore Flashcards in demo mode|Flashcards API not available|Can.?t reach your tldw server/i
    )
    const deadline = Date.now() + 15000
    while (Date.now() < deadline) {
      if (await managerTab.isVisible().catch(() => false)) {
        return "manager"
      }
      if (await offlineHeadline.isVisible().catch(() => false)) {
        return "offline"
      }
      await page.waitForTimeout(300)
    }
    throw new Error("Flashcards workspace did not render manager or offline state.")
  }

  test("shows connection-focused empty state when server is offline", async () => {
    const extPath = path.resolve("build/chrome-mv3")
    const { context, page, extensionId } = (await launchWithExtension(extPath)) as any
    const optionsUrl = `chrome-extension://${extensionId}/options.html`

    await page.goto(`${optionsUrl}#/flashcards`)

    // When not connected or misconfigured, the Flashcards workspace should
    // surface clear connection messaging (either the global connection card
    // or the feature-specific empty state).
    const state = await waitForFlashcardsState(page)
    if (state !== "offline") {
      await context.close()
      return
    }

    const headline = page.getByText(
      /Connect to use Flashcards|Explore Flashcards in demo mode|Flashcards API not available|Can.?t reach your tldw server/i
    )
    await expect(headline).toBeVisible()

    const goToButton = page.getByRole("button", { name: /Go to server card/i })
    const fallbackButton = page.getByRole("button", {
      name: /Retry connection|Set up server/i
    })
    if ((await goToButton.count()) > 0) {
      await expect(goToButton.first()).toBeVisible()
      await goToButton.first().click()
      const card = page.locator("#server-connection-card")
      if ((await card.count()) > 0) {
        await card.scrollIntoViewIfNeeded()
        await expect(card).toBeVisible()
        await expect(
          card.getByRole("button", { name: /Back to workspace/i })
        ).toBeVisible()
      } else {
        await expect(page).toHaveURL(/#\/settings\/tldw/)
      }
    } else {
      await expect(fallbackButton.first()).toBeVisible()
      await fallbackButton.first().click()
    }

    await context.close()
  })

  test("walks through flashcards workflows end-to-end", async () => {
    test.setTimeout(120000)
    const mark = (label: string) => {
      console.log(`[flashcards-ux] ${label}`)
    }
    const { serverUrl, apiKey } = requireRealServerConfig(test)
    const normalizedServerUrl = serverUrl.match(/^https?:\/\//)
      ? serverUrl
      : `http://${serverUrl}`

    mark("preflight")
    const preflight = await fetch(
      `${normalizedServerUrl}/api/v1/flashcards?limit=1&offset=0`,
      {
        headers: {
          "x-api-key": apiKey
        }
      }
    )
    if (!preflight.ok) {
      const body = await preflight.text().catch(() => "")
      test.skip(
        true,
        `Flashcards API preflight failed: ${preflight.status} ${preflight.statusText} ${body}`
      )
    }

    const extPath = path.resolve("build/chrome-mv3")
    let context: BrowserContext | null = null
    const baseName = `E2E Flashcards ${Date.now()}`

    try {
      const pick = async (preferred: Locator, fallback: Locator) =>
        (await preferred.count()) > 0 ? preferred : fallback

      mark("launch extension")
      const launchResult = await launchWithExtension(extPath, {
        seedConfig: {
          tldwConfig: {
            serverUrl: normalizedServerUrl,
            authMode: "single-user",
            apiKey
          }
        }
      })
      context = launchResult.context
      const { page, extensionId, optionsUrl } = launchResult
      const origin = new URL(normalizedServerUrl).origin + "/*"

      mark("grant host permission")
      const granted = await grantHostPermission(context, extensionId, origin)
      if (!granted) {
        test.skip(
          true,
          "Host permission not granted for tldw_server origin; allow it in chrome://extensions > tldw Assistant > Site access, then re-run"
        )
      }

      mark("seed flashcards via API")
      const fixture = await page.evaluate(
        async ({ baseUrl, apiKey, baseName }) => {
          const normalizedBase = baseUrl.replace(/\/$/, "")
          const headers = {
            "Content-Type": "application/json",
            "x-api-key": apiKey
          }
          const api = async (path: string, init: RequestInit = {}) => {
            const res = await fetch(`${normalizedBase}${path}`, {
              ...init,
              headers: {
                ...headers,
                ...(init.headers || {})
              }
            })
            const text = await res.text()
            let payload: any = null
            if (text) {
              try {
                payload = JSON.parse(text)
              } catch {
                payload = text
              }
            }
            if (!res.ok) {
              throw new Error(
                `Flashcards API failed ${path}: ${res.status} ${res.statusText} ${text}`
              )
            }
            return payload
          }

          const decks = await api("/api/v1/flashcards/decks", { method: "GET" })
          let deck = Array.isArray(decks) ? decks[0] : null
          if (!deck) {
            deck = await api("/api/v1/flashcards/decks", {
              method: "POST",
              body: JSON.stringify({
                name: `${baseName} Deck`
              })
            })
          }

          const cards = []
          for (let i = 0; i < 2; i += 1) {
            const front = `${baseName} Seed ${i + 1}: What is ${i + 2}?`
            const back = `${baseName} Seed ${i + 1} answer`
            const created = await api("/api/v1/flashcards", {
              method: "POST",
              body: JSON.stringify({
                deck_id: deck.id,
                front,
                back,
                tags: ["e2e", "seed"]
              })
            })
            cards.push({
              uuid: created.uuid,
              version: created.version,
              front,
              back
            })
          }

          return {
            deckId: deck.id,
            deckName: deck.name,
            cards
          }
        },
        { baseUrl: normalizedServerUrl, apiKey, baseName }
      )

      mark("open flashcards workspace")
      await page.goto(`${optionsUrl}#/flashcards`)
      await page.waitForLoadState("domcontentloaded")

      const state = await waitForFlashcardsState(page)
      if (state !== "manager") {
        const retryButton = page.getByRole("button", {
          name: /Retry connection|Go to server card/i
        })
        if ((await retryButton.count()) > 0) {
          await retryButton.first().click()
        }
        await expect(
          page.getByRole("tab", { name: "Review", exact: true })
        ).toBeVisible({ timeout: 15000 })
      }

      const tabsRoot = page
        .locator(".ant-tabs")
        .filter({ has: page.getByRole("tab", { name: "Review", exact: true }) })
        .first()
      await expect(tabsRoot).toBeVisible()
      const getTabPanel = async (name: string) => {
        const tab = tabsRoot.getByRole("tab", { name, exact: true })
        await expect(tab).toBeVisible()
        await tab.scrollIntoViewIfNeeded()
        await tab.click()
        const panelId = await tab.getAttribute("aria-controls")
        if (!panelId) {
          throw new Error(`Missing panel id for flashcards tab: ${name}`)
        }
        const panel = page.locator(`#${panelId}`)
        await expect(panel).toBeVisible()
        return panel
      }

      mark("review tab")
      mark("create tab")
      const createPanel = await getTabPanel("Create")
      mark("create tab: select deck")
      const deckSelect = createPanel.getByTestId("flashcards-create-deck-select")
      if ((await deckSelect.count()) > 0) {
        await expect(deckSelect).toBeVisible()
        const selection = deckSelect.locator(".ant-select-selection-item")
        const hasSelection = (await selection.count()) > 0
        if (!hasSelection) {
          const newDeckButton = createPanel.getByTestId("flashcards-create-new-deck")
          if ((await newDeckButton.count()) === 0) {
            throw new Error("New Deck button not found for flashcards create flow.")
          }
          await newDeckButton.click()
          const modal = page
            .locator(".ant-modal-content")
            .filter({ has: page.getByText(/New Deck/i) })
            .first()
          await expect(modal).toBeVisible()
          const nameInput = modal.getByPlaceholder(/Name/i)
          await nameInput.fill(`${baseName} Deck UI`)
          const modalCreate = page.getByTestId("flashcards-new-deck-submit")
          await expect(modalCreate).toBeVisible()
          await modalCreate.click()
          await expect(modal).toBeHidden()
        }
        mark("create tab: deck selected")
      } else {
        mark("create tab: deck selector missing")
      }
      mark("create tab: fill form")
      const createdFront = `${baseName} UI: Define recursion`
      const createdBack = `${baseName} UI: A function that calls itself`
      const createFrontField = await pick(
        createPanel.getByTestId("flashcards-create-front"),
        createPanel.getByPlaceholder(/Question or prompt/i)
      )
      const createBackField = await pick(
        createPanel.getByTestId("flashcards-create-back"),
        createPanel.getByPlaceholder(/Answer/i)
      )
      const createSubmit = await pick(
        createPanel.getByTestId("flashcards-create-submit"),
        createPanel.getByRole("button", { name: /^Create$/i })
      )
      await expect(createFrontField).toBeVisible()
      await expect(createBackField).toBeVisible()
      await expect(createSubmit).toBeVisible()
      await createFrontField.fill(createdFront)
      await createBackField.fill(createdBack)
      await expect(createSubmit).toBeEnabled()
      mark("create tab: submit")
      await createSubmit.click()
      mark("create tab: submit done")

      mark("manage tab")
      const managePanel = await getTabPanel("Manage")
      mark("manage tab: panel ready")
      const manageSearch = await pick(
        managePanel.getByTestId("flashcards-manage-search"),
        managePanel.getByPlaceholder(/Search/i)
      )
      const manageSearchInput =
        (await manageSearch.locator("input").count()) > 0
          ? manageSearch.locator("input").first()
          : manageSearch
      await expect(manageSearchInput).toBeVisible()
      const seedCard = fixture.cards[0]
      await manageSearchInput.fill(baseName)
      await manageSearchInput.press("Enter")
      mark("manage tab: search submitted")

      await expect
        .poll(async () => {
          return managePanel
            .locator(".ant-list-item")
            .filter({ hasText: baseName })
            .count()
        }, {
          timeout: 15000
        })
        .toBeGreaterThan(0)
      mark("manage tab: list ready")

      const manageCard = managePanel
        .locator(".ant-list-item")
        .filter({ hasText: baseName })
        .first()
      await expect(manageCard).toBeVisible()

      const toggleAnswerButton = manageCard
        .getByRole("button", { name: /Show Answer|Hide Answer/i })
        .first()
      await toggleAnswerButton.click()
      await expect(
        manageCard.getByRole("button", { name: /Hide Answer/i })
      ).toBeVisible()
      mark("manage tab: toggled answer")

      mark("manage tab: review/edit buttons visible")
      await expect(
        manageCard.getByRole("button", { name: /Review/i }).first()
      ).toBeVisible()
      await expect(
        manageCard.getByRole("button", { name: /Edit/i }).first()
      ).toBeVisible()

      mark("import/export tab")
      if (page.isClosed()) {
        throw new Error("Flashcards page closed before import/export tab.")
      }
      const importExportPanel = await getTabPanel("Import / Export")
      const importCard = importExportPanel
        .locator(".ant-card")
        .filter({ hasText: /Import Flashcards/i })
        .first()
      const importContent = [
        "Deck\tFront\tBack\tTags\tNotes",
        `${fixture.deckName}\t${baseName} Import: TCP/IP\t${baseName} Import: Networking stack\te2e;imported\t`
      ].join("\n")
      const importTextarea = await pick(
        importCard.getByTestId("flashcards-import-textarea"),
        importCard.getByPlaceholder(/Paste content here/i)
      )
      await importTextarea.fill(importContent)
      const headerSwitch = await pick(
        importCard.getByTestId("flashcards-import-has-header"),
        importCard.locator(".ant-switch").first()
      )
      if ((await headerSwitch.getAttribute("aria-checked")) !== "true") {
        await headerSwitch.click()
      }
      const importButton = await pick(
        importCard.getByTestId("flashcards-import-button"),
        importCard.getByRole("button", { name: /Import/i })
      )
      await importButton.click()
      await expect(importTextarea).toHaveValue("")

      mark("export download")
      const exportCard = importExportPanel
        .locator(".ant-card")
        .filter({ hasText: /Export Flashcards/i })
        .first()
      const exportButton = await pick(
        exportCard.getByTestId("flashcards-export-button"),
        exportCard.getByRole("button", { name: /Export/i })
      )
      const [download] = await Promise.all([
        page.waitForEvent("download", { timeout: 15000 }),
        exportButton.click()
      ])
      expect(download.suggestedFilename()).toBe("flashcards.csv")

      mark("verify import via api")
      await expect
        .poll(async () => {
          const res = await fetch(
            `${normalizedServerUrl.replace(/\/$/, "")}/api/v1/flashcards?due_status=all&limit=100&offset=0&order_by=due_at`,
            {
              headers: {
                "Content-Type": "application/json",
                "x-api-key": apiKey
              }
            }
          )
          if (!res.ok) return false
          const payload = await res.json().catch(() => null)
          return (payload?.items || []).some((item: any) =>
            String(item?.front || "").includes("Import: TCP/IP")
          )
        }, {
          timeout: 15000
        })
        .toBe(true)
    } finally {
      mark("cleanup flashcards")
      try {
        const headers = {
          "Content-Type": "application/json",
          "x-api-key": apiKey
        }
        const res = await fetch(
          `${normalizedServerUrl.replace(/\/$/, "")}/api/v1/flashcards?q=${encodeURIComponent(
            baseName
          )}&limit=200&offset=0`,
          { headers }
        )
        if (res.ok) {
          const payload = await res.json().catch(() => null)
          const items = payload?.items || []
          const deleteWithRetry = async (item: any) => {
            const url = `${normalizedServerUrl.replace(
              /\/$/,
              ""
            )}/api/v1/flashcards/${encodeURIComponent(item.uuid)}?expected_version=${item.version}`
            for (let attempt = 0; attempt < 3; attempt += 1) {
              const res = await fetch(url, { method: "DELETE", headers })
              if (res.ok || res.status === 404) {
                return
              }
              const body = await res.text().catch(() => "")
              if (!/locked/i.test(body)) {
                return
              }
              await new Promise((resolve) =>
                setTimeout(resolve, 200 * (attempt + 1))
              )
            }
          }
          for (const item of items) {
            await deleteWithRetry(item)
          }
        }
      } catch (err) {
        console.warn("[flashcards-ux] cleanup failed", err)
      }
      if (context) {
        await context.close()
      }
    }
  })
})
