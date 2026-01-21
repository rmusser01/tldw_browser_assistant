/**
 * Watchlists Zustand store
 * Manages state for the Watchlists Playground page
 */

import { createWithEqualityFn } from "zustand/traditional"
import type {
  WatchlistGroup,
  WatchlistJob,
  WatchlistOutput,
  WatchlistRun,
  WatchlistSettings,
  WatchlistSource,
  WatchlistTab,
  WatchlistTag,
  WatchlistTemplate
} from "@/types/watchlists"

// ─────────────────────────────────────────────────────────────────────────────
// State Types
// ─────────────────────────────────────────────────────────────────────────────

interface SourcesState {
  sources: WatchlistSource[]
  sourcesLoading: boolean
  sourcesError: string | null
  sourcesTotal: number
  groups: WatchlistGroup[]
  groupsLoading: boolean
  tags: WatchlistTag[]
  tagsLoading: boolean
  selectedGroupId: number | null
  selectedTagName: string | null
  sourcesSearch: string
  sourcesPage: number
  sourcesPageSize: number
}

interface JobsState {
  jobs: WatchlistJob[]
  jobsLoading: boolean
  jobsError: string | null
  jobsTotal: number
  selectedJobId: number | null
  jobsPage: number
  jobsPageSize: number
}

interface RunsState {
  runs: WatchlistRun[]
  runsLoading: boolean
  runsError: string | null
  runsTotal: number
  selectedRunId: number | null
  runsJobFilter: number | null
  runsStatusFilter: string | null
  runsPage: number
  runsPageSize: number
  pollingActive: boolean
}

interface OutputsState {
  outputs: WatchlistOutput[]
  outputsLoading: boolean
  outputsError: string | null
  outputsTotal: number
  selectedOutputId: number | null
  outputsJobFilter: number | null
  outputsRunFilter: number | null
  outputsPage: number
  outputsPageSize: number
}

interface TemplatesState {
  templates: WatchlistTemplate[]
  templatesLoading: boolean
  templatesError: string | null
  selectedTemplateName: string | null
}

interface SettingsState {
  settings: WatchlistSettings | null
  settingsLoading: boolean
  settingsError: string | null
}

interface UIState {
  activeTab: WatchlistTab
  sourceFormOpen: boolean
  sourceFormEditId: number | null
  jobFormOpen: boolean
  jobFormEditId: number | null
  runDetailOpen: boolean
  outputPreviewOpen: boolean
  templateEditorOpen: boolean
  templateEditorName: string | null
}

// ─────────────────────────────────────────────────────────────────────────────
// Actions Types
// ─────────────────────────────────────────────────────────────────────────────

interface SourcesActions {
  setSources: (sources: WatchlistSource[], total?: number) => void
  setSourcesLoading: (loading: boolean) => void
  setSourcesError: (error: string | null) => void
  setGroups: (groups: WatchlistGroup[]) => void
  setGroupsLoading: (loading: boolean) => void
  setTags: (tags: WatchlistTag[]) => void
  setTagsLoading: (loading: boolean) => void
  setSelectedGroupId: (id: number | null) => void
  setSelectedTagName: (name: string | null) => void
  setSourcesSearch: (search: string) => void
  setSourcesPage: (page: number) => void
  setSourcesPageSize: (size: number) => void
  addSource: (source: WatchlistSource) => void
  updateSourceInList: (sourceId: number, updates: Partial<WatchlistSource>) => void
  removeSource: (sourceId: number) => void
}

interface JobsActions {
  setJobs: (jobs: WatchlistJob[], total?: number) => void
  setJobsLoading: (loading: boolean) => void
  setJobsError: (error: string | null) => void
  setSelectedJobId: (id: number | null) => void
  setJobsPage: (page: number) => void
  setJobsPageSize: (size: number) => void
  addJob: (job: WatchlistJob) => void
  updateJobInList: (jobId: number, updates: Partial<WatchlistJob>) => void
  removeJob: (jobId: number) => void
}

