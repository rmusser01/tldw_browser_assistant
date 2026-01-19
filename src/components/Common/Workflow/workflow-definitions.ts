/**
 * Workflow Definitions
 *
 * Defines all available guided workflows with their steps and triggers.
 * These definitions are used by the landing page and contextual suggestion system.
 */

import type { WorkflowDefinition, WorkflowCategory } from "@/types/workflows"

// ─────────────────────────────────────────────────────────────────────────────
// Category: Content Capture
// ─────────────────────────────────────────────────────────────────────────────

export const SUMMARIZE_PAGE_WORKFLOW: WorkflowDefinition = {
  id: "summarize-page",
  category: "content-capture",
  labelToken: "workflows:summarizePage.title",
  descriptionToken: "workflows:summarizePage.description",
  icon: "FileText",
  steps: [
    {
      id: "capture",
      labelToken: "workflows:summarizePage.steps.capture",
      descriptionToken: "workflows:summarizePage.steps.captureDesc",
      component: "SummarizePageCapture",
      autoAdvance: true
    },
    {
      id: "options",
      labelToken: "workflows:summarizePage.steps.options",
      descriptionToken: "workflows:summarizePage.steps.optionsDesc",
      component: "SummarizePageOptions",
      isOptional: true
    },
    {
      id: "result",
      labelToken: "workflows:summarizePage.steps.result",
      descriptionToken: "workflows:summarizePage.steps.resultDesc",
      component: "SummarizePageResult"
    }
  ],
  triggers: [
    {
      type: "context",
      condition: "on-webpage",
      suggestionToken: "workflows:summarizePage.suggestion"
    }
  ]
}

export const QUICK_SAVE_WORKFLOW: WorkflowDefinition = {
  id: "quick-save",
  category: "content-capture",
  labelToken: "workflows:quickSave.workflowTitle",
  descriptionToken: "workflows:quickSave.description",
  icon: "Save",
  steps: [
    {
      id: "capture",
      labelToken: "workflows:quickSave.steps.capture",
      descriptionToken: "workflows:quickSave.steps.captureDesc",
      component: "QuickSaveCapture",
      autoAdvance: true
    },
    {
      id: "details",
      labelToken: "workflows:quickSave.steps.details",
      descriptionToken: "workflows:quickSave.steps.detailsDesc",
      component: "QuickSaveDetails",
      isOptional: true
    },
    {
      id: "confirm",
      labelToken: "workflows:quickSave.steps.confirm",
      descriptionToken: "workflows:quickSave.steps.confirmDesc",
      component: "QuickSaveConfirm"
    }
  ],
  triggers: [
    {
      type: "user-action",
      condition: "text-selected",
      suggestionToken: "workflows:quickSave.suggestion"
    }
  ]
}

// ─────────────────────────────────────────────────────────────────────────────
// Category: Knowledge Q&A
// ─────────────────────────────────────────────────────────────────────────────

export const UPLOAD_ASK_WORKFLOW: WorkflowDefinition = {
  id: "upload-ask",
  category: "knowledge-qa",
  labelToken: "workflows:uploadAsk.title",
  descriptionToken: "workflows:uploadAsk.description",
  icon: "Upload",
  steps: [
    {
      id: "upload",
      labelToken: "workflows:uploadAsk.steps.upload",
      descriptionToken: "workflows:uploadAsk.steps.uploadDesc",
      component: "UploadAskUpload"
    },
    {
      id: "process",
      labelToken: "workflows:uploadAsk.steps.process",
      descriptionToken: "workflows:uploadAsk.steps.processDesc",
      component: "UploadAskProcess",
      autoAdvance: true
    },
    {
      id: "chat",
      labelToken: "workflows:uploadAsk.steps.chat",
      descriptionToken: "workflows:uploadAsk.steps.chatDesc",
      component: "UploadAskChat"
    }
  ],
  triggers: [
    {
      type: "content-type",
      condition: "pdf-uploaded",
      suggestionToken: "workflows:uploadAsk.suggestion"
    }
  ]
}

