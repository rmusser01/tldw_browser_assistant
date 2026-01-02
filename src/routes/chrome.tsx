// Lazy-load all routes to reduce initial bundle size and improve code splitting
// (matches the Firefox approach for consistency and better performance)
import { lazy, Suspense } from "react"
import { Route, Routes } from "react-router-dom"

// Lazy-loaded route components
const OptionIndex = lazy(() => import("./option-index"))
const OptionSettings = lazy(() => import("./option-settings"))
const OptionModal = lazy(() => import("./option-settings-model"))
const OptionPrompt = lazy(() => import("./option-settings-prompt"))
const OptionShare = lazy(() => import("./option-settings-share"))
const OptionProcessed = lazy(() => import("./option-settings-processed"))
const OptionHealth = lazy(() => import("./option-settings-health"))
const OptionKnowledgeBase = lazy(() => import("./option-settings-knowledge"))
const OptionAbout = lazy(() => import("./option-settings-about"))
const OptionChatbooks = lazy(() => import("./option-settings-chatbooks"))
const SidepanelChat = lazy(() => import("./sidepanel-chat"))
const SidepanelSettings = lazy(() => import("./sidepanel-settings"))
const SidepanelAgent = lazy(() => import("./sidepanel-agent"))
const SidepanelErrorBoundaryTest = lazy(() => import("./sidepanel-error-boundary-test"))
const OptionRagSettings = lazy(() => import("./option-rag"))
const OptionTldwSettings = lazy(() => import("./option-settings-tldw").then(m => ({ default: m.OptionTldwSettings })))
const OptionMedia = lazy(() => import("./option-media"))
const OptionMediaMulti = lazy(() => import("./option-media-multi"))
const OptionNotes = lazy(() => import("./option-notes"))
const OptionWorldBooks = lazy(() => import("./option-settings-world-books"))
const OptionDictionaries = lazy(() => import("./option-settings-dictionaries"))
const OptionCharacters = lazy(() => import("./option-settings-characters"))
const OptionWorldBooksWorkspace = lazy(() => import("./option-world-books"))
const OptionDictionariesWorkspace = lazy(() => import("./option-dictionaries"))
const OptionCharactersWorkspace = lazy(() => import("./option-characters"))
const OptionPromptsWorkspace = lazy(() => import("./option-prompts"))
const OptionKnowledgeWorkspace = lazy(() => import("./option-knowledge"))
const OptionFlashcards = lazy(() => import("./option-flashcards"))
const OptionTts = lazy(() => import("./option-tts"))
const OptionEvaluations = lazy(() => import("./option-evaluations"))
const OptionStt = lazy(() => import("./option-stt"))
const OptionSpeech = lazy(() => import("./option-speech"))
const OptionSettingsEvaluations = lazy(() => import("./option-settings-evaluations"))
const OptionPromptStudio = lazy(() => import("./option-prompt-studio"))
const OptionSettingsPromptStudio = lazy(() => import("./option-settings-prompt-studio"))
const OptionAdminServer = lazy(() => import("./option-admin-server"))
const OptionAdminLlamacpp = lazy(() => import("./option-admin-llamacpp"))
const OptionAdminMlx = lazy(() => import("./option-admin-mlx"))
const OptionChatSettings = lazy(() => import("./option-settings-chat"))
const OptionQuickChatPopout = lazy(() => import("./option-quick-chat-popout"))
const OptionContentReview = lazy(() => import("./option-content-review"))
const OptionChunkingPlayground = lazy(() => import("./option-chunking-playground"))
const OptionQuiz = lazy(() => import("./option-quiz"))

// Non-lazy imports for components needed immediately
import OptionLayout from "~/components/Layouts/Layout"
import { OnboardingWizard } from "@/components/Option/Onboarding/OnboardingWizard"

// Loading fallback for route transitions
const RouteLoading = () => (
  <div className="flex h-full w-full items-center justify-center">
    <div className="text-sm text-gray-500">Loading...</div>
  </div>
)

