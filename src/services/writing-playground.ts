import { bgRequest } from "@/services/background-proxy"
import { buildQuery, createResourceClient } from "@/services/resource-client"
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

export type WritingServerCapabilities = {
  sessions: boolean
  templates: boolean
  themes: boolean
  tokenize: boolean
  token_count: boolean
}

export type WritingTokenizerSupport = {
  available: boolean
  tokenizer?: string | null
  error?: string | null
}

export type WritingProviderCapabilities = {
  name: string
  models: string[]
  capabilities: Record<string, unknown>
  supported_fields: string[]
  features: Record<string, boolean>
  tokenizers?: Record<string, WritingTokenizerSupport>
}

export type WritingRequestedCapabilities = {
  provider: string
  model?: string | null
  supported_fields: string[]
  features: Record<string, boolean>
  tokenizer_available: boolean
  tokenizer?: string | null
  tokenization_error?: string | null
}

export type WritingCapabilitiesResponse = {
  version: number
  server: WritingServerCapabilities
  default_provider?: string | null
  providers?: WritingProviderCapabilities[]
  requested?: WritingRequestedCapabilities
}

export type WritingSessionListItem = {
  id: string
  name: string
  last_modified: string
  version: number
}

export type WritingSessionListResponse = {
  sessions: WritingSessionListItem[]
  total: number
}

export type WritingSessionResponse = {
  id: string
  name: string
  payload: Record<string, unknown>
  schema_version: number
  version_parent_id?: string | null
  created_at: string
  last_modified: string
  deleted: boolean
  client_id: string
  version: number
}

export type WritingSessionCreate = {
  name: string
  payload: Record<string, unknown>
  schema_version?: number | null
  id?: string | null
  version_parent_id?: string | null
}

export type WritingSessionUpdate = {
  name?: string | null
  payload?: Record<string, unknown> | null
  schema_version?: number | null
  version_parent_id?: string | null
}

export type WritingTemplateResponse = {
  id: number
  name: string
  payload: Record<string, unknown>
  schema_version: number
  version_parent_id?: string | null
  is_default: boolean
  created_at: string
  last_modified: string
  deleted: boolean
  client_id: string
  version: number
}

export type WritingTemplateListResponse = {
  templates: WritingTemplateResponse[]
  total: number
}

export type WritingTemplateCreate = {
  name: string
  payload: Record<string, unknown>
  schema_version?: number | null
  version_parent_id?: string | null
  is_default?: boolean | null
}

export type WritingTemplateUpdate = {
  name?: string | null
  payload?: Record<string, unknown> | null
  schema_version?: number | null
  version_parent_id?: string | null
  is_default?: boolean | null
}

export type WritingThemeResponse = {
  id: number
  name: string
  class_name?: string | null
  css?: string | null
  schema_version: number
  version_parent_id?: string | null
  is_default: boolean
  order: number
  created_at: string
  last_modified: string
  deleted: boolean
  client_id: string
  version: number
}

export type WritingThemeListResponse = {
  themes: WritingThemeResponse[]
  total: number
}

export type WritingThemeCreate = {
  name: string
  class_name?: string | null
  css?: string | null
  schema_version?: number | null
  version_parent_id?: string | null
  is_default?: boolean | null
  order?: number | null
}

export type WritingThemeUpdate = {
  name?: string | null
  class_name?: string | null
  css?: string | null
  schema_version?: number | null
  version_parent_id?: string | null
  is_default?: boolean | null
  order?: number | null
}

export type WritingTokenizeOptions = {
  include_strings?: boolean
}

export type WritingTokenizeRequest = {
  provider: string
  model: string
  text: string
  options?: WritingTokenizeOptions
}

export type WritingTokenizeMeta = {
  provider: string
  model: string
  tokenizer: string
  input_chars: number
  token_count: number
  warnings: string[]
}

export type WritingTokenizeResponse = {
  ids: number[]
  strings?: string[]
  meta: WritingTokenizeMeta
}

export type WritingTokenCountRequest = {
  provider: string
  model: string
  text: string
}

export type WritingTokenCountResponse = {
  count: number
  meta: WritingTokenizeMeta
}

type WritingCapabilitiesQuery = {
  provider?: string
  model?: string
  includeProviders?: boolean
  includeDeprecated?: boolean
}

const buildExpectedVersionHeaders = (expectedVersion: number) => ({
  "expected-version": String(expectedVersion)
})

