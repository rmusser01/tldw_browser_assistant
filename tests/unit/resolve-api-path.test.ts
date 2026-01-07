import { describe, expect, test } from "bun:test"

const ensureExtensionRuntime = () => {
  if ((globalThis as any).chrome?.runtime?.id) return
  ;(globalThis as any).chrome = { runtime: { id: "test-runtime" } }
}

const loadClient = async () => {
  ensureExtensionRuntime()
  const mod = await import("../../src/services/tldw/TldwApiClient")
  return mod.TldwApiClient
}

const setOpenApiPaths = (client: any, paths: string[]) => {
  client.openApiPathSet = new Set(paths)
  client.openApiPathSetPromise = null
  client.resolvedPathCache = new Map()
}

const resolveApiPath = (client: any, key: string, candidates: string[]) =>
  client.resolveApiPath(key, candidates) as Promise<string>

describe("TldwApiClient.resolveApiPath", () => {
  test("prefers exact OpenAPI matches", async () => {
    const TldwApiClient = await loadClient()
    const client = new TldwApiClient()
    setOpenApiPaths(client, ["/api/v1/prompts/"])
    const resolved = await resolveApiPath(client, "prompts.list", [
      "/api/v1/prompts",
      "/api/v1/prompts/"
    ])
    expect(resolved).toBe("/api/v1/prompts/")
  })

  test("matches OpenAPI path shapes", async () => {
    const TldwApiClient = await loadClient()
    const client = new TldwApiClient()
    setOpenApiPaths(client, ["/api/v1/characters/{character_id}"])
    const resolved = await resolveApiPath(client, "characters.get", [
      "/api/v1/characters/{id}",
      "/api/v1/characters/"
    ])
    expect(resolved).toBe("/api/v1/characters/{id}")
  })

  test("falls back to the first candidate without OpenAPI paths", async () => {
    const TldwApiClient = await loadClient()
    const client = new TldwApiClient()
    setOpenApiPaths(client, [])
    const resolved = await resolveApiPath(client, "fallback", [
      "/api/v1/unknown",
      "/api/v1/unknown/"
    ])
    expect(resolved).toBe("/api/v1/unknown")
  })
})
