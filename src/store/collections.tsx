/**
 * Collections Zustand Store
 * Manages state for the Collections Playground feature
 */

import { createWithEqualityFn } from "zustand/traditional"
import type {
  CollectionsTab,
  ReadingItemSummary,
  ReadingItem,
  ReadingStatus,
  Highlight,
  HighlightColor,
  OutputTemplate,
  TemplateType,
  TemplateFormat,
  ImportSource,
  ExportFormat as CollectionExportFormat
} from "@/types/collections"

// ─────────────────────────────────────────────────────────────────────────────
// State Types
// ─────────────────────────────────────────────────────────────────────────────

interface ReadingListState {
  items: ReadingItemSummary[]
  itemsLoading: boolean
  itemsError: string | null
  itemsTotal: number
  itemsPage: number
  itemsPageSize: number
  itemsSearch: string
  selectedItemId: string | null
  currentItem: ReadingItem | null
  currentItemLoading: boolean
  // Filters
  filterStatus: ReadingStatus | "all"
  filterTags: string[]
  filterFavorite: boolean | null
  filterDomain: string
  filterDateFrom: string | null
  filterDateTo: string | null
  sortBy: "created_at" | "updated_at" | "title" | "relevance"
  sortOrder: "asc" | "desc"
  // All available tags for filter dropdown
  availableTags: string[]
}

interface HighlightsState {
  highlights: Highlight[]
  highlightsLoading: boolean
  highlightsError: string | null
  highlightsTotal: number
  highlightsPage: number
  highlightsPageSize: number
  highlightsSearch: string
  highlightsGroupByItem: boolean
  selectedHighlightId: string | null
  editingHighlight: Partial<Highlight> | null
  // Filters
  filterColor: HighlightColor | "all"
  filterItemId: string | null
}

interface TemplatesState {
  templates: OutputTemplate[]
  templatesLoading: boolean
  templatesError: string | null
  templatesTotal: number
  selectedTemplateId: string | null
  currentTemplate: OutputTemplate | null
  editingTemplate: Partial<OutputTemplate> | null
  previewContent: string | null
  previewLoading: boolean
  previewError: string | null
  // Generation
  selectedItemsForGeneration: string[]
  generationLoading: boolean
  generatedContent: string | null
  generatedFormat: TemplateFormat | null
}

interface ImportExportState {
  // Import wizard
  importSource: ImportSource | null
  importFile: File | null
  importInProgress: boolean
  importError: string | null
  importResult: { imported: number; updated: number; skipped: number; errors: string[] } | null
  // Export
  exportFormat: CollectionExportFormat
  exportInProgress: boolean
  exportError: string | null
}

interface UIState {
  activeTab: CollectionsTab
  itemDetailOpen: boolean
  addUrlModalOpen: boolean
  highlightEditorOpen: boolean
  templateEditorOpen: boolean
  importWizardStep: "source" | "upload" | "result"
  deleteConfirmOpen: boolean
  deleteTargetId: string | null
  deleteTargetType: "item" | "highlight" | "template" | null
}

// ─────────────────────────────────────────────────────────────────────────────
// Actions Types
// ─────────────────────────────────────────────────────────────────────────────

interface ReadingListActions {
  setItems: (items: ReadingItemSummary[], total?: number) => void
  setItemsLoading: (loading: boolean) => void
  setItemsError: (error: string | null) => void
  setItemsPage: (page: number) => void
  setItemsPageSize: (size: number) => void
  setItemsSearch: (search: string) => void
  setSelectedItemId: (id: string | null) => void
  setCurrentItem: (item: ReadingItem | null) => void
  setCurrentItemLoading: (loading: boolean) => void
  setFilterStatus: (status: ReadingStatus | "all") => void
  setFilterTags: (tags: string[]) => void
  setFilterFavorite: (favorite: boolean | null) => void
  setFilterDomain: (domain: string) => void
  setFilterDateRange: (from: string | null, to: string | null) => void
  setSortBy: (sortBy: "created_at" | "updated_at" | "title" | "relevance") => void
  setSortOrder: (order: "asc" | "desc") => void
  setAvailableTags: (tags: string[]) => void
  addItem: (item: ReadingItemSummary) => void
  updateItemInList: (id: string, updates: Partial<ReadingItemSummary>) => void
  removeItem: (id: string) => void
  resetFilters: () => void
}

