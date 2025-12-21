export type ContentReviewTemplate = {
  id: string
  label: string
  description: string
  outputFormat: "plain" | "markdown"
  systemPrompt: string
  instruction: string
}

// Shared prompt building blocks for content-editing of ingested material (mixed content safe)
const baseRules = [
  // Output discipline
  "Output only the revised transcript text. Do not include commentary, explanations, code fences, JSON, or wrappers.",

  // Fidelity
  "Do not summarize, paraphrase, rewrite, or change meaning.",
  "Do not reorder content.",
  "Do not add or remove non-whitespace characters unless explicitly allowed by the template.",

  // Immutable tokens: labels/timestamps
  "Speaker labels and timestamps are immutable tokens: do not change them in any way (spelling, casing, punctuation, spacing, or format). Copy them exactly as provided.",

  // Immutable tokens: mixed content
  "Treat the following as immutable tokens and copy them exactly as provided: bracketed tags (e.g., [laughter], [crosstalk], [inaudible]), parenthetical stage directions (e.g., (laughs), (phone rings)), inline metadata markers, URLs, email addresses, file paths, and anything that looks like code/config (e.g., JSON, YAML, CLI flags).",

  // Over-editing guardrail
  "If a change is not clearly justified as a transcription punctuation/casing/spacing fix in spoken text, leave it unchanged."
].join(" ");

const spokenTextOnlyRule = [
  "Only edit spoken text segments.",
  "Spoken text excludes: speaker labels, timestamps, bracketed tags, parenthetical stage directions, URLs/emails, file paths, and code/config blocks."
].join(" ");

const preserveLineStructureRule =
  "Do not change line breaks, and do not merge or split lines.";

const allowSpeakerTurnLineBreaksRule = [
  "You may insert or remove line breaks only to ensure each speaker turn is on its own line.",
  "Only split immediately before an existing speaker label/timestamp that already appears in the text.",
  "Do not move any words, tags, or punctuation across speaker turns."
].join(" ");

const allowHeadingsRule = [
  "You may insert neutral Markdown headings (lines starting with #) to group sections.",
  "Headings must be short and non-interpretive (e.g., 'Introductions', 'Pricing', 'Q&A', '00:10-00:18').",
  "Place headings only between existing lines (never inside a speaker line).",
  "Do not modify existing transcript text; headings and surrounding blank lines are additive only."
].join(" ");

const whitespaceAllowanceForHeadings =
  "Whitespace-only changes (adding/removing blank lines) are allowed only as needed to place headings cleanly.";

// Optional: if you adopt explicit verbatim markers in ingestion, enable this everywhere.
const verbatimSpanRule =
  "If you see spans delimited by <<<VERBATIM>>> and <<<END_VERBATIM>>>, copy the text inside exactly with zero changes (including whitespace).";

// Optional: reduces bad 'corrections' of proper nouns/tech terms.
const uncertaintyRule =
  "Do not guess spellings of names/brands/technical terms. If the transcript is ambiguous, leave the original token unchanged.";

export const AI_CORRECTION_PROMPT = {
  system: [
    "You are a transcription editor performing minimal, high-precision corrections.",
    "Fix only obvious transcription errors plus punctuation, capitalization, and spacing in spoken text.",
    "Do not rewrite for style or clarity; do not remove filler; do not expand/contract words unless clearly an error.",
    spokenTextOnlyRule,
    preserveLineStructureRule,
    // Uncomment if using these conventions:
    // verbatimSpanRule,
    // uncertaintyRule,
    baseRules
  ].join(" "),
  instruction: "Correct the transcript below."
};

export const CONTENT_REVIEW_TEMPLATES: ContentReviewTemplate[] = [
  {
    id: "transcript_clean",
    label: "Clean transcript",
    description: "Normalize punctuation and casing while preserving line structure.",
    outputFormat: "plain",
    systemPrompt: [
      "You format transcripts for readability with minimal edits.",
      "Normalize punctuation and casing in spoken text only.",
      spokenTextOnlyRule,
      preserveLineStructureRule,
      // Uncomment if using these conventions:
      // verbatimSpanRule,
      // uncertaintyRule,
      baseRules
    ].join(" "),
    instruction: "Format the transcript below using clean, readable text."
  },
  {
    id: "speaker_turns",
    label: "Speaker turns",
    description: "Ensure each speaker turn is on its own line with clear labels.",
    outputFormat: "plain",
    systemPrompt: [
      "You format transcripts into clean speaker turns.",
      "Ensure each speaker turn is on its own line.",
      spokenTextOnlyRule,
      allowSpeakerTurnLineBreaksRule,
      // Uncomment if using these conventions:
      // verbatimSpanRule,
      // uncertaintyRule,
      baseRules
    ].join(" "),
    instruction: "Format the transcript below into clear speaker turns."
  },
  {
    id: "chapter_headings",
    label: "Chapter headings",
    description: "Insert Markdown headings to group topics without removing content.",
    outputFormat: "markdown",
    systemPrompt: [
      "You add light structure to transcripts by inserting short, neutral Markdown headings.",
      allowHeadingsRule,
      whitespaceAllowanceForHeadings,
      spokenTextOnlyRule,
      // Uncomment if using these conventions:
      // verbatimSpanRule,
      // uncertaintyRule,
      baseRules
    ].join(" "),
    instruction: "Add Markdown headings to the transcript below."
  }
];

export const wrapDraftForPrompt = (content: string, instruction: string) => {
  return `${instruction}\n\n<<<CONTENT>>>\n${content}\n<<<END>>>`
}

export const stripCodeFences = (value: string) => {
  const text = String(value || "").trim()
  // Only strip if the entire string is wrapped in fences
  const fencePattern = /^```[a-zA-Z0-9_-]*\n?([\s\S]*?)\n?```\s*$/
  const match = text.match(fencePattern)
  return match ? match[1].trim() : text
}

type ChatChoice = {
  message?: { content?: unknown } | null
  text?: unknown
}

type ChatResponse = {
  choices?: ChatChoice[] | null
  content?: unknown
}

const extractTextFromContent = (value: unknown): string => {
  if (typeof value === "string") {
    return value
  }
  if (Array.isArray(value)) {
    return value.map(extractTextFromContent).filter(Boolean).join("")
  }
  if (value && typeof value === "object") {
    const maybeText = (value as { text?: unknown }).text
    if (typeof maybeText === "string") {
      return maybeText
    }
    const maybeContent = (value as { content?: unknown }).content
    if (typeof maybeContent === "string") {
      return maybeContent
    }
    if (Array.isArray(maybeContent)) {
      return maybeContent
        .map(extractTextFromContent)
        .filter(Boolean)
        .join("")
    }
  }
  return ""
}

export const extractChatContent = (resp: unknown): string => {
  if (typeof resp === "string") {
    return stripCodeFences(resp.trim())
  }

  if (!resp || typeof resp !== "object") {
    return ""
  }

  const { choices, content } = resp as ChatResponse
  const raw = choices?.[0]?.message?.content ?? choices?.[0]?.text ?? content ?? ""
  const text = extractTextFromContent(raw)
  return stripCodeFences(String(text || "").trim())
}
