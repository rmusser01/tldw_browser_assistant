import { lazy } from "react"
import type { ReactElement } from "react"
import type { LucideIcon } from "lucide-react"
import {
  ActivityIcon,
  BookIcon,
  BookMarked,
  BookOpen,
  BookText,
  BrainCircuitIcon,
  CombineIcon,
  CpuIcon,
  Gauge,
  InfoIcon,
  OrbitIcon,
  ServerIcon,
  ShareIcon,
  Layers,
  StickyNote,
  Microscope,
  FlaskConical,
  MessageSquare,
  ClipboardList
} from "lucide-react"
import { ALL_TARGETS, type PlatformTarget } from "@/config/platform"
import OptionLayout from "~/components/Layouts/Layout"
import { OnboardingWizard } from "@/components/Option/Onboarding/OnboardingWizard"

export type RouteKind = "options" | "sidepanel"

export type NavGroupKey = "server" | "knowledge" | "workspace" | "about"

type RouteNav = {
  group: NavGroupKey
  labelToken: string
  icon: LucideIcon
  order: number
  beta?: boolean
}

export type RouteDefinition = {
  kind: RouteKind
  path: string
  element: ReactElement
  targets?: PlatformTarget[]
  nav?: RouteNav
}

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
const OptionTldwSettings = lazy(() =>
  import("./option-settings-tldw").then((m) => ({ default: m.OptionTldwSettings }))
)
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

