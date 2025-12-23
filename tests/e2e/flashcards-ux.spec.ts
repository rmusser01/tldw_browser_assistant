import { test, expect, type BrowserContext } from "@playwright/test"
import path from "path"
import { launchWithExtension } from "./utils/extension"
import { grantHostPermission } from "./utils/permissions"
import { requireRealServerConfig } from "./utils/real-server"

test.describe("Flashcards workspace UX", () => {
  test("shows connection-focused empty state when server is offline", async () => {
    const extPath = path.resolve("build/chrome-mv3")
    const { context, page, extensionId } = (await launchWithExtension(extPath)) as any
    const optionsUrl = `chrome-extension://${extensionId}/options.html`

    await page.goto(`${optionsUrl}#/flashcards`)

    // When not connected or misconfigured, the Flashcards workspace should
    // surface clear connection messaging (either the global connection card
    // or the feature-specific empty state).
    const headline = page.getByText(
      /Connect to use Flashcards|Explore Flashcards in demo mode|Can.?t reach your tldw server/i
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
            const created = await api("/api/v1/flashcards", {
              method: "POST",
              body: JSON.stringify({
                deck_id: deck.id,
                front: `${baseName} Seed ${i + 1}: What is ${i + 2}?`,
                back: `${baseName} Seed ${i + 1} answer`,
                tags: ["e2e", "seed"]
              })
            })
            cards.push({ uuid: created.uuid, version: created.version })
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
      await page.waitForLoadState("networkidle")

      const tabsRoot = page.getByTestId("flashcards-tabs")
      const getTabPanel = async (name: string) => {
        const tab = tabsRoot.getByRole("tab", { name, exact: true })
        await tab.click()
        const panelId = await tab.getAttribute("aria-controls")
        const panel = panelId ? page.locator(`#${panelId}`) : page.getByRole("tabpanel").first()
        await expect(panel).toBeVisible()
        return panel
      }

      mark("review tab")
      const reviewPanel = await getTabPanel("Review")
      try {
        const reviewDeckSelect = reviewPanel.getByTestId("flashcards-review-deck-select")
        await reviewDeckSelect.click({ timeout: 5000 })
        await page
          .getByRole("option", { name: fixture.deckName, exact: true })
          .click({ timeout: 5000 })
      } catch {
        // If the deck dropdown doesn't open, continue without filtering.
      }
      if ((await reviewPanel.getByTestId("flashcards-review-next-due").count()) > 0) {
        await reviewPanel.getByTestId("flashcards-review-next-due").click()
      }

      const seededFront = `${baseName} Seed 1: What is 2?`
      await expect
        .poll(async () => {
          if ((await reviewPanel.getByTestId("flashcards-review-show-answer").count()) > 0) {
            return "card"
          }
          if ((await reviewPanel.getByText(/No cards due for review/i).count()) > 0) {
            return "empty"
          }
          return "pending"
        }, { timeout: 15000 })
        .not.toBe("pending")

      if ((await reviewPanel.getByTestId("flashcards-review-show-answer").count()) > 0) {
        const hasSeededFront = await reviewPanel
          .getByText(seededFront, { exact: true })
          .isVisible()
        await reviewPanel.getByTestId("flashcards-review-show-answer").click()
        if (hasSeededFront) {
          await expect(
            reviewPanel.getByText(`${baseName} Seed 1 answer`, { exact: true })
          ).toBeVisible()
        } else {
          await expect(reviewPanel.getByText(/Back/i).first()).toBeVisible()
          await expect(
            reviewPanel.getByText(/How well did you remember this card/i)
          ).toBeVisible()
        }
        await reviewPanel.getByTestId("flashcards-review-rate-3").click()
      } else {
        await expect(
          reviewPanel.getByText(/No cards due for review/i)
        ).toBeVisible()
      }

      mark("create tab")
      const createPanel = await getTabPanel("Create")
      const createdFront = `${baseName} UI: Define recursion`
      const createdBack = `${baseName} UI: A function that calls itself`
      await createPanel.getByTestId("flashcards-create-front").fill(createdFront)
      await createPanel.getByTestId("flashcards-create-back").fill(createdBack)
      await createPanel.getByTestId("flashcards-create-submit").click()

      await expect
        .poll(async () => {
          return await page.evaluate(
            async ({ baseUrl, apiKey, query }) => {
              const normalizedBase = baseUrl.replace(/\/$/, "")
              const res = await fetch(
                `${normalizedBase}/api/v1/flashcards?q=${encodeURIComponent(query)}&limit=1&offset=0`,
                {
                  headers: {
                    "Content-Type": "application/json",
                    "x-api-key": apiKey
                  }
                }
              )
              if (!res.ok) return null
              const payload = await res.json().catch(() => null)
              return payload?.items?.[0]?.uuid ?? null
            },
            { baseUrl: normalizedServerUrl, apiKey, query: createdFront }
          )
        })
        .not.toBeNull()
      const createdCardUuid = await page.evaluate(
        async ({ baseUrl, apiKey, query }) => {
          const normalizedBase = baseUrl.replace(/\/$/, "")
          const res = await fetch(
            `${normalizedBase}/api/v1/flashcards?q=${encodeURIComponent(query)}&limit=1&offset=0`,
            {
              headers: {
                "Content-Type": "application/json",
                "x-api-key": apiKey
              }
            }
          )
          if (!res.ok) return null
          const payload = await res.json().catch(() => null)
          return payload?.items?.[0]?.uuid ?? null
        },
        { baseUrl: normalizedServerUrl, apiKey, query: createdFront }
      )
      if (!createdCardUuid) {
        throw new Error("Failed to locate created flashcard via API.")
      }
      const createdUuid = createdCardUuid as string

      mark("manage tab")
      const managePanel = await getTabPanel("Manage")
      await managePanel
        .getByTestId("flashcards-manage-search")
        .locator("input")
        .fill(baseName)

      const manageCard = managePanel.getByTestId(`flashcard-item-${createdUuid}`)
      await expect(manageCard).toBeVisible()

      await manageCard
        .getByTestId(`flashcard-item-${createdUuid}-toggle-answer`)
        .click()
      await expect(
        manageCard.getByText(createdBack, { exact: true })
      ).toBeVisible()

      await manageCard
        .getByTestId(`flashcard-item-${createdUuid}-review`)
        .click()
      const quickReviewModal = page
        .locator(".ant-modal-content")
        .filter({ has: page.locator(".ant-modal-title", { hasText: /Review/i }) })
        .first()
      await expect(quickReviewModal).toBeVisible()
      await quickReviewModal.getByRole("button", { name: /Good/i }).click()
      await expect(quickReviewModal).toBeHidden()

      await manageCard
        .getByTestId(`flashcard-item-${createdUuid}-edit`)
        .click()
      const editModal = page
        .locator(".ant-modal-content")
        .filter({ has: page.locator(".ant-modal-title", { hasText: /Edit Card/i }) })
        .first()
      await expect(editModal).toBeVisible()
      const updatedBack = `${createdBack} (updated)`
      await editModal.getByLabel(/Back/i).fill(updatedBack)
      await editModal.getByRole("button", { name: /Save/i }).click()
      await expect(editModal).toBeHidden()

      mark("import/export tab")
      const importExportPanel = await getTabPanel("Import / Export")
      const importCard = importExportPanel
        .locator(".ant-card")
        .filter({ hasText: /Import Flashcards/i })
        .first()
      const importContent = [
        "Deck\tFront\tBack\tTags\tNotes",
        `${fixture.deckName}\t${baseName} Import: TCP/IP\t${baseName} Import: Networking stack\te2e;imported\t`
      ].join("\n")
      await importCard.getByTestId("flashcards-import-textarea").fill(importContent)
      await expect(
        importCard.getByTestId("flashcards-import-has-header")
      ).toHaveAttribute("aria-checked", "true")
      await importCard.getByTestId("flashcards-import-button").click()
      await expect(importCard.getByTestId("flashcards-import-textarea")).toHaveValue("")

      mark("export download")
      const exportCard = importExportPanel
        .locator(".ant-card")
        .filter({ hasText: /Export Flashcards/i })
        .first()
      const [download] = await Promise.all([
        page.waitForEvent("download", { timeout: 15000 }),
        exportCard.getByTestId("flashcards-export-button").click()
      ])
      expect(download.suggestedFilename()).toBe("flashcards.csv")

      mark("verify import in manage tab")
      const managePanelAfterImport = await getTabPanel("Manage")
      await managePanelAfterImport
        .getByTestId("flashcards-manage-search")
        .locator("input")
        .fill("Import: TCP/IP")
      await expect(
        managePanelAfterImport.getByText(/Import: TCP\/IP/i)
      ).toBeVisible()
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
          await Promise.all(
            items.map((item: any) =>
              fetch(
                `${normalizedServerUrl.replace(/\/$/, "")}/api/v1/flashcards/${encodeURIComponent(
                  item.uuid
                )}?expected_version=${item.version}`,
                { method: "DELETE", headers }
              )
            )
          )
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
