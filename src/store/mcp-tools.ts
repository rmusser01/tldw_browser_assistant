import { createWithEqualityFn } from "zustand/traditional"
import type { McpToolDefinition } from "@/services/tldw/mcp"

export type McpHealthState =
  | "unknown"
  | "healthy"
  | "unhealthy"
  | "unavailable"

type McpToolsState = {
  tools: McpToolDefinition[]
  healthState: McpHealthState
  toolsLoading: boolean
  setTools: (tools: McpToolDefinition[]) => void
  setHealthState: (state: McpHealthState) => void
  setToolsLoading: (loading: boolean) => void
}

export const useMcpToolsStore = createWithEqualityFn<McpToolsState>((set) => ({
  tools: [],
  healthState: "unknown",
  toolsLoading: false,
  setTools: (tools) => set({ tools }),
  setHealthState: (healthState) => set({ healthState }),
  setToolsLoading: (toolsLoading) => set({ toolsLoading })
}))
