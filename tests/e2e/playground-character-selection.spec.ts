import fs from "node:fs"
import { expect, test } from "@playwright/test"
import { launchWithExtension } from "./utils/extension"
import { grantHostPermission } from "./utils/permissions"
import { requireRealServerConfig } from "./utils/real-server"
import {
  forceConnected,
  setSelectedModel,
  waitForConnectionStore
} from "./utils/connection"
import { collectGreetings } from "../../src/utils/character-greetings"

const normalizeServerUrl = (value: string) =>
  value.match(/^https?:\/\//) ? value : `http://${value}`

const requestJson = async (
  serverUrl: string,
  apiKey: string,
  path: string,
  init?: RequestInit
) => {
  const response = await fetch(`${serverUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      ...(init?.headers || {})
    }
  })
  const text = await response.text().catch(() => "")
  if (!response.ok) {
    throw new Error(
      `Request failed ${response.status} ${response.statusText}: ${text}`
    )
  }
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

const parseListPayload = (payload: any): any[] => {
  if (Array.isArray(payload)) return payload
  if (!payload || typeof payload !== "object") return []
  return (
    payload.items ||
    payload.results ||
    payload.data ||
    payload.chats ||
    payload.characters ||
    []
  )
}

const getFirstModelId = (payload: any): string | null => {
  const modelsList = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.models)
      ? payload.models
      : []
  const candidate =
    modelsList.find((m: any) => m?.id || m?.model || m?.name) || null
  const id = candidate?.id || candidate?.model || candidate?.name
  return id ? String(id) : null
}

const ensureCharacter = async (serverUrl: string, apiKey: string) => {
  const list = await requestJson(serverUrl, apiKey, "/api/v1/characters/").catch(
    () => requestJson(serverUrl, apiKey, "/api/v1/characters")
  )
  const characters = parseListPayload(list)
  const existingWithGreeting =
    characters.find(
      (c: any) => c?.id && c?.name && collectGreetings(c).length > 0
    ) || null
  if (existingWithGreeting?.id != null && existingWithGreeting?.name) {
    const greetings = collectGreetings(existingWithGreeting)
    return {
      id: String(existingWithGreeting.id),
      name: String(existingWithGreeting.name),
      greetings,
      created: false
    }
  }
  const name = `E2E Character ${Date.now()}`
  const greeting = `Hello from ${name}!`
  const alternateGreetings = [
    `${greeting} (alt 1)`,
    `${greeting} (alt 2)`
  ]
  const created = await requestJson(serverUrl, apiKey, "/api/v1/characters/", {
    method: "POST",
    body: JSON.stringify({
      name,
      greeting,
      first_message: greeting,
      alternate_greetings: alternateGreetings
    })
  }).catch(() =>
    requestJson(serverUrl, apiKey, "/api/v1/characters", {
      method: "POST",
      body: JSON.stringify({
        name,
        greeting,
        first_message: greeting,
        alternate_greetings: alternateGreetings
      })
    })
  )
  if (created?.id == null) {
    throw new Error("Failed to create character for playground test.")
  }
  return {
    id: String(created.id),
    name,
    greetings: [greeting, ...alternateGreetings],
    created: true
  }
}

const deleteCharacter = async (
  serverUrl: string,
  apiKey: string,
  characterId: string
) => {
  await requestJson(serverUrl, apiKey, `/api/v1/characters/${characterId}`, {
    method: "DELETE"
  }).catch(() => null)
}

test.describe("Playground character selection", () => {
  test("sends character_id when chatting as a selected character", async () => {
    test.setTimeout(120000)
    const { serverUrl, apiKey } = requireRealServerConfig(test)
    const normalizedServerUrl = normalizeServerUrl(serverUrl)

    const modelsResponse = await fetch(
      `${normalizedServerUrl}/api/v1/llm/models/metadata`,
      { headers: { "x-api-key": apiKey } }
    )
    if (!modelsResponse.ok) {
      const body = await modelsResponse.text().catch(() => "")
      test.skip(
        true,
        `Chat models preflight failed: ${modelsResponse.status} ${modelsResponse.statusText} ${body}`
      )
    }
    const modelId = getFirstModelId(
      await modelsResponse.json().catch(() => [])
    )
    if (!modelId) {
      test.skip(true, "No chat models returned from tldw_server.")
    }
    const selectedModelId = modelId.startsWith("tldw:")
      ? modelId
      : `tldw:${modelId}`

    const character = await ensureCharacter(normalizedServerUrl, apiKey)
    let createdCharacterId: string | null = character.created
      ? character.id
      : null

    const { context, page, extensionId, optionsUrl } =
      await launchWithExtension("", {
        seedConfig: {
          __tldw_first_run_complete: true,
          tldwConfig: {
            serverUrl: normalizedServerUrl,
            authMode: "single-user",
            apiKey
          }
        }
      })

    const origin = new URL(normalizedServerUrl).origin + "/*"
    const granted = await grantHostPermission(context, extensionId, origin)
    if (!granted) {
      await context.close()
      if (createdCharacterId) {
        await deleteCharacter(
          normalizedServerUrl,
          apiKey,
          createdCharacterId
        )
      }
      test.skip(
        true,
        "Host permission not granted for tldw_server origin; allow it in chrome://extensions > tldw Assistant > Site access, then re-run"
      )
    }

    try {
      await page.goto(`${optionsUrl}#/`, {
        waitUntil: "domcontentloaded"
      })
      await waitForConnectionStore(page, "character-playground:before-check")
      await forceConnected(
        page,
        { serverUrl: normalizedServerUrl },
        "character-playground:force-connect"
      )
      await setSelectedModel(page, selectedModelId)

      await page.evaluate(() => {
        const w = window as any
        if (w.__tldwSendMessageWrapped) return
        w.__tldwSendMessageWrapped = true
        w.__tldwCapturedRequests = []
        const wrapRuntime = (runtime: any) => {
          if (!runtime?.sendMessage || runtime.__tldwWrapped) return
          const original = runtime.sendMessage.bind(runtime)
          runtime.__tldwWrapped = true
          runtime.sendMessage = async (...args: any[]) => {
            const message = args[0]
            if (message?.type === "tldw:request") {
              w.__tldwCapturedRequests.push(message)
            }
            return original(...args)
          }
        }
        try {
          // @ts-ignore
          wrapRuntime((browser as any)?.runtime)
          wrapRuntime((chrome as any)?.runtime)
        } catch {
          // best-effort; if patching fails we still want the test to continue
        }
      })
      await page.evaluate(() => {
        const w = window as any
        if (w.__tldwStorageWrapped) return
        w.__tldwStorageWrapped = true
        w.__tldwStorageWrites = []
        w.__tldwSelectedCharacterSnapshot = null
        const wrap = (area: any, label: string) => {
          if (!area?.set || area.__tldwWrapped) return
          const original = area.set.bind(area)
          area.__tldwWrapped = true
          area.set = (items: Record<string, unknown>, callback?: () => void) => {
            try {
              w.__tldwStorageWrites.push({ label, items })
              if (items && Object.prototype.hasOwnProperty.call(items, "selectedCharacter")) {
                w.__tldwSelectedCharacterSnapshot = items.selectedCharacter
              }
            } catch {}
            return original(items, callback)
          }
        }
        try {
          // @ts-ignore
          const storage = chrome?.storage
          wrap(storage?.sync, "sync")
          wrap(storage?.local, "local")
        } catch {
          // ignore storage wrapping failures
        }
      })

      const composerInput = page.locator("#textarea-message")
      await expect(composerInput).toBeVisible({ timeout: 15000 })

      const trigger = page.locator('button[aria-label*="character"]').first()
      await expect(trigger).toBeVisible({ timeout: 15000 })
      await trigger.click()

      const searchInput = page.getByPlaceholder(/Search characters/i)
      if ((await searchInput.count()) > 0) {
        await searchInput.fill(character.name)
      }
      let menuItem = page
        .locator('[role="menuitem"]', { hasText: character.name })
        .first()
      if ((await menuItem.count()) === 0) {
        menuItem = page
          .locator(".ant-dropdown-menu-item", { hasText: character.name })
          .first()
      }
      await expect(menuItem).toBeVisible({ timeout: 15000 })
      await menuItem.click()

      const storageWriteSeen = await page
        .waitForFunction(
          () => {
            const w = window as any
            const writes = w.__tldwStorageWrites || []
            return writes.some((entry: any) =>
              entry?.items && Object.prototype.hasOwnProperty.call(entry.items, "selectedCharacter")
            )
          },
          undefined,
          { timeout: 15000 }
        )
        .then(() => true)
        .catch(() => false)

      const storageSnapshot = await page.evaluate(() => {
        const w = window as any
        const normalize = (value: any) => {
          if (typeof value !== "string") return value
          try {
            return JSON.parse(value)
          } catch {
            return value
          }
        }
        const writes = w.__tldwStorageWrites || []
        const latest = [...writes]
          .reverse()
          .find(
            (entry: any) =>
              entry?.items &&
              Object.prototype.hasOwnProperty.call(entry.items, "selectedCharacter")
          )
        const selectedCharacter = latest
          ? normalize(latest.items.selectedCharacter)
          : null
        return { selectedCharacter, rawWrites: writes }
      })
      if (!storageWriteSeen || !storageSnapshot.selectedCharacter?.id) {
        test.info().attach("character-storage-writes", {
          body: JSON.stringify(
            {
              storageWriteSeen,
              selectedCharacter: storageSnapshot.selectedCharacter,
              rawWrites: storageSnapshot.rawWrites
            },
            null,
            2
          ),
          contentType: "application/json"
        })
      }
      if (!storageSnapshot.selectedCharacter?.id) {
        const debugPayload = {
          storageWriteSeen,
          selectedCharacter: storageSnapshot.selectedCharacter,
          rawWrites: storageSnapshot.rawWrites
        }
        const debugPath = test
          .info()
          .outputPath("character-storage-missing.json")
        fs.writeFileSync(debugPath, JSON.stringify(debugPayload, null, 2))
        throw new Error("selectedCharacter was not stored after selection.")
      }
      expect(String(storageSnapshot.selectedCharacter.id)).toBe(
        String(character.id)
      )

      const rawGreeting =
        typeof storageSnapshot.selectedCharacter?.greeting === "string"
          ? storageSnapshot.selectedCharacter.greeting
          : ""
      const greetingFallback = Array.isArray(character.greetings)
        ? character.greetings[0]
        : ""
      const greetingSeed = rawGreeting || greetingFallback || ""
      if (greetingSeed.trim().length > 0) {
        const greetingLine =
          greetingSeed
            .split(/\r?\n/)
            .map((line) => line.trim())
            .find((line) => line.length > 0) || ""
        const snippetSource = greetingLine || greetingSeed
        const snippet = snippetSource
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 120)
        const greetingSeen = await page
          .waitForFunction(
            (needle) => {
              const normalize = (value: string) =>
                value.replace(/\s+/g, " ").trim().toLowerCase()
              const needleNorm = normalize(needle)
              const greetingNode =
                document.querySelector(
                  "[data-message-type='character:greeting']"
                ) || document.querySelector("[data-role='assistant']")
              if (!greetingNode) return false
              if (!needleNorm) return true
              const text = greetingNode.textContent || ""
              const normalized = normalize(text)
              return normalized.includes(needleNorm)
            },
            snippet,
            { timeout: 15000 }
          )
          .then(() => true)
          .catch(() => false)
        const greetingRender = await page.evaluate(() => {
          const greetingNode =
            document.querySelector("[data-message-type='character:greeting']") ||
            document.querySelector("[data-role='assistant']")
          if (!greetingNode) return null
          const markdownNodes = Array.from(
            greetingNode.querySelectorAll("pre")
          )
          return {
            text: greetingNode.textContent || "",
            markdownTags: markdownNodes.map((node) =>
              node.tagName.toLowerCase()
            )
          }
        })
        if (!greetingSeen) {
          const debug = await page.evaluate(() => {
            const assistantNodes = Array.from(
              document.querySelectorAll("[data-role='assistant']")
            )
            return {
              assistantText: assistantNodes.map((node) => node.textContent || ""),
              selectedCharacter:
                (window as any).__tldwSelectedCharacterSnapshot || null
            }
          })
          test.info().attach("character-greeting-debug", {
            body: JSON.stringify(debug, null, 2),
            contentType: "application/json"
          })
          const debugPath = test
            .info()
            .outputPath("character-greeting-debug.json")
          fs.writeFileSync(debugPath, JSON.stringify(debug, null, 2))
        }
        expect(greetingSeen).toBeTruthy()
        if (greetingRender?.markdownTags?.length) {
          test.info().attach("character-greeting-markdown", {
            body: JSON.stringify(greetingRender, null, 2),
            contentType: "application/json"
          })
          throw new Error(
            `Greeting message rendered markdown elements: ${greetingRender.markdownTags.join(
              ", "
            )}`
          )
        }
      }

      await page.evaluate(() => {
        ;(window as any).__tldwCapturedRequests = []
      })

      const input = page.locator("#textarea-message")
      await expect(input).toBeVisible({ timeout: 15000 })
      const message = `E2E character chat ${Date.now()}`
      await input.fill(message)
      const sendButton = page
        .getByTestId("chat-send")
        .or(page.getByRole("button", { name: /Send message/i }))
        .or(page.getByRole("button", { name: /^send$/i }))
      await expect(sendButton).toBeEnabled({ timeout: 15000 })
      const createRequestPromise = context
        .waitForEvent("request", {
          predicate: (req) => {
            const url = req.url()
            if (req.method() !== "POST") return false
            if (!/\/api\/v1\/chats\/?(?:\?|$)/.test(url)) return false
            return true
          },
          timeout: 20000
        })
        .catch(() => null)
      await sendButton.click()

      const hasCreateRequest = await page
        .waitForFunction(
          () => {
            const reqs = (window as any).__tldwCapturedRequests || []
            return reqs.some((req: any) => {
              const path = String(req?.payload?.path || "")
              const method = String(req?.payload?.method || "").toUpperCase()
              return (
                method === "POST" &&
                /\/api\/v1\/chats\/?(?:\?|$)/.test(path)
              )
            })
          },
          undefined,
          { timeout: 20000 }
        )
        .then(() => true)
        .catch(() => false)

      const networkRequest = hasCreateRequest
        ? null
        : await createRequestPromise

      if (!hasCreateRequest && !networkRequest) {
        const debug = await page.evaluate(async () => {
          const w = window as any
          const read = (area: any) =>
            new Promise<any>((resolve) => {
              if (!area?.get) {
                resolve(null)
                return
              }
              area.get(["selectedCharacter"], (items: any) => {
                resolve(items?.selectedCharacter ?? null)
              })
            })
          const sync = w?.chrome?.storage?.sync
            ? await read(w.chrome.storage.sync)
            : null
          const local = w?.chrome?.storage?.local
            ? await read(w.chrome.storage.local)
            : null
          const normalize = (value: any) => {
            if (typeof value !== "string") return value
            try {
              return JSON.parse(value)
            } catch {
              return value
            }
          }
          return {
            selectedCharacter: normalize(sync ?? local),
            capturedRequests: w.__tldwCapturedRequests || []
          }
        })
        test.info().attach("character-chat-debug", {
          body: JSON.stringify(debug, null, 2),
          contentType: "application/json"
        })
        throw new Error("No /api/v1/chats create request captured.")
      }

      const captured = await page.evaluate(() => {
        const reqs = (window as any).__tldwCapturedRequests || []
        const matches = reqs.filter((req: any) => {
          const path = String(req?.payload?.path || "")
          const method = String(req?.payload?.method || "").toUpperCase()
          return (
            method === "POST" &&
            /\/api\/v1\/chats\/?(?:\?|$)/.test(path)
          )
        })
        return matches.map((match: any) => match?.payload || null)
      })

      const createBodies: any[] = []
      for (const payload of captured || []) {
        if (!payload) continue
        const body = payload?.body ?? null
        if (body != null) {
          createBodies.push(body)
        }
      }
      if (networkRequest) {
        const postData = networkRequest.postData()
        if (postData) {
          try {
            createBodies.push(JSON.parse(postData))
          } catch {
            createBodies.push(postData)
          }
        }
      }
      const matched = createBodies.find(
        (body) => String(body?.character_id || "") === String(character.id)
      )
      if (!matched) {
        test.info().attach("character-chat-create-bodies", {
          body: JSON.stringify(createBodies, null, 2),
          contentType: "application/json"
        })
        const debugPath = test
          .info()
          .outputPath("character-chat-create-bodies.json")
        fs.writeFileSync(debugPath, JSON.stringify(createBodies, null, 2))
      }
      expect(matched).toBeTruthy()
    } finally {
      if (!page.isClosed()) {
        const finalScreenshotPath = test
          .info()
          .outputPath("final-before-close.png")
        await page
          .screenshot({ path: finalScreenshotPath, fullPage: true })
          .then(() => {
            test.info().attach("final-before-close", {
              path: finalScreenshotPath,
              contentType: "image/png"
            })
          })
          .catch(() => null)
      }
      await context.close()
      if (createdCharacterId) {
        await deleteCharacter(normalizedServerUrl, apiKey, createdCharacterId)
      }
    }
  })
})
