import type { AllowedPath, PathOrUrl } from "@/services/tldw/openapi-guard"

export const toAllowedPath = (path: string): AllowedPath => path as AllowedPath

export const appendPathQuery = (
  path: AllowedPath,
  query: string
): AllowedPath => (query ? (`${path}${query}` as AllowedPath) : path)

export const appendUrlQuery = (path: PathOrUrl, query: string): PathOrUrl =>
  query ? (`${path}${query}` as PathOrUrl) : path
