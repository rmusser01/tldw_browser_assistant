const USER_PLACEHOLDER_REGEX =
  /\{\{\s*(user|username|user_name|you|me|char|character)\s*\}\}/gi

export const replaceUserDisplayNamePlaceholders = (
  content: string,
  userDisplayName: string
): string => {
  const name = userDisplayName.trim()
  if (!content || !name) return content
  return content.replace(USER_PLACEHOLDER_REGEX, name)
}
