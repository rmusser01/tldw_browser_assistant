import { expect, test, type BrowserContext } from "@playwright/test"
import path from "path"
import { launchWithExtension } from "./utils/extension"
import { grantHostPermission } from "./utils/permissions"
import { requireRealServerConfig } from "./utils/real-server"

test.describe("Quiz workspace UX", () => {
  test("manages quizzes, paginates lists, and completes a quiz", async () => {
    test.setTimeout(120000)
    const mark = (label: string) => {
      // Playwright surfaces stdout; this helps pinpoint long hangs.
      console.log(`[quiz-ux] ${label}`)
    }
    const { serverUrl, apiKey } = requireRealServerConfig(test)
    const normalizedServerUrl = serverUrl.match(/^https?:\/\//)
      ? serverUrl
      : `http://${serverUrl}`

    mark("preflight")
    const preflight = await fetch(
      `${normalizedServerUrl}/api/v1/quizzes?limit=1&offset=0`,
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
        `Quiz API preflight failed: ${preflight.status} ${preflight.statusText} ${body}`
      )
    }
    const extPath = path.resolve("build/chrome-mv3")
    let context: BrowserContext | null = null
    let quizIds: number[] = []

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

      mark("seed config + connection")
      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent("tldw:check-connection"))
      })

      const unique = Date.now()
      const baseName = `E2E Quiz ${unique}`
      const mainQuizName = `${baseName} Main`
      const quizCount = 13
      const mediaTitle = `${baseName} Media`

      const baseQuestions = [
        {
          question_type: "multiple_choice",
          question_text: `${baseName} Q1: 2 + 2 = ?`,
          options: ["4", "3", "2", "1"],
          correct_answer: 0,
          points: 1,
          order_index: 0
        },
        {
          question_type: "true_false",
          question_text: `${baseName} Q2: The sky is blue.`,
          correct_answer: "true",
          points: 1,
          order_index: 1
        },
        {
          question_type: "fill_blank",
          question_text: `${baseName} Q3: Capital of Japan`,
          correct_answer: "Tokyo",
          points: 1,
          order_index: 2
        },
        {
          question_type: "multiple_choice",
          question_text: `${baseName} Q4: Primary color in RGB`,
          options: ["Red", "Green", "Blue", "Yellow"],
          correct_answer: 0,
          points: 1,
          order_index: 3
        },
        {
          question_type: "true_false",
          question_text: `${baseName} Q5: 5 is even.`,
          correct_answer: "false",
          points: 1,
          order_index: 4
        },
        {
          question_type: "fill_blank",
          question_text: `${baseName} Q6: H2O is ___`,
          correct_answer: "water",
          points: 1,
          order_index: 5
        }
      ]

      mark("seed quizzes + questions via API")
      const fixture = await page.evaluate(
        async ({ baseUrl, apiKey, quizCount, mainQuizName, baseName, questions }) => {
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
              throw new Error(`${res.status} ${res.statusText}: ${text}`)
            }
            return payload
          }

          const quizzes = []
          for (let i = 0; i < quizCount; i += 1) {
            const name = i === 0 ? mainQuizName : `${baseName} Extra ${i}`
            const quiz = await api("/api/v1/quizzes", {
              method: "POST",
              body: JSON.stringify({
                name,
                description: "Created by Playwright"
              })
            })
            quizzes.push(quiz)
          }

          const mainQuiz = quizzes[0]
          const createdQuestions = []
          for (const question of questions) {
            const payload = {
              question_type: question.question_type,
              question_text: question.question_text,
              options: question.options ?? null,
              correct_answer: question.correct_answer,
              points: question.points,
              order_index: question.order_index
            }
            const created = await api(`/api/v1/quizzes/${mainQuiz.id}/questions`, {
              method: "POST",
              body: JSON.stringify(payload)
            })
            createdQuestions.push(created)
          }

          const answers = createdQuestions.map((q: any) => ({
            question_id: q.id,
            user_answer: q.correct_answer
          }))
          for (let i = 0; i < 11; i += 1) {
            const attempt = await api(`/api/v1/quizzes/${mainQuiz.id}/attempts`, {
              method: "POST",
              body: JSON.stringify({})
            })
            await api(`/api/v1/quizzes/attempts/${attempt.id}`, {
              method: "PUT",
              body: JSON.stringify({ answers })
            })
          }

          return {
            quizIds: quizzes.map((quiz: any) => quiz.id),
            mainQuizId: mainQuiz.id,
            mainQuizName: mainQuiz.name
          }
        },
        {
          baseUrl: normalizedServerUrl,
          apiKey,
          quizCount,
          mainQuizName,
          baseName,
          questions: baseQuestions
        }
      )

      mark("seed media fixture via API")
      const mediaFixture = await page.evaluate(
        async ({ baseUrl, apiKey, mediaTitle }) => {
          const normalizedBase = baseUrl.replace(/\/$/, "")
          const headers = {
            "x-api-key": apiKey
          }
          const listMedia = async () => {
            const res = await fetch(`${normalizedBase}/api/v1/media?page=1&results_per_page=10`, {
              headers
            })
            if (!res.ok) return null
            return res.json().catch(() => null)
          }
          const pickFromList = async () => {
            const list = await listMedia()
            const first = list?.items?.[0]
            if (first) {
              const title = first.title || `Media #${first.id}`
              return { mediaId: first.id, mediaTitle: title }
            }
            return null
          }

          const existing = await pickFromList()
          if (existing) return existing

          try {
            const form = new FormData()
            form.append("media_type", "document")
            form.append("urls", "https://example.com")
            form.append("title", mediaTitle)
            const res = await fetch(`${normalizedBase}/api/v1/media/add`, {
              method: "POST",
              headers,
              body: form
            })
            if (!res.ok) {
              return { mediaId: null, mediaTitle: null }
            }
          } catch {
            return { mediaId: null, mediaTitle: null }
          }

          for (let i = 0; i < 8; i += 1) {
            await new Promise((resolve) => setTimeout(resolve, 1000))
            const list = await listMedia()
            const match = list?.items?.find((item: any) =>
              String(item?.title || "").includes(mediaTitle)
            )
            if (match) {
              return { mediaId: match.id, mediaTitle: match.title || mediaTitle }
            }
          }

          return { mediaId: null, mediaTitle: null }
        },
        { baseUrl: normalizedServerUrl, apiKey, mediaTitle }
      )

      quizIds = fixture.quizIds
      const updatedQuizName = `${fixture.mainQuizName} Updated`
      const uiQuestionText = `${baseName} UI: The sun rises in the east.`
      const uiOptionCorrect = "East"
      const uiOptionIncorrect = "West"
      const deletedQuestionText = baseQuestions[4].question_text
      const createdQuizName = `${baseName} Manual`
      const createdQuestionText = `${baseName} Manual Q1: Largest planet?`

      mark("open quiz workspace")
      await page.goto(`${optionsUrl}#/quiz`, { waitUntil: "domcontentloaded" })

      const unsupportedBanner = page.getByText(/Quiz API not available/i)
      if (await unsupportedBanner.isVisible().catch(() => false)) {
        test.skip(true, "Server does not advertise the quiz endpoints.")
      }
      const connectBanner = page.getByText(/Connect to use Quiz Playground/i)
      if (await connectBanner.isVisible().catch(() => false)) {
        test.skip(true, "Quiz workspace is offline or not connected.")
      }

      await expect(
        page.getByRole("tab", { name: /Manage/i })
      ).toBeVisible({ timeout: 20000 })

      mark("manage tab")
      await page.getByRole("tab", { name: /Manage/i }).click()

      const managePanel = page
        .getByRole("tabpanel")
        .filter({ has: page.getByPlaceholder(/Search quizzes/i) })
      await Promise.race([
        managePanel.locator(".ant-list-item").first().waitFor({ state: "visible" }),
        managePanel.getByText(/No quizzes yet|No quizzes match/i).waitFor({ state: "visible" })
      ]).catch(() => {})

      const managePagination = managePanel.locator(".ant-pagination").first()
      if ((await managePagination.count()) > 0) {
        await expect(managePagination).toBeVisible()
        await expect(
          managePagination.getByRole("listitem", { name: "2", exact: true })
        ).toBeVisible()
        await managePagination
          .getByRole("listitem", { name: "2", exact: true })
          .click()
        await expect(managePagination.locator(".ant-pagination-item-active")).toHaveText("2")
        await managePagination
          .getByRole("listitem", { name: "1", exact: true })
          .click()
      }

      const searchInput = managePanel.getByPlaceholder(/Search quizzes/i)
      await searchInput.fill(baseName)

      await expect(managePanel.getByText(fixture.mainQuizName, { exact: true })).toBeVisible()

      const quizRow = managePanel.locator(".ant-list-item").filter({
        hasText: fixture.mainQuizName
      })
      await expect(quizRow).toBeVisible()
      await quizRow.scrollIntoViewIfNeeded()
      let editButton = managePanel.getByTestId(`quiz-edit-${fixture.mainQuizId}`)
      if ((await editButton.count()) === 0) {
        editButton = quizRow.locator('button:has-text("Edit"), a:has-text("Edit")').first()
      }
      await expect(editButton).toBeVisible()

      const editModal = page.locator(".ant-modal-content").filter({
        has: page.getByLabel(/Quiz Name/i)
      })
      mark("open edit modal")
      await editButton.click({ force: true })
      await expect(editModal).toBeVisible()
      await editModal.getByLabel(/Quiz Name/i).fill(updatedQuizName)
      await editModal.getByLabel(/Description/i).fill("Updated by Playwright")
      await editModal.getByLabel(/Time Limit/i).fill("15")
      await editModal.getByLabel(/Passing Score/i).fill("70")

      mark("save quiz metadata")
      await editModal.getByRole("button", { name: /^Save$/i }).click()
      await Promise.race([
        editModal.waitFor({ state: "hidden" }),
        managePanel.getByText(updatedQuizName, { exact: true }).waitFor({ state: "visible" })
      ]).catch(() => {})
      if (await editModal.isVisible().catch(() => false)) {
        const cancelButton = editModal.getByRole("button", { name: /Cancel/i })
        if (await cancelButton.count()) {
          await cancelButton.click({ force: true })
        } else {
          const modalShell = page.locator(".ant-modal").filter({ has: editModal })
          const closeButton = modalShell.locator(".ant-modal-close")
          if (await closeButton.count()) {
            await closeButton.click({ force: true })
          }
        }
        await editModal.waitFor({ state: "hidden" })
      }
      await expect(managePanel.getByText(updatedQuizName, { exact: true })).toBeVisible()

      mark("reopen edit modal for questions")
      const updatedRow = managePanel.locator(".ant-list-item").filter({
        hasText: updatedQuizName
      })
      await expect(updatedRow).toBeVisible()
      const editButtonUpdated = managePanel.getByTestId(`quiz-edit-${fixture.mainQuizId}`)
      if ((await editButtonUpdated.count()) > 0) {
        await editButtonUpdated.click({ force: true })
      } else {
        await updatedRow.getByRole("button", { name: /Edit/i }).click()
      }
      await expect(editModal).toBeVisible()

      await expect(editModal.getByText(baseQuestions[0].question_text)).toBeVisible()

      mark("add question")
      await editModal.getByRole("button", { name: /Add Question/i }).click()
      const questionModal = page.locator(".ant-modal-content").filter({
        has: page.locator(".ant-modal-title", { hasText: /Add Question/i })
      })
      await expect(questionModal).toBeVisible()
      await questionModal.getByPlaceholder(/Enter your question/i).fill(uiQuestionText)
      await questionModal.getByPlaceholder(/Option 1/i).fill(uiOptionCorrect)
      await questionModal.getByPlaceholder(/Option 2/i).fill(uiOptionIncorrect)
      await questionModal.locator('input[type="radio"]').first().click()
      await questionModal.getByRole("button", { name: /^Save$/i }).click()
      await expect(questionModal).toBeHidden()
      mark("verify added question via API")
      const addedQuestionExists = await page.evaluate(
        async ({ baseUrl, apiKey, quizId, text }) => {
          const normalizedBase = baseUrl.replace(/\/$/, "")
          const res = await fetch(
            `${normalizedBase}/api/v1/quizzes/${quizId}/questions?include_answers=true&limit=200&offset=0`,
            {
              headers: {
                "x-api-key": apiKey
              }
            }
          )
          if (!res.ok) return false
          const data = await res.json().catch(() => null)
          const items = Array.isArray(data?.items) ? data.items : []
          return items.some((item) => item?.question_text === text)
        },
        {
          baseUrl: normalizedServerUrl,
          apiKey,
          quizId: fixture.mainQuizId,
          text: uiQuestionText
        }
      )
      expect(addedQuestionExists).toBeTruthy()

      await expect(editModal.getByText(baseQuestions[0].question_text)).toBeVisible()

      mark("delete question if visible")
      const deleteRow = editModal.locator(".ant-list-item").filter({
        hasText: deletedQuestionText
      })
      if ((await deleteRow.count()) > 0) {
        await deleteRow.getByRole("button", { name: /Delete/i }).click()
        await page.locator(".ant-popover").getByRole("button", { name: /Yes/i }).click()
        await expect(editModal.getByText(deletedQuestionText)).toHaveCount(0)
      }

      mark("close edit modal")
      const closeButton = editModal.getByRole("button", { name: /Cancel/i })
      if (await closeButton.count()) {
        await closeButton.click({ force: true })
      } else {
        const modalShell = page.locator(".ant-modal").filter({ has: editModal })
        const shellClose = modalShell.locator(".ant-modal-close")
        if (await shellClose.count()) {
          await shellClose.click({ force: true })
        }
      }
      await editModal.waitFor({ state: "hidden" })

      mark("create tab")
      await page.getByRole("tab", { name: /Create/i }).click()
      await page.getByLabel(/Quiz Name/i).fill(createdQuizName)
      await page.getByLabel(/Description/i).fill("Created via Playwright")
      await page.getByRole("button", { name: /Add Your First Question/i }).click()
      const questionCard = page.locator(".ant-card").filter({ hasText: /Question 1/i }).first()
      await questionCard.getByPlaceholder(/Enter your question/i).fill(createdQuestionText)
      await questionCard.getByPlaceholder(/Option 1/i).fill("Jupiter")
      await questionCard.getByPlaceholder(/Option 2/i).fill("Mars")
      await questionCard.getByPlaceholder(/Option 3/i).fill("Earth")
      await questionCard.getByPlaceholder(/Option 4/i).fill("Venus")
      await questionCard.locator('input[type="radio"]').first().click()
      await page.getByRole("button", { name: /Save Quiz/i }).click()
      await expect(page.getByText(/Select a quiz to begin/i)).toBeVisible()

      mark("lookup created quiz id via API")
      const createdQuizId = await page.evaluate(
        async ({ baseUrl, apiKey, name }) => {
          const normalizedBase = baseUrl.replace(/\/$/, "")
          const res = await fetch(
            `${normalizedBase}/api/v1/quizzes?q=${encodeURIComponent(name)}&limit=5&offset=0`,
            {
              headers: {
                "x-api-key": apiKey
              }
            }
          )
          if (!res.ok) return null
          const data = await res.json().catch(() => null)
          const match = data?.items?.find((item: any) => item?.name === name)
          return match?.id ?? null
        },
        { baseUrl: normalizedServerUrl, apiKey, name: createdQuizName }
      )
      if (createdQuizId) {
        quizIds.push(createdQuizId)
      }

      mark("manage tab check created quiz")
      await page.getByRole("tab", { name: /Manage/i }).click()
      const managePanelForCreated = page
        .getByRole("tabpanel")
        .filter({ has: page.getByPlaceholder(/Search quizzes/i) })
      const createSearch = managePanelForCreated.getByPlaceholder(/Search quizzes/i)
      await createSearch.fill(createdQuizName)
      await expect(managePanelForCreated.getByText(createdQuizName, { exact: true })).toBeVisible()

      mark("generate tab")
      await page.getByRole("tab", { name: /Generate/i }).click()
      await expect(page.getByText("Select Media", { exact: true })).toBeVisible()
      await expect(page.getByText("Quiz Settings", { exact: true })).toBeVisible()
      await page.getByRole("tab", { name: /Manage/i }).click()
      await expect(
        page.getByRole("tabpanel").filter({ has: page.getByPlaceholder(/Search quizzes/i) })
      ).toBeVisible()

      mark("take quiz tab")
      await page.getByRole("tab", { name: /Take Quiz/i }).click()
      const takePagination = page.locator(".ant-pagination").first()
      await expect(
        takePagination.getByRole("listitem", { name: "2", exact: true })
      ).toBeVisible()

      let quizCard = page.locator(".ant-card").filter({ hasText: updatedQuizName }).first()
      if ((await quizCard.count()) === 0) {
        await takePagination
          .getByRole("listitem", { name: "2", exact: true })
          .click()
        quizCard = page.locator(".ant-card").filter({ hasText: updatedQuizName }).first()
      }
      await expect(quizCard).toBeVisible()
      await quizCard.getByRole("button", { name: /Start Quiz/i }).click()

      let quizCardForAnswers = page.locator(".ant-card").filter({ hasText: updatedQuizName }).first()
      if ((await quizCardForAnswers.count()) === 0) {
        quizCardForAnswers = page.locator(".ant-card").first()
      }
      const questionItems = quizCardForAnswers.locator(".ant-list-item")
      await expect(questionItems.first()).toBeVisible()
      const questionCount = await questionItems.count()
      for (let i = 0; i < questionCount; i += 1) {
        const item = questionItems.nth(i)
        const radios = item.locator('input[type="radio"]')
        if ((await radios.count()) > 0) {
          await radios.first().click()
          continue
        }
        const textbox = item.getByRole("textbox").first()
        if ((await textbox.count()) > 0) {
          await textbox.fill("test")
        }
      }

      mark("submit quiz")
      await page.getByRole("button", { name: /Submit/i }).click()
      await expect(page.getByText(/Score:/i)).toBeVisible()
      await expect(page.getByRole("button", { name: /Retake Quiz/i })).toBeVisible()
      await expect(page.getByText(/Correct answer/i).first()).toBeVisible()

      mark("results tab")
      const resultsTab = page.getByRole("tab", { name: /Results/i })
      await resultsTab.click()
      const resultsPanelId = await resultsTab.getAttribute("aria-controls")
      const resultsPanel = resultsPanelId
        ? page.locator(`#${resultsPanelId}`)
        : page.getByRole("tabpanel").filter({ has: resultsTab })
      await expect(resultsPanel).toBeVisible()
      await resultsPanel.locator(".ant-spin").waitFor({ state: "hidden" })

      const resultsItems = resultsPanel.locator(".ant-list-item")
      const resultsEmpty = resultsPanel.locator(".ant-empty")

      await expect
        .poll(async () => {
          if ((await resultsItems.count()) > 0) return "items"
          if ((await resultsEmpty.count()) > 0) return "empty"
          return "pending"
        })
        .not.toBe("pending")

      if ((await resultsItems.count()) === 0) {
        await expect(resultsEmpty).toBeVisible()
        return
      }

      await expect(resultsItems.first()).toBeVisible()

      const resultsPagination = resultsPanel.locator(".ant-pagination").first()
      if ((await resultsPagination.count()) > 0) {
        const pageTwo = resultsPagination.getByRole("listitem", { name: "2", exact: true })
        if ((await pageTwo.count()) > 0) {
          await pageTwo.click()
          await expect(resultsPagination.locator(".ant-pagination-item-active")).toHaveText(
            "2"
          )
        }
      }
    } finally {
      mark("cleanup quizzes")
      if (context && quizIds.length > 0) {
        const [page] = context.pages()
        await page?.evaluate(
          async ({ baseUrl, apiKey, quizIds }) => {
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
              if (!res.ok) {
                throw new Error(`${res.status} ${res.statusText}`)
              }
              return res.json().catch(() => null)
            }

            for (const quizId of quizIds) {
              try {
                const quiz = await api(`/api/v1/quizzes/${quizId}`)
                const version = quiz?.version
                if (version == null) continue
                await api(`/api/v1/quizzes/${quizId}?expected_version=${version}`, {
                  method: "DELETE"
                })
              } catch {
                // ignore cleanup failures
              }
            }
          },
          { baseUrl: normalizedServerUrl, apiKey, quizIds }
        )
      }
      await context?.close()
    }
  })
})
