export interface Source {
  id?: string | number
  title?: string
  name?: string
  url?: string
  content?: string
  pageContent?: string
  snippet?: string
  score?: number
  mode?: string
  type?: string
  /**
   * Additional provider-specific metadata.
   */
  meta?: Record<string, unknown>
}

export interface GenerationInfo {
  total_duration?: number
  load_duration?: number
  prompt_eval_count?: number
  prompt_eval_duration?: number
  eval_count?: number
  eval_duration?: number
  context?: string
  response?: string
  /**
   * Allow additional provider-specific metrics.
   */
  [key: string]: unknown
}