interface HighlightsActions {
  setHighlights: (highlights: Highlight[], total?: number) => void
  setHighlightsLoading: (loading: boolean) => void
  setHighlightsError: (error: string | null) => void
  setHighlightsPage: (page: number) => void
  setHighlightsPageSize: (size: number) => void
  setHighlightsSearch: (search: string) => void
  setHighlightsGroupByItem: (groupByItem: boolean) => void
  setSelectedHighlightId: (id: string | null) => void
  setEditingHighlight: (highlight: Partial<Highlight> | null) => void
  setFilterColor: (color: HighlightColor | "all") => void
  setFilterItemId: (itemId: string | null) => void
  addHighlight: (highlight: Highlight) => void
  updateHighlightInList: (id: string, updates: Partial<Highlight>) => void
  removeHighlight: (id: string) => void
}

interface TemplatesActions {
  setTemplates: (templates: OutputTemplate[], total?: number) => void
  setTemplatesLoading: (loading: boolean) => void
  setTemplatesError: (error: string | null) => void
  setSelectedTemplateId: (id: string | null) => void
  setCurrentTemplate: (template: OutputTemplate | null) => void
  setEditingTemplate: (template: Partial<OutputTemplate> | null) => void
  setPreviewContent: (content: string | null) => void
  setPreviewLoading: (loading: boolean) => void
  setPreviewError: (error: string | null) => void
  setSelectedItemsForGeneration: (ids: string[]) => void
  toggleItemForGeneration: (id: string) => void
  setGenerationLoading: (loading: boolean) => void
  setGeneratedContent: (content: string | null, format?: TemplateFormat | null) => void
  addTemplate: (template: OutputTemplate) => void
  updateTemplateInList: (id: string, updates: Partial<OutputTemplate>) => void
  removeTemplate: (id: string) => void
}

interface ImportExportActions {
  // Import
  setImportSource: (source: ImportSource | null) => void
  setImportFile: (file: File | null) => void
  setImportInProgress: (inProgress: boolean) => void
  setImportError: (error: string | null) => void
  setImportResult: (result: { imported: number; updated: number; skipped: number; errors: string[] } | null) => void
  resetImportWizard: () => void
  // Export
  setExportFormat: (format: CollectionExportFormat) => void
  setExportInProgress: (inProgress: boolean) => void
  setExportError: (error: string | null) => void
  resetExport: () => void
}