interface RunsActions {
  setRuns: (runs: WatchlistRun[], total?: number) => void
  setRunsLoading: (loading: boolean) => void
  setRunsError: (error: string | null) => void
  setSelectedRunId: (id: number | null) => void
  setRunsJobFilter: (jobId: number | null) => void
  setRunsStatusFilter: (status: string | null) => void
  setRunsPage: (page: number) => void
  setRunsPageSize: (size: number) => void
  setPollingActive: (active: boolean) => void
  addRun: (run: WatchlistRun) => void
  updateRunInList: (runId: number, updates: Partial<WatchlistRun>) => void
}

interface OutputsActions {
  setOutputs: (outputs: WatchlistOutput[], total?: number) => void
  setOutputsLoading: (loading: boolean) => void
  setOutputsError: (error: string | null) => void
  setSelectedOutputId: (id: number | null) => void
  setOutputsJobFilter: (jobId: number | null) => void
  setOutputsRunFilter: (runId: number | null) => void
  setOutputsPage: (page: number) => void
  setOutputsPageSize: (size: number) => void
  addOutput: (output: WatchlistOutput) => void
}

interface TemplatesActions {
  setTemplates: (templates: WatchlistTemplate[]) => void
  setTemplatesLoading: (loading: boolean) => void
  setTemplatesError: (error: string | null) => void
  setSelectedTemplateName: (name: string | null) => void
  addTemplate: (template: WatchlistTemplate) => void
  removeTemplate: (name: string) => void
}

interface SettingsActions {
  setSettings: (settings: WatchlistSettings | null) => void
  setSettingsLoading: (loading: boolean) => void
  setSettingsError: (error: string | null) => void
}