export const ROUTE_DEFINITIONS: RouteDefinition[] = [
  { kind: "options", path: "/", element: <OptionIndex /> },
  {
    kind: "options",
    path: "/onboarding-test",
    element: (
      <OptionLayout hideHeader={true} showHeaderSelectors={false}>
        <OnboardingWizard />
      </OptionLayout>
    ),
    targets: ALL_TARGETS
  },
  {
    kind: "options",
    path: "/settings",
    element: <OptionSettings />,
    nav: {
      group: "server",
      labelToken: "settings:generalSettings.title",
      icon: OrbitIcon,
      order: 2
    }
  },
  {
    kind: "options",
    path: "/settings/tldw",
    element: <OptionTldwSettings />,
    nav: {
      group: "server",
      labelToken: "settings:tldw.serverNav",
      icon: ServerIcon,
      order: 1
    }
  },
  {
    kind: "options",
    path: "/settings/model",
    element: <OptionModal />,
    nav: {
      group: "server",
      labelToken: "settings:manageModels.title",
      icon: BrainCircuitIcon,
      order: 5
    }
  },
  {
    kind: "options",
    path: "/settings/prompt",
    element: <OptionPrompt />,
    nav: {
      group: "workspace",
      labelToken: "settings:managePrompts.title",
      icon: BookIcon,
      order: 6
    }
  },
  {
    kind: "options",
    path: "/settings/evaluations",
    element: <OptionSettingsEvaluations />,
    nav: {
      group: "server",
      labelToken: "settings:evaluationsSettings.title",
      icon: FlaskConical,
      order: 8,
      beta: true
    }
  },
  {
    kind: "options",
    path: "/settings/chat",
    element: <OptionChatSettings />,
    nav: {
      group: "server",
      labelToken: "settings:chatSettingsNav",
      icon: MessageSquare,
      order: 3
    }
  },
  {
    kind: "options",
    path: "/settings/share",
    element: <OptionShare />,
    nav: {
      group: "workspace",
      labelToken: "settings:manageShare.title",
      icon: ShareIcon,
      order: 7
    }
  },
  { kind: "options", path: "/settings/processed", element: <OptionProcessed /> },
  {
    kind: "options",
    path: "/settings/health",
    element: <OptionHealth />,
    nav: {
      group: "server",
      labelToken: "settings:healthNav",
      icon: ActivityIcon,
      order: 10
    }
  },
  {
    kind: "options",
    path: "/settings/prompt-studio",
    element: <OptionSettingsPromptStudio />,
    nav: {
      group: "server",
      labelToken: "settings:promptStudio.nav",
      icon: Microscope,
      order: 9,
      beta: true
    }
  },
  {
    kind: "options",
    path: "/settings/knowledge",
    element: <OptionKnowledgeBase />,
    nav: {
      group: "knowledge",
      labelToken: "settings:manageKnowledge.title",
      icon: BookText,
      order: 1
    }
  },
  {
    kind: "options",
    path: "/settings/chatbooks",
    element: <OptionChatbooks />,
    nav: {
      group: "knowledge",
      labelToken: "settings:chatbooksNav",
      icon: BookText,
      order: 4
    }
  },
  {
    kind: "options",
    path: "/settings/characters",
    element: <OptionCharacters />,
    nav: {
      group: "knowledge",
      labelToken: "settings:charactersNav",
      icon: BookIcon,
      order: 5
    }
  },
  {
    kind: "options",
    path: "/settings/world-books",
    element: <OptionWorldBooks />,
    nav: {
      group: "knowledge",
      labelToken: "settings:worldBooksNav",
      icon: BookOpen,
      order: 2
    }
  },
  {
    kind: "options",
    path: "/settings/chat-dictionaries",
    element: <OptionDictionaries />,
    nav: {
      group: "knowledge",
      labelToken: "settings:chatDictionariesNav",
      icon: BookMarked,
      order: 3
    }
  },
  {
    kind: "options",
    path: "/settings/rag",
    element: <OptionRagSettings />,
    nav: {
      group: "server",
      labelToken: "settings:rag.title",
      icon: CombineIcon,
      order: 4
    }
  },
  { kind: "options", path: "/chunking-playground", element: <OptionChunkingPlayground /> },
  {
    kind: "options",
    path: "/settings/about",
    element: <OptionAbout />,
    nav: {
      group: "about",
      labelToken: "settings:about.title",
      icon: InfoIcon,
      order: 1
    }
  },
  { kind: "options", path: "/review", element: <OptionMediaMulti /> },
  {
    kind: "options",
    path: "/flashcards",
    element: <OptionFlashcards />,
    nav: {
      group: "workspace",
      labelToken: "option:header.flashcards",
      icon: Layers,
      order: 4
    }
  },
  {
    kind: "options",
    path: "/quiz",
    element: <OptionQuiz />,
    targets: ALL_TARGETS,
    nav: {
      group: "workspace",
      labelToken: "option:header.quiz",
      icon: ClipboardList,
      order: 5,
      beta: true
    }
  },
  {
    kind: "options",
    path: "/media",
    element: <OptionMedia />,
    nav: {
      group: "knowledge",
      labelToken: "settings:mediaNav",
      icon: BookText,
      order: 6
    }
  },
  {
    kind: "options",
    path: "/media-multi",
    element: <OptionMediaMulti />,
    nav: {
      group: "workspace",
      labelToken: "option:header.review",
      icon: Microscope,
      order: 1
    }
  },
  {
    kind: "options",
    path: "/content-review",
    element: <OptionContentReview />,
    nav: {
      group: "workspace",
      labelToken: "option:header.contentReview",
      icon: BookText,
      order: 2
    }
  },
  {
    kind: "options",
    path: "/notes",
    element: <OptionNotes />,
    nav: {
      group: "workspace",
      labelToken: "option:header.notes",
      icon: StickyNote,
      order: 3
    }
  },
  { kind: "options", path: "/knowledge", element: <OptionKnowledgeWorkspace /> },
  { kind: "options", path: "/world-books", element: <OptionWorldBooksWorkspace /> },
  { kind: "options", path: "/dictionaries", element: <OptionDictionariesWorkspace /> },
  { kind: "options", path: "/characters", element: <OptionCharactersWorkspace /> },
  { kind: "options", path: "/prompts", element: <OptionPromptsWorkspace /> },
  { kind: "options", path: "/prompt-studio", element: <OptionPromptStudio /> },
  { kind: "options", path: "/tts", element: <OptionTts /> },
  { kind: "options", path: "/stt", element: <OptionStt /> },
  { kind: "options", path: "/speech", element: <OptionSpeech /> },
  { kind: "options", path: "/evaluations", element: <OptionEvaluations /> },
  {
    kind: "options",
    path: "/admin/server",
    element: <OptionAdminServer />,
    targets: ALL_TARGETS
  },
  {
    kind: "options",
    path: "/admin/llamacpp",
    element: <OptionAdminLlamacpp />,
    targets: ALL_TARGETS,
    nav: {
      group: "server",
      labelToken: "option:header.adminLlamacpp",
      icon: CpuIcon,
      order: 6
    }
  },
  {
    kind: "options",
    path: "/admin/mlx",
    element: <OptionAdminMlx />,
    targets: ALL_TARGETS,
    nav: {
      group: "server",
      labelToken: "option:header.adminMlx",
      icon: Gauge,
      order: 7
    }
  },
  {
    kind: "options",
    path: "/quick-chat-popout",
    element: <OptionQuickChatPopout />,
    targets: ALL_TARGETS
  },
  { kind: "sidepanel", path: "/", element: <SidepanelChat /> },
  {
    kind: "sidepanel",
    path: "/agent",
    element: <SidepanelAgent />,
    targets: ALL_TARGETS
  },
  { kind: "sidepanel", path: "/settings", element: <SidepanelSettings /> },
  {
    kind: "sidepanel",
    path: "/error-boundary-test",
    element: <SidepanelErrorBoundaryTest />,
    targets: ALL_TARGETS
  }
]

export const optionRoutes = ROUTE_DEFINITIONS.filter(
  (route) => route.kind === "options"
)

export const sidepanelRoutes = ROUTE_DEFINITIONS.filter(
  (route) => route.kind === "sidepanel"
)