interface UIActions {
  setActiveTab: (tab: CollectionsTab) => void
  openItemDetail: (id: string) => void
  closeItemDetail: () => void
  openAddUrlModal: () => void
  closeAddUrlModal: () => void
  openHighlightEditor: (highlight?: Partial<Highlight>) => void
  closeHighlightEditor: () => void
  openTemplateEditor: (template?: OutputTemplate) => void
  closeTemplateEditor: () => void
  setImportWizardStep: (step: "source" | "upload" | "result") => void
  openDeleteConfirm: (id: string, type: "item" | "highlight" | "template") => void
  closeDeleteConfirm: () => void
  resetStore: () => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Combined State & Actions
// ─────────────────────────────────────────────────────────────────────────────

export type CollectionsState = ReadingListState &
  HighlightsState &
  TemplatesState &
  ImportExportState &
  UIState &
  ReadingListActions &
  HighlightsActions &
  TemplatesActions &
  ImportExportActions &
  UIActions

// ─────────────────────────────────────────────────────────────────────────────
// Initial State
// ─────────────────────────────────────────────────────────────────────────────

const initialReadingListState: ReadingListState = {
  items: [],
  itemsLoading: false,
  itemsError: null,
  itemsTotal: 0,
  itemsPage: 1,
  itemsPageSize: 20,
  itemsSearch: "",
  selectedItemId: null,
  currentItem: null,
  currentItemLoading: false,
  filterStatus: "all",
  filterTags: [],
  filterFavorite: null,
  filterDomain: "",
  filterDateFrom: null,
  filterDateTo: null,
  sortBy: "created_at",
  sortOrder: "desc",
  availableTags: []
}

const initialHighlightsState: HighlightsState = {
  highlights: [],
  highlightsLoading: false,
  highlightsError: null,
  highlightsTotal: 0,
  highlightsPage: 1,
  highlightsPageSize: 20,
  highlightsSearch: "",
  highlightsGroupByItem: false,
  selectedHighlightId: null,
  editingHighlight: null,
  filterColor: "all",
  filterItemId: null
}

const initialTemplatesState: TemplatesState = {
  templates: [],
  templatesLoading: false,
  templatesError: null,
  templatesTotal: 0,
  selectedTemplateId: null,
  currentTemplate: null,
  editingTemplate: null,
  previewContent: null,
  previewLoading: false,
  previewError: null,
  selectedItemsForGeneration: [],
  generationLoading: false,
  generatedContent: null,
  generatedFormat: null
}

const initialImportExportState: ImportExportState = {
  importSource: null,
  importFile: null,
  importInProgress: false,
  importError: null,
  importResult: null,
  exportFormat: "jsonl",
  exportInProgress: false,
  exportError: null
}

const initialUIState: UIState = {
  activeTab: "reading",
  itemDetailOpen: false,
  addUrlModalOpen: false,
  highlightEditorOpen: false,
  templateEditorOpen: false,
  importWizardStep: "source",
  deleteConfirmOpen: false,
  deleteTargetId: null,
  deleteTargetType: null
}

const initialState = {
  ...initialReadingListState,
  ...initialHighlightsState,
  ...initialTemplatesState,
  ...initialImportExportState,
  ...initialUIState
}

// ─────────────────────────────────────────────────────────────────────────────
// Store
// ─────────────────────────────────────────────────────────────────────────────

export const useCollectionsStore = createWithEqualityFn<CollectionsState>()((set) => ({
  ...initialState,

  // ─────────────────────────────────────────────────────────────────────────
  // Reading List Actions
  // ─────────────────────────────────────────────────────────────────────────

  setItems: (items, total) =>
    set({ items, itemsTotal: total ?? items.length }),
  setItemsLoading: (itemsLoading) => set({ itemsLoading }),
  setItemsError: (itemsError) => set({ itemsError }),
  setItemsPage: (itemsPage) => set({ itemsPage }),
  setItemsPageSize: (itemsPageSize) => set({ itemsPageSize, itemsPage: 1 }),
  setItemsSearch: (itemsSearch) => set({ itemsSearch, itemsPage: 1 }),
  setSelectedItemId: (selectedItemId) => set({ selectedItemId }),
  setCurrentItem: (currentItem) => set({ currentItem }),
  setCurrentItemLoading: (currentItemLoading) => set({ currentItemLoading }),
  setFilterStatus: (filterStatus) => set({ filterStatus, itemsPage: 1 }),
  setFilterTags: (filterTags) => set({ filterTags, itemsPage: 1 }),
  setFilterFavorite: (filterFavorite) => set({ filterFavorite, itemsPage: 1 }),
  setFilterDomain: (filterDomain) => set({ filterDomain, itemsPage: 1 }),
  setFilterDateRange: (filterDateFrom, filterDateTo) =>
    set({ filterDateFrom, filterDateTo, itemsPage: 1 }),
  setSortBy: (sortBy) => set({ sortBy, itemsPage: 1 }),
  setSortOrder: (sortOrder) => set({ sortOrder, itemsPage: 1 }),
  setAvailableTags: (availableTags) => set({ availableTags }),

  addItem: (item) =>
    set((state) => ({
      items: [item, ...state.items],
      itemsTotal: state.itemsTotal + 1
    })),

  updateItemInList: (id, updates) =>
    set((state) => ({
      items: state.items.map((item) =>
        item.id === id ? { ...item, ...updates } : item
      ),
      currentItem:
        state.currentItem?.id === id
          ? { ...state.currentItem, ...updates }
          : state.currentItem
    })),

  removeItem: (id) =>
    set((state) => ({
      items: state.items.filter((item) => item.id !== id),
      itemsTotal: Math.max(0, state.itemsTotal - 1),
      selectedItemId: state.selectedItemId === id ? null : state.selectedItemId,
      currentItem: state.currentItem?.id === id ? null : state.currentItem
    })),

  resetFilters: () =>
    set({
      filterStatus: "all",
      filterTags: [],
      filterFavorite: null,
      filterDomain: "",
      filterDateFrom: null,
      filterDateTo: null,
      sortBy: "created_at",
      sortOrder: "desc",
      itemsSearch: "",
      itemsPage: 1
    }),

  // ─────────────────────────────────────────────────────────────────────────
  // Highlights Actions
  // ─────────────────────────────────────────────────────────────────────────

  setHighlights: (highlights, total) =>
    set({ highlights, highlightsTotal: total ?? highlights.length }),
  setHighlightsLoading: (highlightsLoading) => set({ highlightsLoading }),
  setHighlightsError: (highlightsError) => set({ highlightsError }),
  setHighlightsPage: (highlightsPage) => set({ highlightsPage }),
  setHighlightsPageSize: (highlightsPageSize) =>
    set({ highlightsPageSize, highlightsPage: 1 }),
  setHighlightsSearch: (highlightsSearch) =>
    set({ highlightsSearch, highlightsPage: 1 }),
  setHighlightsGroupByItem: (highlightsGroupByItem) =>
    set({ highlightsGroupByItem }),
  setSelectedHighlightId: (selectedHighlightId) => set({ selectedHighlightId }),
  setEditingHighlight: (editingHighlight) => set({ editingHighlight }),
  setFilterColor: (filterColor) => set({ filterColor, highlightsPage: 1 }),
  setFilterItemId: (filterItemId) => set({ filterItemId, highlightsPage: 1 }),

  addHighlight: (highlight) =>
    set((state) => ({
      highlights: [highlight, ...state.highlights],
      highlightsTotal: state.highlightsTotal + 1
    })),

  updateHighlightInList: (id, updates) =>
    set((state) => ({
      highlights: state.highlights.map((h) =>
        h.id === id ? { ...h, ...updates } : h
      ),
      editingHighlight:
        state.editingHighlight?.id === id
          ? { ...state.editingHighlight, ...updates }
          : state.editingHighlight
    })),

  removeHighlight: (id) =>
    set((state) => ({
      highlights: state.highlights.filter((h) => h.id !== id),
      highlightsTotal: Math.max(0, state.highlightsTotal - 1),
      selectedHighlightId:
        state.selectedHighlightId === id ? null : state.selectedHighlightId,
      editingHighlight:
        state.editingHighlight?.id === id ? null : state.editingHighlight
    })),

  // ─────────────────────────────────────────────────────────────────────────
  // Templates Actions
  // ─────────────────────────────────────────────────────────────────────────

  setTemplates: (templates, total) =>
    set({ templates, templatesTotal: total ?? templates.length }),
  setTemplatesLoading: (templatesLoading) => set({ templatesLoading }),
  setTemplatesError: (templatesError) => set({ templatesError }),
  setSelectedTemplateId: (selectedTemplateId) => set({ selectedTemplateId }),
  setCurrentTemplate: (currentTemplate) => set({ currentTemplate }),
  setEditingTemplate: (editingTemplate) => set({ editingTemplate }),
  setPreviewContent: (previewContent) => set({ previewContent }),
  setPreviewLoading: (previewLoading) => set({ previewLoading }),
  setPreviewError: (previewError) => set({ previewError }),
  setSelectedItemsForGeneration: (selectedItemsForGeneration) =>
    set({ selectedItemsForGeneration }),
  toggleItemForGeneration: (id) =>
    set((state) => ({
      selectedItemsForGeneration: state.selectedItemsForGeneration.includes(id)
        ? state.selectedItemsForGeneration.filter((i) => i !== id)
        : [...state.selectedItemsForGeneration, id]
    })),
  setGenerationLoading: (generationLoading) => set({ generationLoading }),
  setGeneratedContent: (generatedContent, generatedFormat = null) =>
    set({ generatedContent, generatedFormat }),

  addTemplate: (template) =>
    set((state) => ({
      templates: [template, ...state.templates],
      templatesTotal: state.templatesTotal + 1
    })),

  updateTemplateInList: (id, updates) =>
    set((state) => ({
      templates: state.templates.map((t) =>
        t.id === id ? { ...t, ...updates } : t
      ),
      currentTemplate:
        state.currentTemplate?.id === id
          ? { ...state.currentTemplate, ...updates }
          : state.currentTemplate
    })),

  removeTemplate: (id) =>
    set((state) => ({
      templates: state.templates.filter((t) => t.id !== id),
      templatesTotal: Math.max(0, state.templatesTotal - 1),
      selectedTemplateId:
        state.selectedTemplateId === id ? null : state.selectedTemplateId,
      currentTemplate:
        state.currentTemplate?.id === id ? null : state.currentTemplate
    })),

  // ─────────────────────────────────────────────────────────────────────────
  // Import/Export Actions
  // ─────────────────────────────────────────────────────────────────────────

  setImportSource: (importSource) => set({ importSource }),
  setImportFile: (importFile) => set({ importFile }),
  setImportInProgress: (importInProgress) => set({ importInProgress }),
  setImportError: (importError) => set({ importError }),
  setImportResult: (importResult) => set({ importResult }),

  resetImportWizard: () =>
    set({
      importSource: null,
      importFile: null,
      importInProgress: false,
      importError: null,
      importResult: null,
      importWizardStep: "source"
    }),

  setExportFormat: (exportFormat) => set({ exportFormat }),
  setExportInProgress: (exportInProgress) => set({ exportInProgress }),
  setExportError: (exportError) => set({ exportError }),

  resetExport: () =>
    set({
      exportFormat: "jsonl",
      exportInProgress: false,
      exportError: null
    }),

  // ─────────────────────────────────────────────────────────────────────────
  // UI Actions
  // ─────────────────────────────────────────────────────────────────────────

  setActiveTab: (activeTab) => set({ activeTab }),

  openItemDetail: (id) =>
    set({ itemDetailOpen: true, selectedItemId: id }),

  closeItemDetail: () =>
    set({ itemDetailOpen: false, selectedItemId: null, currentItem: null }),

  openAddUrlModal: () => set({ addUrlModalOpen: true }),

  closeAddUrlModal: () => set({ addUrlModalOpen: false }),

  openHighlightEditor: (highlight) =>
    set({
      highlightEditorOpen: true,
      editingHighlight: highlight ?? null
    }),

  closeHighlightEditor: () =>
    set({ highlightEditorOpen: false, editingHighlight: null }),

  openTemplateEditor: (template) =>
    set({
      templateEditorOpen: true,
      editingTemplate: template ?? null
    }),

  closeTemplateEditor: () =>
    set({
      templateEditorOpen: false,
      editingTemplate: null,
      previewContent: null,
      previewError: null
    }),

  setImportWizardStep: (importWizardStep) => set({ importWizardStep }),

  openDeleteConfirm: (id, type) =>
    set({
      deleteConfirmOpen: true,
      deleteTargetId: id,
      deleteTargetType: type
    }),

  closeDeleteConfirm: () =>
    set({
      deleteConfirmOpen: false,
      deleteTargetId: null,
      deleteTargetType: null
    }),

  resetStore: () => set(initialState)
}))

// Expose for debugging
if (typeof window !== "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(window as any).__tldw_useCollectionsStore = useCollectionsStore
}
