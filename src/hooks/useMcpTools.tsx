import React from "react"
import { useQuery } from "@tanstack/react-query"
import { apiSend } from "@/services/api-send"
import { useServerCapabilities } from "@/hooks/useServerCapabilities"
import { fetchMcpTools, type McpToolDefinition } from "@/services/tldw/mcp"
import { useMcpToolsStore, type McpHealthState } from "@/store/mcp-tools"

type McpToolsStatus = {
  hasMcp: boolean
  healthState: McpHealthState
  healthLoading: boolean
  tools: McpToolDefinition[]
  toolsLoading: boolean
  toolsAvailable: boolean | null
}

export const useMcpTools = (): McpToolsStatus => {
  const { capabilities, loading } = useServerCapabilities()
  const hasMcp = Boolean(capabilities?.hasMcp) && !loading
  const setTools = useMcpToolsStore((state) => state.setTools)
  const setHealthState = useMcpToolsStore((state) => state.setHealthState)
  const setToolsLoading = useMcpToolsStore((state) => state.setToolsLoading)

  const healthQuery = useQuery({
    queryKey: ["mcp-health"],
    queryFn: async () => apiSend({ path: "/api/v1/mcp/health", method: "GET" }),
    enabled: hasMcp,
    staleTime: 60_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: false
  })

  let healthState: McpHealthState = "unknown"
  if (!hasMcp) {
    healthState = loading ? "unknown" : "unavailable"
  } else if (healthQuery.isLoading) {
    healthState = "unknown"
  } else if (healthQuery.data?.ok) {
    healthState = "healthy"
  } else if (healthQuery.data?.status === 404) {
    healthState = "unknown"
  } else {
    healthState = "unhealthy"
  }

  const toolsQuery = useQuery({
    queryKey: ["mcp-tools"],
    queryFn: fetchMcpTools,
    enabled: hasMcp,
    staleTime: 60_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: false
  })

  const tools = toolsQuery.data ?? []
  const toolsAvailable = toolsQuery.isLoading ? null : tools.length > 0

  React.useEffect(() => {
    setHealthState(healthState)
  }, [healthState, setHealthState])

  React.useEffect(() => {
    if (!hasMcp && !loading) {
      setTools([])
      setToolsLoading(false)
      return
    }
    setToolsLoading(toolsQuery.isLoading)
    if (!toolsQuery.isLoading) {
      setTools(tools)
    }
  }, [hasMcp, loading, setTools, setToolsLoading, tools, toolsQuery.isLoading])

  return {
    hasMcp,
    healthState,
    healthLoading: healthQuery.isLoading,
    tools,
    toolsLoading: toolsQuery.isLoading,
    toolsAvailable
  }
}
