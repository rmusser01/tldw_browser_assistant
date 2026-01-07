type CharacterImportResult = {
  payload: Record<string, any>
  imageBase64?: string
}

const isRecord = (value: unknown): value is Record<string, any> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const readFileAsText = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result)
      } else {
        reject(new Error("Invalid file contents"))
      }
    }
    reader.onerror = () => reject(reader.error || new Error("Failed to read file"))
    reader.readAsText(file)
  })

const readFileAsArrayBuffer = (file: File): Promise<ArrayBuffer> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(reader.result)
      } else {
        reject(new Error("Invalid file contents"))
      }
    }
    reader.onerror = () => reject(reader.error || new Error("Failed to read file"))
    reader.readAsArrayBuffer(file)
  })

const readFileAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result)
      } else {
        reject(new Error("Invalid file contents"))
      }
    }
    reader.onerror = () => reject(reader.error || new Error("Failed to read file"))
    reader.readAsDataURL(file)
  })

const parseJson = (value: string): Record<string, any> | null => {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

const decodeBase64Text = (value: string): string | null => {
  try {
    const cleaned = value.trim().replace(/\s+/g, "")
    let bytes: Uint8Array | null = null

    if (typeof atob === "function") {
      const binary = atob(cleaned)
      bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i)
      }
    } else if (typeof Buffer !== "undefined") {
      bytes = Uint8Array.from(Buffer.from(cleaned, "base64"))
    }

    if (!bytes) return null
    return new TextDecoder().decode(bytes)
  } catch {
    return null
  }
}

const getStringValue = (source: Record<string, any>, keys: string[]) => {
  for (const key of keys) {
    const value = source[key]
    if (value === undefined || value === null) continue
    if (typeof value === "string") {
      const trimmed = value.trim()
      if (trimmed) return trimmed
      continue
    }
    return String(value)
  }
  return ""
}

const getArrayValue = (source: Record<string, any>, keys: string[]) => {
  for (const key of keys) {
    const value = source[key]
    if (!value) continue
    if (Array.isArray(value)) {
      return value.map((item) => String(item).trim()).filter(Boolean)
    }
    if (typeof value === "string") {
      return value
        .split(/[,;\n]+/)
        .map((item) => item.trim())
        .filter(Boolean)
    }
  }
  return []
}

const resolveCharacterSource = (input: Record<string, any>) => {
  if (isRecord(input.data)) return input.data
  if (isRecord(input.character)) return input.character
  return input
}

const buildPayloadFromCard = (input: Record<string, any>) => {
  const source = resolveCharacterSource(input)
  const payload: Record<string, any> = {}

  const name = getStringValue(source, [
    "name",
    "char_name",
    "title",
    "character_name"
  ])
  if (!name) {
    throw new Error("Character card is missing a name.")
  }
  payload.name = name

  const description = getStringValue(source, ["description", "desc"])
  if (description) payload.description = description

  const personality = getStringValue(source, ["personality"])
  if (personality) payload.personality = personality

  const scenario = getStringValue(source, ["scenario"])
  if (scenario) payload.scenario = scenario

  const systemPrompt = getStringValue(source, [
    "system_prompt",
    "systemPrompt",
    "instructions"
  ])
  if (systemPrompt) payload.system_prompt = systemPrompt

  const postHistory = getStringValue(source, [
    "post_history_instructions",
    "postHistoryInstructions"
  ])
  if (postHistory) payload.post_history_instructions = postHistory

  const greeting = getStringValue(source, [
    "first_message",
    "first_mes",
    "greeting"
  ])
  if (greeting) payload.first_message = greeting

  const messageExample = getStringValue(source, [
    "message_example",
    "mes_example",
    "example_dialogue"
  ])
  if (messageExample) payload.message_example = messageExample

  const creatorNotes = getStringValue(source, ["creator_notes"])
  if (creatorNotes) payload.creator_notes = creatorNotes

  const creator = getStringValue(source, ["creator", "creatorName"])
  if (creator) payload.creator = creator

  const characterVersion = getStringValue(source, [
    "character_version",
    "characterVersion",
    "version"
  ])
  if (characterVersion) payload.character_version = characterVersion

  const tags = getArrayValue(source, ["tags", "tag"])
  if (tags.length > 0) payload.tags = tags

  const alternateGreetings = getArrayValue(source, [
    "alternate_greetings",
    "alternateGreetings",
    "alt_greetings"
  ])
  if (alternateGreetings.length > 0) {
    payload.alternate_greetings = alternateGreetings
  }

  const extensions =
    source.extensions ?? source.extension ?? source.metadata ?? undefined
  if (extensions) {
    payload.extensions = extensions
  }

  if (source.avatar_url) payload.avatar_url = source.avatar_url
  if (source.image_base64) payload.image_base64 = source.image_base64

  return payload
}

