export type CharacterGreetingFields = {
  greeting?: unknown
  first_message?: unknown
  firstMessage?: unknown
  greet?: unknown
  alternate_greetings?: unknown
  alternateGreetings?: unknown
}

export const normalizeGreetingValue = (value: unknown): string[] => {
  if (!value) return []
  if (Array.isArray(value)) {
    return value
      .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
      .filter((entry) => entry.length > 0)
  }
  if (typeof value === "string") {
    const trimmed = value.trim()
    return trimmed.length > 0 ? [trimmed] : []
  }
  return []
}

export const collectGreetings = (
  character: CharacterGreetingFields | null | undefined
): string[] => {
  const greetings = [
    ...normalizeGreetingValue(character?.greeting),
    ...normalizeGreetingValue(character?.first_message),
    ...normalizeGreetingValue(character?.firstMessage),
    ...normalizeGreetingValue(character?.greet),
    ...normalizeGreetingValue(character?.alternate_greetings),
    ...normalizeGreetingValue(character?.alternateGreetings)
  ]
  return Array.from(new Set(greetings))
}

export const pickGreeting = (greetings: string[]): string => {
  if (greetings.length === 0) return ""
  if (greetings.length === 1) return greetings[0]
  const index = Math.floor(Math.random() * greetings.length)
  return greetings[index]
}