export const OptionRoutingChrome = () => {
  return (
    <Suspense fallback={<RouteLoading />}>
      <Routes>
        <Route path="/" element={<OptionIndex />} />
        {/* Dedicated route for Playwright onboarding tests so they can
            exercise the wizard independently of first-run gating logic. */}
        <Route
          path="/onboarding-test"
          element={
            <OptionLayout hideHeader={true} showHeaderSelectors={false}>
              <OnboardingWizard />
            </OptionLayout>
          }
        />
        <Route path="/settings" element={<OptionSettings />} />
        <Route path="/settings/tldw" element={<OptionTldwSettings />} />
        <Route path="/settings/model" element={<OptionModal />} />
        <Route path="/settings/prompt" element={<OptionPrompt />} />
        <Route path="/settings/evaluations" element={<OptionSettingsEvaluations />} />
        {/** Chrome AI and OpenAI/custom provider settings removed; extension is tldw_server-only */}
        <Route path="/settings/chat" element={<OptionChatSettings />} />
        <Route path="/settings/share" element={<OptionShare />} />
        <Route path="/settings/processed" element={<OptionProcessed />} />
        <Route path="/settings/health" element={<OptionHealth />} />
        <Route path="/settings/prompt-studio" element={<OptionSettingsPromptStudio />} />
        <Route path="/settings/knowledge" element={<OptionKnowledgeBase />} />
        <Route path="/settings/chatbooks" element={<OptionChatbooks />} />
        <Route path="/settings/characters" element={<OptionCharacters />} />
        <Route path="/settings/world-books" element={<OptionWorldBooks />} />
        <Route path="/settings/chat-dictionaries" element={<OptionDictionaries />} />
        <Route path="/settings/rag" element={<OptionRagSettings />} />
        <Route path="/chunking-playground" element={<OptionChunkingPlayground />} />
        <Route path="/settings/about" element={<OptionAbout />} />
        <Route path="/review" element={<OptionMediaMulti />} />
        <Route path="/flashcards" element={<OptionFlashcards />} />
        <Route path="/quiz" element={<OptionQuiz />} />
        <Route path="/media" element={<OptionMedia />} />
        <Route path="/media-multi" element={<OptionMediaMulti />} />
        <Route path="/content-review" element={<OptionContentReview />} />
        <Route path="/notes" element={<OptionNotes />} />
        <Route path="/knowledge" element={<OptionKnowledgeWorkspace />} />
        <Route path="/world-books" element={<OptionWorldBooksWorkspace />} />
        <Route path="/dictionaries" element={<OptionDictionariesWorkspace />} />
        <Route path="/characters" element={<OptionCharactersWorkspace />} />
        <Route path="/prompts" element={<OptionPromptsWorkspace />} />
        <Route path="/prompt-studio" element={<OptionPromptStudio />} />
        <Route path="/tts" element={<OptionTts />} />
        <Route path="/stt" element={<OptionStt />} />
        <Route path="/speech" element={<OptionSpeech />} />
        <Route path="/evaluations" element={<OptionEvaluations />} />
        <Route path="/admin/server" element={<OptionAdminServer />} />
        <Route path="/admin/llamacpp" element={<OptionAdminLlamacpp />} />
        <Route path="/admin/mlx" element={<OptionAdminMlx />} />
        <Route path="/quick-chat-popout" element={<OptionQuickChatPopout />} />
      </Routes>
    </Suspense>
  )
}

export const SidepanelRoutingChrome = () => {
  return (
    <Suspense fallback={<RouteLoading />}>
      <Routes>
        <Route path="/" element={<SidepanelChat />} />
        <Route path="/agent" element={<SidepanelAgent />} />
        <Route path="/settings" element={<SidepanelSettings />} />
        {/* Test route for E2E testing of error boundary */}
        <Route path="/error-boundary-test" element={<SidepanelErrorBoundaryTest />} />
      </Routes>
    </Suspense>
  )
}
