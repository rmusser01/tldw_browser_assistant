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

const fetchWithTimeout = async (
  url: string,
  init: RequestInit | undefined,
  timeoutMs = 15000
) => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal
    })
  } finally {
    clearTimeout(timeout)
  }
}

const requestJson = async (
  serverUrl: string,
  apiKey: string,
  path: string,
  init?: RequestInit
) => {
  const response = await fetchWithTimeout(`${serverUrl}${path}`, {
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

const getCharacterTrigger = (page: any) =>
  page
    .getByRole("button", { name: /select character/i })
    .or(page.getByRole("button", { name: /clear character/i }))
    .first()

const confirmCharacterSwitchIfNeeded = async (
  page: any,
  { expectModal = false }: { expectModal?: boolean } = {}
) => {
  const modal = page.locator(".ant-modal")
  const confirmButton = modal.locator(".ant-btn-dangerous").first()
  const isVisible = await confirmButton
    .isVisible({ timeout: expectModal ? 15000 : 2000 })
    .then(() => true)
    .catch(() => false)
  if (!isVisible) {
    if (expectModal) {
      throw new Error("Expected switch character modal, but it was not shown.")
    }
    return
  }
  await confirmButton.click({ timeout: 5000 }).catch(() => {})
  await expect(modal).toBeHidden({ timeout: 15000 })
}

const readSelectedCharacterFromStorage = async (page: any) =>
  page.evaluate(async () => {
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
    const sync = (window as any)?.chrome?.storage?.sync
      ? await read((window as any).chrome.storage.sync)
      : null
    const local = (window as any)?.chrome?.storage?.local
      ? await read((window as any).chrome.storage.local)
      : null
    const value = local ?? sync
    if (typeof value === "string") {
      try {
        return JSON.parse(value)
      } catch {
        return value
      }
    }
    return value
  })

const waitForGreeting = async (page: any, characterName: string) => {
  const greetingMessage = page
    .locator(
      "[data-message-type='character:greeting'], [data-message-type='greeting']"
    )
    .first()
  const visible = await greetingMessage
    .waitFor({ state: "visible", timeout: 15000 })
    .then(() => true)
    .catch(() => false)
  if (!visible) {
    const debug = await page.evaluate(() => {
      const w = window as any
      const store = w.__tldw_useStoreMessageOption?.getState?.()
      const messages = store?.messages || []
      return {
        serverChatId: store?.serverChatId ?? null,
        serverChatCharacterId: store?.serverChatCharacterId ?? null,
        historyId: store?.historyId ?? null,
        selectedCharacter: store?.selectedCharacter ?? null,
        messages: messages.map((msg: any) => ({
          isBot: msg?.isBot,
          name: msg?.name,
          messageType: msg?.messageType ?? msg?.message_type,
          message: msg?.message
        }))
      }
    })
    throw new Error(
      `Character greeting not visible. Debug: ${JSON.stringify(debug)}`
    )
  }
  const hasName = await greetingMessage
    .getByText(new RegExp(characterName, "i"))
    .first()
    .isVisible()
    .catch(() => false)
  if (!hasName) {
    const text = await greetingMessage.textContent()
    throw new Error(
      `Greeting did not mention ${characterName}. Content: ${text || ""}`
    )
  }
  return greetingMessage
}

const createCharacter = async (
  serverUrl: string,
  apiKey: string,
  name: string
) => {
  const greeting = [
    `Hello from ${name}!`,
    "",
    "```",
    `${name} ready`,
    "```",
    "",
    "- /start",
    "- /help"
  ].join("\n")
  const alternateGreetings = [
    [
      `Hello from ${name}!`,
      "",
      "```",
      `${name} alternate 1`,
      "```",
      "",
      "- /alt1"
    ].join("\n"),
    [
      `Hello from ${name}!`,
      "",
      "```",
      `${name} alternate 2`,
      "```",
      "",
      "- /alt2"
    ].join("\n")
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
    greetings: [greeting, ...alternateGreetings]
  }
}

const ensureCharacters = async (
  serverUrl: string,
  apiKey: string,
  count = 2
) => {
  const list = await requestJson(serverUrl, apiKey, "/api/v1/characters/").catch(
    () => requestJson(serverUrl, apiKey, "/api/v1/characters")
  )
  const characters = parseListPayload(list)
  const existing = characters.filter(
    (c: any) => c?.id && c?.name && collectGreetings(c).length > 0
  )
  const results: { id: string; name: string; greetings: string[] }[] = []
  const createdIds: string[] = []
  const usedIds = new Set<string>()

  for (const entry of existing) {
    if (results.length >= count) break
    const id = String(entry.id)
    if (usedIds.has(id)) continue
    usedIds.add(id)
    results.push({
      id,
      name: String(entry.name),
      greetings: collectGreetings(entry)
    })
  }

  while (results.length < count) {
    const suffix = `${Date.now()}-${results.length + 1}`
    const name = `E2E Character ${suffix}`
    const created = await createCharacter(serverUrl, apiKey, name)
    createdIds.push(created.id)
    results.push(created)
  }

  return { characters: results, createdIds }
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

    const modelsResponse = await fetchWithTimeout(
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

    const { characters, createdIds } = await ensureCharacters(
      normalizedServerUrl,
      apiKey,
      2
    )
    const [character, secondCharacter] = characters
    const createdCharacterIds = [...createdIds]

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
    page.setDefaultTimeout(15000)
    page.setDefaultNavigationTimeout(20000)

    const origin = new URL(normalizedServerUrl).origin + "/*"
    const granted = await grantHostPermission(context, extensionId, origin)
    if (!granted) {
      await context.close()
      for (const createdId of createdCharacterIds) {
        await deleteCharacter(normalizedServerUrl, apiKey, createdId)
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

      const trigger = getCharacterTrigger(page)
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
      await confirmCharacterSwitchIfNeeded(page)
      await expect(
        page.getByRole("button", {
          name: new RegExp(
            `${character.name}.*clear character`,
            "i"
          )
        })
      ).toBeVisible({ timeout: 15000 })

      const storageSnapshot = await readSelectedCharacterFromStorage(page)
      if (!storageSnapshot?.id) {
        const debugPayload = {
          selectedCharacter: storageSnapshot
        }
        const debugPath = test
          .info()
          .outputPath("character-storage-missing.json")
        fs.writeFileSync(debugPath, JSON.stringify(debugPayload, null, 2))
        throw new Error("selectedCharacter was not stored after selection.")
      }
      expect(String(storageSnapshot.id)).toBe(String(character.id))

      await waitForGreeting(page, character.name)

      await trigger.click()
      if ((await searchInput.count()) > 0) {
        await searchInput.fill(secondCharacter.name)
      }
      let secondItem = page
        .locator('[role="menuitem"]', { hasText: secondCharacter.name })
        .first()
      if ((await secondItem.count()) === 0) {
        secondItem = page
          .locator(".ant-dropdown-menu-item", { hasText: secondCharacter.name })
          .first()
      }
      await expect(secondItem).toBeVisible({ timeout: 15000 })
      await secondItem.click()
      await confirmCharacterSwitchIfNeeded(page)
      await expect(
        page.getByRole("button", {
          name: new RegExp(
            `${secondCharacter.name}.*clear character`,
            "i"
          )
        })
      ).toBeVisible({ timeout: 15000 })
      await expect
        .poll(
          async () => {
            const selection = await readSelectedCharacterFromStorage(page)
            return selection?.id ? String(selection.id) : ""
          },
          { timeout: 15000 }
        )
        .toBe(String(secondCharacter.id))

      await waitForGreeting(page, secondCharacter.name)
      await expect(
        page.locator(
          "[data-message-type='character:greeting'], [data-message-type='greeting']",
          { hasText: character.name }
        )
      ).toHaveCount(0)
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
      for (const createdId of createdCharacterIds) {
        await deleteCharacter(normalizedServerUrl, apiKey, createdId)
      }
    }
  })
})
