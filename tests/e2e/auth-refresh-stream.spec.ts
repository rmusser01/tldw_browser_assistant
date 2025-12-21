import { test, expect } from "@playwright/test"
import http from "node:http"
import { AddressInfo } from "node:net"
import path from "node:path"
import { launchWithExtension } from "./utils/extension"

const EXT_PATH = path.resolve("build/chrome-mv3")
const EXPIRED_TOKEN = "expired-token"
const FRESH_TOKEN = "fresh-token"
const REFRESH_TOKEN = "refresh-token"
const TEST_MODEL = "openai/gpt-4.1-mini"

type AuthServerState = {
  streamAuths: string[]
  requestAuths: string[]
  loginAuth: string | null
  loginApiKey: string | null
  refreshCalls: number
}

function createAuthRefreshServer() {
  const state: AuthServerState = {
    streamAuths: [],
    requestAuths: [],
    loginAuth: null,
    loginApiKey: null,
    refreshCalls: 0
  }

  const server = http.createServer((req, res) => {
    const url = (req.url || "").split("?")[0]

    if (url === "/api/v1/health") {
      res.writeHead(200, { "content-type": "application/json" })
      return res.end(JSON.stringify({ status: "ok" }))
    }

    if (url === "/api/v1/rag/health") {
      res.writeHead(200, { "content-type": "application/json" })
      return res.end(JSON.stringify({ status: "ok" }))
    }

    if (url === "/api/v1/llm/models") {
      res.writeHead(200, { "content-type": "application/json" })
      return res.end(JSON.stringify([TEST_MODEL]))
    }

    if (url === "/api/v1/auth/refresh") {
      state.refreshCalls += 1
      res.writeHead(200, { "content-type": "application/json" })
      return res.end(
        JSON.stringify({
          access_token: FRESH_TOKEN,
          refresh_token: REFRESH_TOKEN,
          token_type: "bearer"
        })
      )
    }

    if (url === "/api/v1/auth/login") {
      state.loginAuth = req.headers.authorization
        ? String(req.headers.authorization)
        : null
      state.loginApiKey = req.headers["x-api-key"]
        ? String(req.headers["x-api-key"])
        : null
      res.writeHead(200, { "content-type": "application/json" })
      return res.end(
        JSON.stringify({
          access_token: FRESH_TOKEN,
          refresh_token: REFRESH_TOKEN,
          token_type: "bearer"
        })
      )
    }

    if (url === "/api/v1/chat/completions") {
      const auth = req.headers.authorization
        ? String(req.headers.authorization)
        : ""
      state.streamAuths.push(auth)
      if (auth !== `Bearer ${FRESH_TOKEN}`) {
        res.writeHead(401, { "content-type": "text/plain" })
        return res.end("unauthorized")
      }
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive"
      })
      res.write('data: {"choices":[{"delta":{"content":"ok"}}]}\n\n')
      res.write("data: [DONE]\n\n")
      return res.end()
    }

    if (url === "/api/v1/protected") {
      const auth = req.headers.authorization
        ? String(req.headers.authorization)
        : ""
      state.requestAuths.push(auth)
      if (auth !== `Bearer ${FRESH_TOKEN}`) {
        res.writeHead(401, { "content-type": "text/plain" })
        return res.end("unauthorized")
      }
      res.writeHead(200, { "content-type": "application/json" })
      return res.end(JSON.stringify({ ok: true }))
    }

    res.writeHead(404)
    res.end("not found")
  })

  return { server, state }
}

function createHangingStreamServer() {
  const server = http.createServer((req, res) => {
    const url = (req.url || "").split("?")[0]

    if (url === "/api/v1/health") {
      res.writeHead(200, { "content-type": "application/json" })
      return res.end(JSON.stringify({ status: "ok" }))
    }

    if (url === "/api/v1/llm/models") {
      res.writeHead(200, { "content-type": "application/json" })
      return res.end(JSON.stringify([TEST_MODEL]))
    }

    if (url === "/api/v1/chat/completions") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive"
      })
      return
    }

    res.writeHead(404)
    res.end("not found")
  })

  return { server }
}

async function listen(server: http.Server) {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const addr = server.address() as AddressInfo
  return `http://127.0.0.1:${addr.port}`
}

async function close(server: http.Server) {
  await new Promise<void>((resolve) => server.close(() => resolve()))
}