const parseCharacterCardText = (keyword: string, text: string) => {
  const normalizedKeyword = keyword.toLowerCase()
  if (!normalizedKeyword.includes("chara") && !normalizedKeyword.includes("character")) {
    return null
  }

  const direct = parseJson(text)
  if (direct) return direct

  const decoded = decodeBase64Text(text)
  if (!decoded) return null

  return parseJson(decoded)
}

const extractCharacterFromPng = (bytes: Uint8Array) => {
  if (
    bytes.length < 8 ||
    bytes[0] !== 0x89 ||
    bytes[1] !== 0x50 ||
    bytes[2] !== 0x4e ||
    bytes[3] !== 0x47
  ) {
    return null
  }

  const latin1Decoder = new TextDecoder("latin1")
  const utf8Decoder = new TextDecoder()

  const readUint32 = (offset: number) =>
    ((bytes[offset] << 24) |
      (bytes[offset + 1] << 16) |
      (bytes[offset + 2] << 8) |
      bytes[offset + 3]) >>> 0

  let offset = 8
  while (offset + 8 <= bytes.length) {
    const length = readUint32(offset)
    offset += 4
    const type = String.fromCharCode(
      bytes[offset],
      bytes[offset + 1],
      bytes[offset + 2],
      bytes[offset + 3]
    )
    offset += 4
    if (offset + length > bytes.length) break
    const data = bytes.slice(offset, offset + length)
    offset += length + 4

    if (type === "tEXt") {
      const decoded = latin1Decoder.decode(data)
      const split = decoded.indexOf("\u0000")
      if (split === -1) continue
      const keyword = decoded.slice(0, split)
      const text = decoded.slice(split + 1)
      const parsed = parseCharacterCardText(keyword, text)
      if (parsed) return parsed
    }

    if (type === "iTXt") {
      const keywordEnd = data.indexOf(0)
      if (keywordEnd <= 0) continue
      const keyword = latin1Decoder.decode(data.slice(0, keywordEnd))
      const compressionFlag = data[keywordEnd + 1]
      const compressionMethod = data[keywordEnd + 2]
      if (compressionMethod !== 0 || compressionFlag !== 0) continue

      let cursor = keywordEnd + 3
      const languageEnd = data.indexOf(0, cursor)
      if (languageEnd === -1) continue
      cursor = languageEnd + 1
      const translatedEnd = data.indexOf(0, cursor)
      if (translatedEnd === -1) continue
      cursor = translatedEnd + 1
      const text = utf8Decoder.decode(data.slice(cursor))
      const parsed = parseCharacterCardText(keyword, text)
      if (parsed) return parsed
    }
  }

  return null
}

const extractBase64FromDataUrl = (value: string) => {
  const match = value.match(/^data:.*;base64,(.+)$/)
  return match?.[1] || ""
}

export const parseCharacterCardFile = async (
  file: File
): Promise<CharacterImportResult> => {
  const lowerName = file.name.toLowerCase()
  const isJson = file.type === "application/json" || lowerName.endsWith(".json")
  const isPng = file.type === "image/png" || lowerName.endsWith(".png")

  if (isJson) {
    const text = await readFileAsText(file)
    const parsed = parseJson(text)
    if (!parsed) {
      throw new Error("Invalid JSON character card.")
    }
    return { payload: buildPayloadFromCard(parsed) }
  }

  if (isPng) {
    const buffer = await readFileAsArrayBuffer(file)
    const parsed = extractCharacterFromPng(new Uint8Array(buffer))
    if (!parsed) {
      throw new Error("No character data found in the PNG file.")
    }
    const payload = buildPayloadFromCard(parsed)
    const dataUrl = await readFileAsDataUrl(file)
    const imageBase64 = extractBase64FromDataUrl(dataUrl)
    return {
      payload,
      imageBase64: imageBase64 || undefined
    }
  }

  throw new Error("Unsupported file type. Import a JSON or PNG character card.")
}