export async function getWritingVersion(): Promise<WritingVersionResponse> {
  return await bgRequest<WritingVersionResponse>({
    path: "/api/v1/writing/version",
    method: "GET"
  })
}

export async function getWritingCapabilities(
  options: WritingCapabilitiesQuery = {}
): Promise<WritingCapabilitiesResponse> {
  const query = buildQuery({
    provider: options.provider,
    model: options.model,
    include_providers: options.includeProviders ?? false,
    include_deprecated: options.includeDeprecated ?? false
  })
  const path = `/api/v1/writing/capabilities${query}` as AllowedPath
  return await bgRequest<WritingCapabilitiesResponse>({
    path,
    method: "GET"
  })
}

export async function listWritingSessions(params?: {
  limit?: number
  offset?: number
}): Promise<WritingSessionListResponse> {
  return await sessionsClient.list<WritingSessionListResponse>({
    limit: params?.limit,
    offset: params?.offset
  })
}

export async function createWritingSession(
  input: WritingSessionCreate
): Promise<WritingSessionResponse> {
  return await sessionsClient.create<WritingSessionResponse>(input)
}

export async function getWritingSession(id: string): Promise<WritingSessionResponse> {
  return await sessionsClient.get<WritingSessionResponse>(id)
}

export async function updateWritingSession(
  id: string,
  input: WritingSessionUpdate,
  expectedVersion: number
): Promise<WritingSessionResponse> {
  return await sessionsClient.update<WritingSessionResponse>(id, input, {
    headers: buildExpectedVersionHeaders(expectedVersion)
  })
}

export async function deleteWritingSession(
  id: string,
  expectedVersion: number
): Promise<void> {
  await sessionsClient.remove<void>(id, undefined, {
    headers: buildExpectedVersionHeaders(expectedVersion)
  })
}

export async function cloneWritingSession(
  id: string,
  name?: string
): Promise<WritingSessionResponse> {
  return await bgRequest<WritingSessionResponse>({
    path: `/api/v1/writing/sessions/${encodeURIComponent(id)}/clone` as AllowedPath,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: name ? { name } : {}
  })
}

export async function listWritingTemplates(params?: {
  limit?: number
  offset?: number
}): Promise<WritingTemplateListResponse> {
  return await templatesClient.list<WritingTemplateListResponse>({
    limit: params?.limit,
    offset: params?.offset
  })
}

export async function createWritingTemplate(
  input: WritingTemplateCreate
): Promise<WritingTemplateResponse> {
  return await templatesClient.create<WritingTemplateResponse>(input)
}

export async function getWritingTemplate(
  name: string
): Promise<WritingTemplateResponse> {
  return await templatesClient.get<WritingTemplateResponse>(name)
}

export async function updateWritingTemplate(
  name: string,
  input: WritingTemplateUpdate,
  expectedVersion: number
): Promise<WritingTemplateResponse> {
  return await templatesClient.update<WritingTemplateResponse>(name, input, {
    headers: buildExpectedVersionHeaders(expectedVersion)
  })
}

export async function deleteWritingTemplate(
  name: string,
  expectedVersion: number
): Promise<void> {
  await templatesClient.remove<void>(name, undefined, {
    headers: buildExpectedVersionHeaders(expectedVersion)
  })
}

export async function listWritingThemes(params?: {
  limit?: number
  offset?: number
}): Promise<WritingThemeListResponse> {
  return await themesClient.list<WritingThemeListResponse>({
    limit: params?.limit,
    offset: params?.offset
  })
}

export async function createWritingTheme(
  input: WritingThemeCreate
): Promise<WritingThemeResponse> {
  return await themesClient.create<WritingThemeResponse>(input)
}

export async function getWritingTheme(name: string): Promise<WritingThemeResponse> {
  return await themesClient.get<WritingThemeResponse>(name)
}

export async function updateWritingTheme(
  name: string,
  input: WritingThemeUpdate,
  expectedVersion: number
): Promise<WritingThemeResponse> {
  return await themesClient.update<WritingThemeResponse>(name, input, {
    headers: buildExpectedVersionHeaders(expectedVersion)
  })
}

export async function deleteWritingTheme(
  name: string,
  expectedVersion: number
): Promise<void> {
  await themesClient.remove<void>(name, undefined, {
    headers: buildExpectedVersionHeaders(expectedVersion)
  })
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
