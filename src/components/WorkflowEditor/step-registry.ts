/**
 * Step Type Registry
 *
 * Defines metadata, visual properties, and configuration schemas
 * for each workflow step type.
 */

import type {
  WorkflowStepType,
  StepCategory,
  ConfigFieldSchema,
  PortDefinition
} from "@/types/workflow-editor"

// Re-export for consumers
export type { StepCategory, ConfigFieldSchema, PortDefinition }

// Step type metadata definition
export interface StepTypeMetadata {
  type: WorkflowStepType
  label: string
  description: string
  category: StepCategory
  icon: string
  color: string
  inputs: PortDefinition[]
  outputs: PortDefinition[]
  configSchema: ConfigFieldSchema[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Category Metadata
// ─────────────────────────────────────────────────────────────────────────────

export const STEP_CATEGORIES: Record<
  StepCategory,
  { label: string; color: string; order: number }
> = {
  ai: {
    label: "AI",
    color: "purple",
    order: 1
  },
  data: {
    label: "Data",
    color: "blue",
    order: 2
  },
  control: {
    label: "Control Flow",
    color: "orange",
    order: 3
  },
  io: {
    label: "Input/Output",
    color: "green",
    order: 4
  },
  utility: {
    label: "Utility",
    color: "gray",
    order: 5
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Step Type Registry
// ─────────────────────────────────────────────────────────────────────────────

export const STEP_REGISTRY: Record<WorkflowStepType, StepTypeMetadata> = {
  // ─── AI Steps ────────────────────────────────────────────────────────────

  prompt: {
    type: "prompt",
    label: "LLM Prompt",
    description: "Generate text using a language model with templated prompts",
    category: "ai",
    icon: "MessageSquare",
    color: "bg-purple-500",
    inputs: [
      { id: "input", label: "Input", dataType: "any", required: true }
    ],
    outputs: [
      { id: "output", label: "Output", dataType: "string" }
    ],
    configSchema: [
      {
        key: "model",
        type: "model-picker",
        label: "Model",
        description: "Select the AI model to use",
        required: true
      },
      {
        key: "systemPrompt",
        type: "textarea",
        label: "System Prompt",
        description: "Instructions for the AI model",
        default: "You are a helpful assistant."
      },
      {
        key: "userPromptTemplate",
        type: "template-editor",
        label: "User Prompt Template",
        description: "Template for the user message. Use {{variable}} for placeholders.",
        required: true
      },
      {
        key: "temperature",
        type: "number",
        label: "Temperature",
        description: "Controls randomness (0-2)",
        default: 0.7,
        validation: { min: 0, max: 2 }
      },
      {
        key: "maxTokens",
        type: "number",
        label: "Max Tokens",
        description: "Maximum tokens to generate",
        default: 1024,
        validation: { min: 1, max: 128000 }
      }
    ]
  },

  rag_search: {
    type: "rag_search",
    label: "RAG Search",
    description: "Search your knowledge base for relevant documents",
    category: "data",
    icon: "Search",
    color: "bg-blue-500",
    inputs: [
      { id: "query", label: "Query", dataType: "string", required: true }
    ],
    outputs: [
      { id: "results", label: "Results", dataType: "array" }
    ],
    configSchema: [
      {
        key: "collectionId",
        type: "collection-picker",
        label: "Collection",
        description: "Select the knowledge collection to search",
        required: true
      },
      {
        key: "queryTemplate",
        type: "template-editor",
        label: "Query Template",
        description: "Template for the search query"
      },
      {
        key: "topK",
        type: "number",
        label: "Top K Results",
        description: "Number of results to return",
        default: 5,
        validation: { min: 1, max: 100 }
      },
      {
        key: "minScore",
        type: "number",
        label: "Minimum Score",
        description: "Minimum similarity score (0-1)",
        default: 0.5,
        validation: { min: 0, max: 1 }
      }
    ]
  },

  media_ingest: {
    type: "media_ingest",
    label: "Media Ingest",
    description: "Process YouTube videos, audio files, or other media",
    category: "data",
    icon: "Video",
    color: "bg-blue-600",
    inputs: [
      { id: "source", label: "Source", dataType: "any" }
    ],
    outputs: [
      { id: "content", label: "Content", dataType: "object" },
      { id: "transcript", label: "Transcript", dataType: "string" }
    ],
    configSchema: [
      {
        key: "sourceType",
        type: "select",
        label: "Source Type",
        default: "url",
        options: [
          { value: "url", label: "URL" },
          { value: "file", label: "File Upload" }
        ]
      },
      {
        key: "url",
        type: "url",
        label: "Media URL",
        description: "YouTube URL or direct media link",
        showWhen: { field: "sourceType", value: "url" }
      },
      {
        key: "extractAudio",
        type: "checkbox",
        label: "Extract Audio",
        default: true
      },
      {
        key: "transcribe",
        type: "checkbox",
        label: "Transcribe Audio",
        default: true
      },
      {
        key: "chunkingStrategy",
        type: "select",
        label: "Chunking Strategy",
        default: "paragraph",
        options: [
          { value: "sentence", label: "Sentence" },
          { value: "paragraph", label: "Paragraph" },
          { value: "fixed", label: "Fixed Size" }
        ]
      }
    ]
  },

  // ─── Control Flow Steps ──────────────────────────────────────────────────

  branch: {
    type: "branch",
    label: "Branch",
    description: "Conditional routing based on expressions",
    category: "control",
    icon: "GitBranch",
    color: "bg-orange-500",
    inputs: [
      { id: "input", label: "Input", dataType: "any", required: true }
    ],
    outputs: [
      { id: "true", label: "True", dataType: "control" },
      { id: "false", label: "False", dataType: "control" },
      { id: "default", label: "Default", dataType: "control" }
    ],
    configSchema: [
      {
        key: "conditions",
        type: "json-editor",
        label: "Conditions",
        description: "Array of condition objects with expression and outputId",
        default: [
          { id: "cond-1", expression: "input.value > 0", outputId: "true" }
        ]
      },
      {
        key: "defaultOutputId",
        type: "text",
        label: "Default Output",
        description: "Output to use when no conditions match",
        default: "false"
      }
    ]
  },

  map: {
    type: "map",
    label: "Map",
    description: "Process each item in an array (fan-out)",
    category: "control",
    icon: "Layers",
    color: "bg-orange-600",
    inputs: [
      { id: "array", label: "Array", dataType: "array", required: true }
    ],
    outputs: [
      { id: "item", label: "Item", dataType: "any" },
      { id: "results", label: "Results", dataType: "array" }
    ],
    configSchema: [
      {
        key: "arrayPath",
        type: "text",
        label: "Array Path",
        description: "JSON path to the array (e.g., input.items)",
        default: "input"
      },
      {
        key: "itemVariable",
        type: "text",
        label: "Item Variable",
        description: "Variable name for each item",
        default: "item"
      },
      {
        key: "maxParallel",
        type: "number",
        label: "Max Parallel",
        description: "Maximum concurrent executions",
        default: 5,
        validation: { min: 1, max: 50 }
      }
    ]
  },

  wait_for_human: {
    type: "wait_for_human",
    label: "Human Approval",
    description: "Pause workflow and wait for human approval",
    category: "control",
    icon: "UserCheck",
    color: "bg-yellow-500",
    inputs: [
      { id: "data", label: "Data", dataType: "any", required: true }
    ],
    outputs: [
      { id: "approved", label: "Approved", dataType: "any" },
      { id: "rejected", label: "Rejected", dataType: "any" }
    ],
    configSchema: [
      {
        key: "promptMessage",
        type: "textarea",
        label: "Approval Prompt",
        description: "Message shown to the reviewer",
        required: true
      },
      {
        key: "allowEdit",
        type: "checkbox",
        label: "Allow Editing",
        description: "Let reviewer edit data before approving",
        default: true
      },
      {
        key: "editableFields",
        type: "multiselect",
        label: "Editable Fields",
        description: "Fields the reviewer can edit",
        showWhen: { field: "allowEdit", value: true }
      },
      {
        key: "timeoutSeconds",
        type: "number",
        label: "Timeout (seconds)",
        description: "Auto-action after timeout (0 = no timeout)",
        default: 0,
        validation: { min: 0 }
      },
      {
        key: "defaultAction",
        type: "select",
        label: "Default Action",
        description: "Action to take on timeout",
        default: "reject",
        options: [
          { value: "approve", label: "Approve" },
          { value: "reject", label: "Reject" }
        ],
        showWhen: { field: "timeoutSeconds", value: 0 }
      }
    ]
  },

  // ─── I/O Steps ───────────────────────────────────────────────────────────

  webhook: {
    type: "webhook",
    label: "Webhook",
    description: "Make HTTP requests to external APIs",
    category: "io",
    icon: "Globe",
    color: "bg-green-500",
    inputs: [
      { id: "data", label: "Data", dataType: "any" }
    ],
    outputs: [
      { id: "response", label: "Response", dataType: "object" }
    ],
    configSchema: [
      {
        key: "url",
        type: "url",
        label: "URL",
        description: "The endpoint URL",
        required: true
      },
      {
        key: "method",
        type: "select",
        label: "Method",
        default: "POST",
        options: [
          { value: "GET", label: "GET" },
          { value: "POST", label: "POST" },
          { value: "PUT", label: "PUT" },
          { value: "PATCH", label: "PATCH" },
          { value: "DELETE", label: "DELETE" }
        ]
      },
      {
        key: "headers",
        type: "json-editor",
        label: "Headers",
        description: "Request headers as JSON object",
        default: { "Content-Type": "application/json" }
      },
      {
        key: "bodyTemplate",
        type: "template-editor",
        label: "Body Template",
        description: "Request body template with {{variables}}"
      },
      {
        key: "responseMapping",
        type: "text",
        label: "Response Mapping",
        description: "JSON path to extract from response"
      }
    ]
  },

  tts: {
    type: "tts",
    label: "Text to Speech",
    description: "Convert text to audio",
    category: "io",
    icon: "Volume2",
    color: "bg-green-600",
    inputs: [
      { id: "text", label: "Text", dataType: "string", required: true }
    ],
    outputs: [
      { id: "audio", label: "Audio", dataType: "audio" }
    ],
    configSchema: [
      {
        key: "voice",
        type: "select",
        label: "Voice",
        default: "alloy",
        options: [
          { value: "alloy", label: "Alloy" },
          { value: "echo", label: "Echo" },
          { value: "fable", label: "Fable" },
          { value: "onyx", label: "Onyx" },
          { value: "nova", label: "Nova" },
          { value: "shimmer", label: "Shimmer" }
        ]
      },
      {
        key: "speed",
        type: "number",
        label: "Speed",
        default: 1.0,
        validation: { min: 0.25, max: 4.0 }
      },
      {
        key: "format",
        type: "select",
        label: "Output Format",
        default: "mp3",
        options: [
          { value: "mp3", label: "MP3" },
          { value: "opus", label: "OPUS" },
          { value: "aac", label: "AAC" },
          { value: "flac", label: "FLAC" },
          { value: "wav", label: "WAV" },
          { value: "pcm", label: "PCM (raw)" }
        ]
      }
    ]
  },

  stt_transcribe: {
    type: "stt_transcribe",
    label: "Transcribe",
    description: "Convert audio to text",
    category: "io",
    icon: "Mic",
    color: "bg-green-700",
    inputs: [
      { id: "audio", label: "Audio", dataType: "audio", required: true }
    ],
    outputs: [
      { id: "text", label: "Text", dataType: "string" }
    ],
    configSchema: [
      {
        key: "model",
        type: "select",
        label: "Model",
        default: "whisper-1",
        options: [
          { value: "whisper-1", label: "Whisper" }
        ]
      },
      {
        key: "language",
        type: "text",
        label: "Language",
        description: "ISO language code (e.g., en, es, fr)"
      },
      {
        key: "punctuate",
        type: "checkbox",
        label: "Add Punctuation",
        default: true
      }
    ]
  },

  // ─── Utility Steps ───────────────────────────────────────────────────────

  delay: {
    type: "delay",
    label: "Delay",
    description: "Wait for a specified duration",
    category: "utility",
    icon: "Clock",
    color: "bg-gray-500",
    inputs: [
      { id: "input", label: "Input", dataType: "any" }
    ],
    outputs: [
      { id: "output", label: "Output", dataType: "any" }
    ],
    configSchema: [
      {
        key: "durationSeconds",
        type: "duration",
        label: "Duration",
        description: "Time to wait in seconds",
        default: 5,
        validation: { min: 0, max: 3600 }
      }
    ]
  },

  log: {
    type: "log",
    label: "Log",
    description: "Output debug information",
    category: "utility",
    icon: "Terminal",
    color: "bg-gray-600",
    inputs: [
      { id: "data", label: "Data", dataType: "any" }
    ],
    outputs: [
      { id: "passthrough", label: "Passthrough", dataType: "any" }
    ],
    configSchema: [
      {
        key: "level",
        type: "select",
        label: "Log Level",
        default: "info",
        options: [
          { value: "debug", label: "Debug" },
          { value: "info", label: "Info" },
          { value: "warn", label: "Warning" },
          { value: "error", label: "Error" }
        ]
      },
      {
        key: "messageTemplate",
        type: "template-editor",
        label: "Message Template",
        description: "Template for the log message"
      }
    ]
  },

  // ─── Start/End Steps ─────────────────────────────────────────────────────

  start: {
    type: "start",
    label: "Start",
    description: "Entry point of the workflow",
    category: "control",
    icon: "Play",
    color: "bg-emerald-500",
    inputs: [],
    outputs: [
      { id: "output", label: "Output", dataType: "any" }
    ],
    configSchema: [
      {
        key: "inputSchema",
        type: "json-editor",
        label: "Input Schema",
        description: "Define expected input structure"
      }
    ]
  },

  end: {
    type: "end",
    label: "End",
    description: "Exit point of the workflow",
    category: "control",
    icon: "Square",
    color: "bg-red-500",
    inputs: [
      { id: "input", label: "Input", dataType: "any", required: true }
    ],
    outputs: [],
    configSchema: [
      {
        key: "outputMapping",
        type: "text",
        label: "Output Mapping",
        description: "JSON path to extract as final output"
      }
    ]
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

export const getStepMetadata = (
  type: WorkflowStepType
): StepTypeMetadata | undefined => STEP_REGISTRY[type]

export const getStepsByCategory = (
  category: StepCategory
): StepTypeMetadata[] =>
  Object.values(STEP_REGISTRY).filter((step) => step.category === category)

export const getAllSteps = (): StepTypeMetadata[] =>
  Object.values(STEP_REGISTRY)

export const getAddableSteps = (): StepTypeMetadata[] =>
  Object.values(STEP_REGISTRY).filter(
    (step) => step.type !== "start" && step.type !== "end"
  )

export const getCategorizedSteps = (): Array<{
  category: StepCategory
  label: string
  color: string
  steps: StepTypeMetadata[]
}> => {
  const categories = Object.entries(STEP_CATEGORIES)
    .sort((a, b) => a[1].order - b[1].order)
    .map(([key, meta]) => ({
      category: key as StepCategory,
      label: meta.label,
      color: meta.color,
      steps: getStepsByCategory(key as StepCategory).filter(
        (s) => s.type !== "start" && s.type !== "end"
      )
    }))
    .filter((cat) => cat.steps.length > 0)

  return categories
}

// Data type colors for ports
export const PORT_COLORS: Record<string, string> = {
  any: "bg-gray-400",
  string: "bg-blue-400",
  number: "bg-green-400",
  boolean: "bg-yellow-400",
  array: "bg-purple-400",
  object: "bg-pink-400",
  file: "bg-orange-400",
  audio: "bg-cyan-400",
  control: "bg-gray-600"
}
