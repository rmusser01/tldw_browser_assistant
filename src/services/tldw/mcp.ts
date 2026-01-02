import { bgRequestClient } from "@/services/background-proxy"

export type McpToolTier = "read" | "write" | "exec" | string

export type McpToolDefinition = {
  name?: string
  description?: string | null
  parameters?: Record<string, unknown>
  input_schema?: Record<string, unknown>
  json_schema?: Record<string, unknown>
  tier?: McpToolTier
  [key: string]: unknown
}

export const fetchMcpTools = async (): Promise<McpToolDefinition[]> => {
  try {
    const res = await bgRequestClient<any>({
      path: "/api/v1/mcp/tools",
      method: "GET"
    })
    if (!res) return []
    if (Array.isArray(res)) return res
    if (Array.isArray(res.tools)) return res.tools
    if (Array.isArray(res.data)) return res.data
    return []
  } catch {
    return []
  }
}

export const executeMcpTool = async (
  payload: Record<string, unknown>
): Promise<Record<string, unknown>> => {
  return await bgRequestClient<Record<string, unknown>>({
    path: "/api/v1/mcp/tools/execute",
    method: "POST",
    body: payload
  })
}
