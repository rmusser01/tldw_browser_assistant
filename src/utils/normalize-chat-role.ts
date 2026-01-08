export type NormalizedChatRole = "assistant" | "user" | "system"

export const normalizeChatRole = (
  input: unknown,
  fallback: NormalizedChatRole = "user"
): NormalizedChatRole => {
  if (typeof input !== "string") return fallback
  const value = input.trim().toLowerCase()
  if (!value) return fallback
  if (
    value === "assistant" ||
    value === "ai" ||
    value === "bot" ||
    value === "model" ||
    value === "tool" ||
    value === "function" ||
    value.startsWith("assistant")
  ) {
    return "assistant"
  }
  if (value === "system" || value.startsWith("system")) return "system"
  if (value === "user" || value === "human" || value.startsWith("user")) {
    return "user"
  }
  return fallback
}