export const ASK_DOCUMENTS_WORKFLOW: WorkflowDefinition = {
  id: "ask-documents",
  category: "knowledge-qa",
  labelToken: "workflows:askDocuments.title",
  descriptionToken: "workflows:askDocuments.description",
  icon: "MessageSquareText",
  steps: [
    {
      id: "check",
      labelToken: "workflows:askDocuments.steps.check",
      descriptionToken: "workflows:askDocuments.steps.checkDesc",
      component: "AskDocumentsCheck",
      autoAdvance: true
    },
    {
      id: "chat",
      labelToken: "workflows:askDocuments.steps.chat",
      descriptionToken: "workflows:askDocuments.steps.chatDesc",
      component: "AskDocumentsChat"
    }
  ]
}

export const ANALYZE_BOOK_WORKFLOW: WorkflowDefinition = {
  id: "analyze-book",
  category: "knowledge-qa",
  labelToken: "workflows:analyzeBook.title",
  descriptionToken: "workflows:analyzeBook.description",
  icon: "BookOpen",
  steps: [
    {
      id: "select",
      labelToken: "workflows:analyzeBook.steps.select",
      descriptionToken: "workflows:analyzeBook.steps.selectDesc",
      component: "AnalyzeBookSelect"
    },
    {
      id: "chunking",
      labelToken: "workflows:analyzeBook.steps.chunking",
      descriptionToken: "workflows:analyzeBook.steps.chunkingDesc",
      component: "AnalyzeBookChunking"
    },
    {
      id: "configure",
      labelToken: "workflows:analyzeBook.steps.configure",
      descriptionToken: "workflows:analyzeBook.steps.configureDesc",
      component: "AnalyzeBookConfigure",
      isOptional: true
    },
    {
      id: "process",
      labelToken: "workflows:analyzeBook.steps.process",
      descriptionToken: "workflows:analyzeBook.steps.processDesc",
      component: "AnalyzeBookProcess",
      autoAdvance: true
    },
    {
      id: "review",
      labelToken: "workflows:analyzeBook.steps.review",
      descriptionToken: "workflows:analyzeBook.steps.reviewDesc",
      component: "AnalyzeBookReview"
    }
  ],
  triggers: [
    {
      type: "content-type",
      condition: "book-uploaded",
      suggestionToken: "workflows:analyzeBook.suggestion"
    }
  ]
}

// ─────────────────────────────────────────────────────────────────────────────
// Category: Media Processing
// ─────────────────────────────────────────────────────────────────────────────

export const TRANSCRIBE_MEDIA_WORKFLOW: WorkflowDefinition = {
  id: "transcribe-media",
  category: "media-processing",
  labelToken: "workflows:transcribeMedia.title",
  descriptionToken: "workflows:transcribeMedia.description",
  icon: "Video",
  steps: [
    {
      id: "input",
      labelToken: "workflows:transcribeMedia.steps.input",
      descriptionToken: "workflows:transcribeMedia.steps.inputDesc",
      component: "TranscribeMediaInput"
    },
    {
      id: "options",
      labelToken: "workflows:transcribeMedia.steps.options",
      descriptionToken: "workflows:transcribeMedia.steps.optionsDesc",
      component: "TranscribeMediaOptions",
      isOptional: true
    },
    {
      id: "process",
      labelToken: "workflows:transcribeMedia.steps.process",
      descriptionToken: "workflows:transcribeMedia.steps.processDesc",
      component: "TranscribeMediaProcess",
      autoAdvance: true
    },
    {
      id: "result",
      labelToken: "workflows:transcribeMedia.steps.result",
      descriptionToken: "workflows:transcribeMedia.steps.resultDesc",
      component: "TranscribeMediaResult"
    }
  ],
  triggers: [
    {
      type: "content-type",
      condition: "youtube-url-pasted",
      suggestionToken: "workflows:transcribeMedia.suggestion"
    }
  ]
}

export const EXTRACT_TEXT_WORKFLOW: WorkflowDefinition = {
  id: "extract-text",
  category: "media-processing",
  labelToken: "workflows:extractText.title",
  descriptionToken: "workflows:extractText.description",
  icon: "ScanText",
  steps: [
    {
      id: "upload",
      labelToken: "workflows:extractText.steps.upload",
      descriptionToken: "workflows:extractText.steps.uploadDesc",
      component: "ExtractTextUpload"
    },
    {
      id: "process",
      labelToken: "workflows:extractText.steps.process",
      descriptionToken: "workflows:extractText.steps.processDesc",
      component: "ExtractTextProcess",
      autoAdvance: true
    },
    {
      id: "result",
      labelToken: "workflows:extractText.steps.result",
      descriptionToken: "workflows:extractText.steps.resultDesc",
      component: "ExtractTextResult"
    }
  ]
}

