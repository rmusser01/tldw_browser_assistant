/**
 * Data Tables Types
 * Types for the Data Tables Studio feature - natural language to structured tables
 */

// Column type definitions
export type ColumnType =
  | "text"
  | "number"
  | "date"
  | "url"
  | "boolean"
  | "currency"

// Column definition for a data table
export interface DataTableColumn {
  id: string
  name: string
  type: ColumnType
  description?: string // Extraction hint for LLM
  format?: string // e.g., "USD" for currency, "YYYY-MM-DD" for date
}

// Source types for data extraction
export type DataTableSourceType = "chat" | "document" | "rag_query"

// Source reference for a data table
export interface DataTableSource {
  type: DataTableSourceType
  id: string // chat_id, doc_id, or query string for rag_query
  title: string
  snippet?: string // Preview of source content
}

// Full data table record
export interface DataTable {
  id: string
  name: string
  description?: string
  prompt: string // Original generation prompt
  columns: DataTableColumn[]
  rows: Record<string, any>[]
  sources: DataTableSource[]
  created_at: string // ISO timestamp
  updated_at: string // ISO timestamp
  row_count: number
  generation_model?: string // Which LLM generated it
}

// Summary view of a data table (for list views)
export interface DataTableSummary {
  id: string
  name: string
  description?: string
  row_count: number
  column_count: number
  created_at: string
  updated_at: string
  source_count: number
}

// Request to generate a new table
export interface GenerateTableRequest {
  prompt: string
  sources: DataTableSource[]
  column_hints?: Partial<DataTableColumn>[] // Optional schema guidance
  model?: string // Override default model
  max_rows?: number // Limit output size
}

// Response from table generation
export interface GenerateTableResponse {
  table: DataTable
  warnings?: string[] // e.g., "Some sources had no extractable data"
}

// Request to regenerate an existing table
export interface RegenerateTableRequest {
  prompt?: string // Optional new prompt, uses original if not provided
  model?: string // Optional model override
}

// Export format options
export type ExportFormat = "csv" | "xlsx" | "json"

// Pagination params for listing tables
export interface DataTableListParams {
  page?: number
  page_size?: number
  search?: string
  sort_by?: "created_at" | "updated_at" | "name"
  sort_order?: "asc" | "desc"
}

// List response with pagination
export interface DataTableListResponse {
  tables: DataTableSummary[]
  total: number
  page: number
  page_size: number
  pages: number
}

// UI-specific types

// Tab options for the Data Tables page
export type DataTablesTab = "tables" | "create"

// Wizard step for table creation
export type CreateTableStep =
  | "sources"
  | "prompt"
  | "preview"
  | "save"

// Source selection state during wizard
export interface SourceSelectionState {
  selectedSources: DataTableSource[]
  searchQuery: string
  activeSourceType: DataTableSourceType
}

// Generation state during wizard
export interface GenerationState {
  prompt: string
  columnHints: Partial<DataTableColumn>[]
  model?: string
  maxRows: number
  isGenerating: boolean
  generatedTable?: DataTable
  error?: string
  warnings?: string[]
}

// Export state
export interface ExportState {
  isExporting: boolean
  format?: ExportFormat
  error?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Editing Types
// ─────────────────────────────────────────────────────────────────────────────

// Row with stable ID for editing
export interface DataTableRow {
  _id: string // Stable row identifier
  [key: string]: any
}

// Individual change record for tracking edits
export interface TableChange {
  type:
    | "cell"
    | "row_add"
    | "row_delete"
    | "column_add"
    | "column_delete"
    | "column_reorder"
  rowIndex?: number
  columnId?: string
  oldValue?: any
  newValue?: any
  timestamp: number
}

// Editing state for a table
export interface TableEditingState {
  editingCellKey: string | null // "rowIndex-columnId" format
  isDirty: boolean // Has unsaved changes
  pendingChanges: TableChange[] // Track all changes
}
