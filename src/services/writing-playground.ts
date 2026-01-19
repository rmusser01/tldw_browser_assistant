import { bgRequest } from "@/services/background-proxy"
import { createResourceClient } from "@/services/resource-client"
import type { AllowedPath } from "@/services/tldw/openapi-guard"

const sessionsClient = createResourceClient({
  basePath: "/api/v1/writing/sessions" as AllowedPath
})

const templatesClient = createResourceClient({
  basePath: "/api/v1/writing/templates" as AllowedPath,
  detailPath: (name) =>
    `/api/v1/writing/templates/${encodeURIComponent(String(name))}` as AllowedPath
})

const themesClient = createResourceClient({
  basePath: "/api/v1/writing/themes" as AllowedPath,
  detailPath: (name) =>
    `/api/v1/writing/themes/${encodeURIComponent(String(name))}` as AllowedPath
})

export type WritingVersionResponse = {
  version: number
}

export type WritingCapabilities = Record<string, unknown>

export type WritingSessionSummary = {
  id: string
  name: string
  updated_at?: string | null
}

export type WritingSession = {
  id: string
  name: string
  payload_json: unknown
  schema_version: number
  version?: number | null
  version_parent_id?: string | null
  created_at?: string | null
  updated_at?: string | null
  deleted_at?: string | null
}

export type WritingSessionCreate = {
  name?: string | null
  payload_json?: unknown
  schema_version?: number | null
}

export type WritingSessionUpdate = {
  name?: string | null
  payload_json?: unknown
  schema_version?: number | null
  expected_version?: number | null
}

export type WritingTemplate = {
  name: string
  payload_json: unknown
  schema_version: number
  version?: number | null
  version_parent_id?: string | null
  is_default?: boolean | null
  updated_at?: string | null
  deleted_at?: string | null
}

export type WritingTemplateCreate = {
  name: string
  payload_json?: unknown
  schema_version?: number | null
  is_default?: boolean | null
}

export type WritingTemplateUpdate = {
  payload_json?: unknown
  schema_version?: number | null
  is_default?: boolean | null
  expected_version?: number | null
}

export type WritingTheme = {
  name: string
  class_name: string
  css: string
  schema_version: number
  version?: number | null
  version_parent_id?: string | null
  is_default?: boolean | null
  order?: number | null
  updated_at?: string | null
  deleted_at?: string | null
}

export type WritingThemeCreate = {
  name: string
  class_name: string
  css: string
  schema_version?: number | null
  is_default?: boolean | null
  order?: number | null
}

export type WritingThemeUpdate = {
  class_name?: string | null
  css?: string | null
  schema_version?: number | null
  is_default?: boolean | null
  order?: number | null
  expected_version?: number | null
}

export type WritingTokenizeRequest = {
  provider: string
  model: string
  text: string
  options?: {
    include_strings?: boolean
  }
}

export type WritingTokenizeResponse = {
  ids: number[]
  strings?: string[]
  meta?: Record<string, unknown>
}

export type WritingTokenCountRequest = {
  provider: string
  model: string
  text: string
}

export type WritingTokenCountResponse = {
  count: number
  meta?: Record<string, unknown>
}

const normalizeListResponse = <T>(input: T[] | { items: T[] } | null | undefined): T[] => {
  if (!input) return []
  return Array.isArray(input) ? input : input.items ?? []
}

export async function getWritingVersion(): Promise<WritingVersionResponse> {
  return await bgRequest<WritingVersionResponse>({
    path: "/api/v1/writing/version",
    method: "GET"
  })
}

export async function getWritingCapabilities(): Promise<WritingCapabilities> {
  return await bgRequest<WritingCapabilities>({
    path: "/api/v1/writing/capabilities",
    method: "GET"
  })
}

export async function listWritingSessions(): Promise<WritingSessionSummary[]> {
  const response = await sessionsClient.list<WritingSessionSummary[] | { items: WritingSessionSummary[] }>()
  return normalizeListResponse(response)
}

export async function createWritingSession(
  input?: WritingSessionCreate
): Promise<WritingSession> {
  return await sessionsClient.create<WritingSession>(input)
}

export async function getWritingSession(id: string): Promise<WritingSession> {
  return await sessionsClient.get<WritingSession>(id)
}

export async function updateWritingSession(
  id: string,
  input: WritingSessionUpdate
): Promise<WritingSession> {
  return await sessionsClient.update<WritingSession>(id, input)
}

export async function deleteWritingSession(id: string): Promise<void> {
  await sessionsClient.remove<void>(id)
}

export async function cloneWritingSession(id: string): Promise<WritingSession> {
  return await bgRequest<WritingSession>({
    path: `/api/v1/writing/sessions/${encodeURIComponent(id)}/clone` as AllowedPath,
    method: "POST"
  })
}

export async function listWritingTemplates(): Promise<WritingTemplate[]> {
  const response = await templatesClient.list<WritingTemplate[] | { items: WritingTemplate[] }>()
  return normalizeListResponse(response)
}

export async function createWritingTemplate(
  input: WritingTemplateCreate
): Promise<WritingTemplate> {
  return await templatesClient.create<WritingTemplate>(input)
}

export async function getWritingTemplate(name: string): Promise<WritingTemplate> {
  return await templatesClient.get<WritingTemplate>(name)
}

export async function updateWritingTemplate(
  name: string,
  input: WritingTemplateUpdate
): Promise<WritingTemplate> {
  return await templatesClient.update<WritingTemplate>(name, input)
}

export async function deleteWritingTemplate(name: string): Promise<void> {
  await templatesClient.remove<void>(name)
}

export async function listWritingThemes(): Promise<WritingTheme[]> {
  const response = await themesClient.list<WritingTheme[] | { items: WritingTheme[] }>()
  return normalizeListResponse(response)
}

export async function createWritingTheme(input: WritingThemeCreate): Promise<WritingTheme> {
  return await themesClient.create<WritingTheme>(input)
}

export async function getWritingTheme(name: string): Promise<WritingTheme> {
  return await themesClient.get<WritingTheme>(name)
}

export async function updateWritingTheme(
  name: string,
  input: WritingThemeUpdate
): Promise<WritingTheme> {
  return await themesClient.update<WritingTheme>(name, input)
}

export async function deleteWritingTheme(name: string): Promise<void> {
  await themesClient.remove<void>(name)
}

export async function tokenizeWritingText(
  input: WritingTokenizeRequest
): Promise<WritingTokenizeResponse> {
  return await bgRequest<WritingTokenizeResponse>({
    path: "/api/v1/writing/tokenize",
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: input
  })
}

export async function countWritingTokens(
  input: WritingTokenCountRequest
): Promise<WritingTokenCountResponse> {
  return await bgRequest<WritingTokenCountResponse>({
    path: "/api/v1/writing/token-count",
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: input
  })
}