interface UIActions {
  setActiveTab: (tab: WatchlistTab) => void
  openSourceForm: (editId?: number | null) => void
  closeSourceForm: () => void
  openJobForm: (editId?: number | null) => void
  closeJobForm: () => void
  openRunDetail: (runId: number) => void
  closeRunDetail: () => void
  openOutputPreview: (outputId: number) => void
  closeOutputPreview: () => void
  openTemplateEditor: (name?: string | null) => void
  closeTemplateEditor: () => void
  resetStore: () => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Combined State & Actions
// ─────────────────────────────────────────────────────────────────────────────

export type WatchlistsState = SourcesState &
  JobsState &
  RunsState &
  OutputsState &
  TemplatesState &
  SettingsState &
  UIState &
  SourcesActions &
  JobsActions &
  RunsActions &
  OutputsActions &
  TemplatesActions &
  SettingsActions &
  UIActions

// ─────────────────────────────────────────────────────────────────────────────
// Initial State
// ─────────────────────────────────────────────────────────────────────────────

const initialSourcesState: SourcesState = {
  sources: [],
  sourcesLoading: false,
  sourcesError: null,
  sourcesTotal: 0,
  groups: [],
  groupsLoading: false,
  tags: [],
  tagsLoading: false,
  selectedGroupId: null,
  selectedTagName: null,
  sourcesSearch: "",
  sourcesPage: 1,
  sourcesPageSize: 20
}

const initialJobsState: JobsState = {
  jobs: [],
  jobsLoading: false,
  jobsError: null,
  jobsTotal: 0,
  selectedJobId: null,
  jobsPage: 1,
  jobsPageSize: 20
}

const initialRunsState: RunsState = {
  runs: [],
  runsLoading: false,
  runsError: null,
  runsTotal: 0,
  selectedRunId: null,
  runsJobFilter: null,
  runsStatusFilter: null,
  runsPage: 1,
  runsPageSize: 20,
  pollingActive: false
}

const initialOutputsState: OutputsState = {
  outputs: [],
  outputsLoading: false,
  outputsError: null,
  outputsTotal: 0,
  selectedOutputId: null,
  outputsJobFilter: null,
  outputsRunFilter: null,
  outputsPage: 1,
  outputsPageSize: 20
}

const initialTemplatesState: TemplatesState = {
  templates: [],
  templatesLoading: false,
  templatesError: null,
  selectedTemplateName: null
}

const initialSettingsState: SettingsState = {
  settings: null,
  settingsLoading: false,
  settingsError: null
}

const initialUIState: UIState = {
  activeTab: "sources",
  sourceFormOpen: false,
  sourceFormEditId: null,
  jobFormOpen: false,
  jobFormEditId: null,
  runDetailOpen: false,
  outputPreviewOpen: false,
  templateEditorOpen: false,
  templateEditorName: null
}

const initialState = {
  ...initialSourcesState,
  ...initialJobsState,
  ...initialRunsState,
  ...initialOutputsState,
  ...initialTemplatesState,
  ...initialSettingsState,
  ...initialUIState
}

// ─────────────────────────────────────────────────────────────────────────────
// Store
// ─────────────────────────────────────────────────────────────────────────────

export const useWatchlistsStore = createWithEqualityFn<WatchlistsState>()((set) => ({
  ...initialState,

  // ─────────────────────────────────────────────────────────────────────────
  // Sources Actions
  // ─────────────────────────────────────────────────────────────────────────

  setSources: (sources, total) =>
    set({ sources, sourcesTotal: total ?? sources.length }),
  setSourcesLoading: (sourcesLoading) => set({ sourcesLoading }),
  setSourcesError: (sourcesError) => set({ sourcesError }),
  setGroups: (groups) => set({ groups }),
  setGroupsLoading: (groupsLoading) => set({ groupsLoading }),
  setTags: (tags) => set({ tags }),
  setTagsLoading: (tagsLoading) => set({ tagsLoading }),
  setSelectedGroupId: (selectedGroupId) =>
    set({ selectedGroupId, sourcesPage: 1 }),
  setSelectedTagName: (selectedTagName) =>
    set({ selectedTagName, sourcesPage: 1 }),
  setSourcesSearch: (sourcesSearch) => set({ sourcesSearch, sourcesPage: 1 }),
  setSourcesPage: (sourcesPage) => set({ sourcesPage }),
  setSourcesPageSize: (sourcesPageSize) =>
    set({ sourcesPageSize, sourcesPage: 1 }),

  addSource: (source) =>
    set((state) => ({
      sources: [source, ...state.sources],
      sourcesTotal: state.sourcesTotal + 1
    })),

  updateSourceInList: (sourceId, updates) =>
    set((state) => ({
      sources: state.sources.map((s) =>
        s.id === sourceId ? { ...s, ...updates } : s
      )
    })),

  removeSource: (sourceId) =>
    set((state) => ({
      sources: state.sources.filter((s) => s.id !== sourceId),
      sourcesTotal: Math.max(0, state.sourcesTotal - 1)
    })),

  // ─────────────────────────────────────────────────────────────────────────
  // Jobs Actions
  // ─────────────────────────────────────────────────────────────────────────

  setJobs: (jobs, total) => set({ jobs, jobsTotal: total ?? jobs.length }),
  setJobsLoading: (jobsLoading) => set({ jobsLoading }),
  setJobsError: (jobsError) => set({ jobsError }),
  setSelectedJobId: (selectedJobId) => set({ selectedJobId }),
  setJobsPage: (jobsPage) => set({ jobsPage }),
  setJobsPageSize: (jobsPageSize) => set({ jobsPageSize, jobsPage: 1 }),

  addJob: (job) =>
    set((state) => ({
      jobs: [job, ...state.jobs],
      jobsTotal: state.jobsTotal + 1
    })),

  updateJobInList: (jobId, updates) =>
    set((state) => ({
      jobs: state.jobs.map((j) => (j.id === jobId ? { ...j, ...updates } : j))
    })),

  removeJob: (jobId) =>
    set((state) => ({
      jobs: state.jobs.filter((j) => j.id !== jobId),
      jobsTotal: Math.max(0, state.jobsTotal - 1)
    })),

  // ─────────────────────────────────────────────────────────────────────────
  // Runs Actions
  // ─────────────────────────────────────────────────────────────────────────

  setRuns: (runs, total) => set({ runs, runsTotal: total ?? runs.length }),
  setRunsLoading: (runsLoading) => set({ runsLoading }),
  setRunsError: (runsError) => set({ runsError }),
  setSelectedRunId: (selectedRunId) => set({ selectedRunId }),
  setRunsJobFilter: (runsJobFilter) => set({ runsJobFilter, runsPage: 1 }),
  setRunsStatusFilter: (runsStatusFilter) =>
    set({ runsStatusFilter, runsPage: 1 }),
  setRunsPage: (runsPage) => set({ runsPage }),
  setRunsPageSize: (runsPageSize) => set({ runsPageSize, runsPage: 1 }),
  setPollingActive: (pollingActive) => set({ pollingActive }),

  addRun: (run) =>
    set((state) => ({
      runs: [run, ...state.runs],
      runsTotal: state.runsTotal + 1
    })),

  updateRunInList: (runId, updates) =>
    set((state) => ({
      runs: state.runs.map((r) => (r.id === runId ? { ...r, ...updates } : r))
    })),

  // ─────────────────────────────────────────────────────────────────────────
  // Outputs Actions
  // ─────────────────────────────────────────────────────────────────────────

  setOutputs: (outputs, total) =>
    set({ outputs, outputsTotal: total ?? outputs.length }),
  setOutputsLoading: (outputsLoading) => set({ outputsLoading }),
  setOutputsError: (outputsError) => set({ outputsError }),
  setSelectedOutputId: (selectedOutputId) => set({ selectedOutputId }),
  setOutputsJobFilter: (outputsJobFilter) =>
    set({ outputsJobFilter, outputsPage: 1 }),
  setOutputsRunFilter: (outputsRunFilter) =>
    set({ outputsRunFilter, outputsPage: 1 }),
  setOutputsPage: (outputsPage) => set({ outputsPage }),
  setOutputsPageSize: (outputsPageSize) =>
    set({ outputsPageSize, outputsPage: 1 }),

  addOutput: (output) =>
    set((state) => ({
      outputs: [output, ...state.outputs],
      outputsTotal: state.outputsTotal + 1
    })),

  // ─────────────────────────────────────────────────────────────────────────
  // Templates Actions
  // ─────────────────────────────────────────────────────────────────────────

  setTemplates: (templates) => set({ templates }),
  setTemplatesLoading: (templatesLoading) => set({ templatesLoading }),
  setTemplatesError: (templatesError) => set({ templatesError }),
  setSelectedTemplateName: (selectedTemplateName) =>
    set({ selectedTemplateName }),

  addTemplate: (template) =>
    set((state) => ({
      templates: [template, ...state.templates]
    })),

  removeTemplate: (name) =>
    set((state) => ({
      templates: state.templates.filter((t) => t.name !== name)
    })),

  // ─────────────────────────────────────────────────────────────────────────
  // Settings Actions
  // ─────────────────────────────────────────────────────────────────────────

  setSettings: (settings) => set({ settings }),
  setSettingsLoading: (settingsLoading) => set({ settingsLoading }),
  setSettingsError: (settingsError) => set({ settingsError }),

  // ─────────────────────────────────────────────────────────────────────────
  // UI Actions
  // ─────────────────────────────────────────────────────────────────────────

  setActiveTab: (activeTab) => set({ activeTab }),

  openSourceForm: (editId = null) =>
    set({ sourceFormOpen: true, sourceFormEditId: editId }),
  closeSourceForm: () =>
    set({ sourceFormOpen: false, sourceFormEditId: null }),

  openJobForm: (editId = null) =>
    set({ jobFormOpen: true, jobFormEditId: editId }),
  closeJobForm: () => set({ jobFormOpen: false, jobFormEditId: null }),

  openRunDetail: (runId) =>
    set({ runDetailOpen: true, selectedRunId: runId }),
  closeRunDetail: () => set({ runDetailOpen: false }),

  openOutputPreview: (outputId) =>
    set({ outputPreviewOpen: true, selectedOutputId: outputId }),
  closeOutputPreview: () => set({ outputPreviewOpen: false }),

  openTemplateEditor: (name = null) =>
    set({ templateEditorOpen: true, templateEditorName: name }),
  closeTemplateEditor: () =>
    set({ templateEditorOpen: false, templateEditorName: null }),

  resetStore: () => set(initialState)
}))

// Expose for debugging
if (typeof window !== "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(window as any).__tldw_useWatchlistsStore = useWatchlistsStore
}