// ─────────────────────────────────────────────────────────────────────────────
// Category: Learning Tools
// ─────────────────────────────────────────────────────────────────────────────

export const CREATE_QUIZ_WORKFLOW: WorkflowDefinition = {
  id: "create-quiz",
  category: "learning-tools",
  labelToken: "workflows:createQuiz.title",
  descriptionToken: "workflows:createQuiz.description",
  icon: "ClipboardList",
  steps: [
    {
      id: "source",
      labelToken: "workflows:createQuiz.steps.source",
      descriptionToken: "workflows:createQuiz.steps.sourceDesc",
      component: "CreateQuizSource"
    },
    {
      id: "options",
      labelToken: "workflows:createQuiz.steps.options",
      descriptionToken: "workflows:createQuiz.steps.optionsDesc",
      component: "CreateQuizOptions",
      isOptional: true
    },
    {
      id: "generate",
      labelToken: "workflows:createQuiz.steps.generate",
      descriptionToken: "workflows:createQuiz.steps.generateDesc",
      component: "CreateQuizGenerate",
      autoAdvance: true
    },
    {
      id: "take",
      labelToken: "workflows:createQuiz.steps.take",
      descriptionToken: "workflows:createQuiz.steps.takeDesc",
      component: "CreateQuizTake"
    }
  ],
  triggers: [
    {
      type: "user-action",
      condition: "summary-viewed",
      suggestionToken: "workflows:createQuiz.suggestion"
    }
  ]
}

export const MAKE_FLASHCARDS_WORKFLOW: WorkflowDefinition = {
  id: "make-flashcards",
  category: "learning-tools",
  labelToken: "workflows:makeFlashcards.title",
  descriptionToken: "workflows:makeFlashcards.description",
  icon: "Layers",
  steps: [
    {
      id: "source",
      labelToken: "workflows:makeFlashcards.steps.source",
      descriptionToken: "workflows:makeFlashcards.steps.sourceDesc",
      component: "MakeFlashcardsSource"
    },
    {
      id: "options",
      labelToken: "workflows:makeFlashcards.steps.options",
      descriptionToken: "workflows:makeFlashcards.steps.optionsDesc",
      component: "MakeFlashcardsOptions",
      isOptional: true
    },
    {
      id: "generate",
      labelToken: "workflows:makeFlashcards.steps.generate",
      descriptionToken: "workflows:makeFlashcards.steps.generateDesc",
      component: "MakeFlashcardsGenerate",
      autoAdvance: true
    },
    {
      id: "review",
      labelToken: "workflows:makeFlashcards.steps.review",
      descriptionToken: "workflows:makeFlashcards.steps.reviewDesc",
      component: "MakeFlashcardsReview"
    }
  ]
}

// ─────────────────────────────────────────────────────────────────────────────
// All Workflows
// ─────────────────────────────────────────────────────────────────────────────

export const ALL_WORKFLOWS: WorkflowDefinition[] = [
  SUMMARIZE_PAGE_WORKFLOW,
  QUICK_SAVE_WORKFLOW,
  UPLOAD_ASK_WORKFLOW,
  ASK_DOCUMENTS_WORKFLOW,
  ANALYZE_BOOK_WORKFLOW,
  TRANSCRIBE_MEDIA_WORKFLOW,
  EXTRACT_TEXT_WORKFLOW,
  CREATE_QUIZ_WORKFLOW,
  MAKE_FLASHCARDS_WORKFLOW
]

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

export const getWorkflowById = (
  id: string
): WorkflowDefinition | undefined => {
  return ALL_WORKFLOWS.find((w) => w.id === id)
}

export const getWorkflowsByCategory = (
  category: WorkflowCategory
): WorkflowDefinition[] => {
  return ALL_WORKFLOWS.filter((w) => w.category === category)
}

export const CATEGORY_LABELS: Record<WorkflowCategory, string> = {
  "content-capture": "workflows:categories.contentCapture",
  "knowledge-qa": "workflows:categories.knowledgeQA",
  "media-processing": "workflows:categories.mediaProcessing",
  "learning-tools": "workflows:categories.learningTools"
}

export const CATEGORY_ORDER: WorkflowCategory[] = [
  "content-capture",
  "knowledge-qa",
  "media-processing",
  "learning-tools"
]