test.describe("Auth refresh + streaming", () => {
  test("refreshes multi-user stream after 401", async () => {
    const { server, state } = createAuthRefreshServer()
    const url = await listen(server)

    const { context, page } = await launchWithExtension(EXT_PATH, {
      seedConfig: {
        tldwConfig: {
          serverUrl: url,
          authMode: "multi-user",
          accessToken: EXPIRED_TOKEN,
          refreshToken: REFRESH_TOKEN
        },
        __tldw_allow_offline: true
      }
    })

    try {
      const events = await page.evaluate(async () => {
        const port = chrome.runtime.connect({ name: "tldw:stream" })
        const received: any[] = []

        return await new Promise<any[]>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error("stream timeout"))
          }, 10000)

          port.onMessage.addListener((msg) => {
            received.push(msg)
            if (msg?.event === "done" || msg?.event === "error") {
              clearTimeout(timeout)
              resolve(received)
            }
          })

          port.postMessage({
            path: "/api/v1/chat/completions",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: {
              model: "test",
              stream: true,
              messages: [{ role: "user", content: "hello" }]
            },
            streamIdleTimeoutMs: 8000
          })
        })
      })

      expect(events.some((e) => e?.event === "data")).toBe(true)
      expect(events[events.length - 1]?.event).toBe("done")
      expect(state.streamAuths).toEqual([
        `Bearer ${EXPIRED_TOKEN}`,
        `Bearer ${FRESH_TOKEN}`
      ])
    } finally {
      await context.close()
      await close(server)
    }
  })

  test("retries requests with refreshed token instead of stale headers", async () => {
    const { server, state } = createAuthRefreshServer()
    const url = await listen(server)

    const { context, page } = await launchWithExtension(EXT_PATH, {
      seedConfig: {
        tldwConfig: {
          serverUrl: url,
          authMode: "multi-user",
          accessToken: EXPIRED_TOKEN,
          refreshToken: REFRESH_TOKEN
        },
        __tldw_allow_offline: true
      }
    })

    try {
      const resp = await page.evaluate(async () => {
        return await chrome.runtime.sendMessage({
          type: "tldw:request",
          payload: {
            path: "/api/v1/protected",
            method: "GET",
            headers: {
              Authorization: "Bearer stale-token"
            }
          }
        })
      })

      expect(resp?.ok).toBe(true)
      expect(state.requestAuths).toEqual([
        `Bearer ${EXPIRED_TOKEN}`,
        `Bearer ${FRESH_TOKEN}`
      ])
    } finally {
      await context.close()
      await close(server)
    }
  })

  test("login requests omit auth headers", async () => {
    const { server, state } = createAuthRefreshServer()
    const url = await listen(server)

    const { context, page, optionsUrl } = await launchWithExtension(EXT_PATH, {
      seedConfig: {
        tldwConfig: {
          serverUrl: url,
          authMode: "multi-user",
          accessToken: "stale-login-token",
          refreshToken: REFRESH_TOKEN
        },
        __tldw_allow_offline: true
      }
    })

    try {
      await page.goto(optionsUrl + "#/settings/tldw", {
        waitUntil: "domcontentloaded"
      })

      await page.getByLabel(/Username/i).fill("alice")
      await page.getByLabel(/^Password$/i).fill("pass")
      await page.getByRole("button", { name: /Login/i }).click()

      await expect(
        page.getByText(/Logged In/i)
      ).toBeVisible({ timeout: 10000 })

      expect(state.loginAuth).toBeNull()
      expect(state.loginApiKey).toBeNull()
    } finally {
      await context.close()
      await close(server)
    }
  })
})

test.describe("Stream abort", () => {
  test("stop streaming aborts a stalled stream", async () => {
    const { server } = createHangingStreamServer()
    const url = await listen(server)

    const { context, page } = await launchWithExtension(EXT_PATH, {
      seedConfig: {
        tldwConfig: {
          serverUrl: url,
          authMode: "single-user",
          apiKey: "any",
          chatStreamIdleTimeoutMs: 30000
        },
        selectedModel: TEST_MODEL,
        __tldw_allow_offline: true
      }
    })

    try {
      const input = page.getByPlaceholder("Type a message...")
      await expect(input).toBeVisible({ timeout: 10000 })
      await input.fill("stream then stop")
      await input.press("Enter")

      const stopButton = page.getByRole("button", {
        name: /Stop streaming/i
      })
      await expect(stopButton).toBeVisible({ timeout: 10000 })
      await stopButton.click()
      await expect(stopButton).toBeHidden({ timeout: 10000 })
    } finally {
      await context.close()
      await close(server)
    }
  })
})
