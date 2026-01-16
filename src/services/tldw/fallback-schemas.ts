// Fallback schemas used when the tldw_server OpenAPI spec is unavailable.
// Canonical source for media.add schema:
//   - tldw_server2 OpenAPI: /openapi.json
//   - Notes/media ingestion section: /docs-static/Design/Media_Ingestion.md (if available)
// Last synchronized: 2025-12-13 from tldw_server v0.1.0 (Body_add_media_api_v1_media_add_post)
// Run `bun verify:openapi` to check for field-name drift against /api/v1/media/add

export const MEDIA_ADD_SCHEMA_FALLBACK_VERSION = "0.1.0"

export const MEDIA_ADD_SCHEMA_FALLBACK: Array<{
  name: string
  type: string
  description?: string
  title?: string
  enum?: unknown[]
}> = [
  { name: 'accept_archives', type: 'boolean', description: 'Accept .zip archives of EMLs', title: 'Accept Archives' },
  { name: 'accept_mbox', type: 'boolean', description: 'Accept .mbox mailboxes', title: 'Accept Mbox' },
  { name: 'accept_pst', type: 'boolean', description: 'Accept .pst/.ost containers', title: 'Accept Pst' },
  { name: 'api_name', type: 'string', description: 'Optional API name', title: 'Api Name' },
  { name: 'author', type: 'string', description: 'Optional author', title: 'Author' },
  { name: 'chunk_language', type: 'string', description: 'Chunking language override', title: 'Chunk Language' },
  {
    name: 'chunk_method',
    type: 'string',
    description: 'Chunking method',
    title: 'Chunk Method',
    enum: [
      'semantic',
      'tokens',
      'paragraphs',
      'sentences',
      'words',
      'ebook_chapters',
      'json',
      'propositions'
    ]
  },
  { name: 'chunk_overlap', type: 'integer', description: 'Chunk overlap size', title: 'Chunk Overlap' },
  { name: 'chunk_size', type: 'integer', description: 'Target chunk size', title: 'Chunk Size' },
  {
    name: 'claims_extractor_mode',
    type: 'string',
    description: 'Claims extractor mode',
    title: 'Claims Extractor Mode',
    enum: ['auto', 'heuristic', 'ner', 'aps', 'llm']
  },
  { name: 'claims_max_per_chunk', type: 'string', description: 'Max claims per chunk', title: 'Claims Max Per Chunk' },
  {
    name: 'context_strategy',
    type: 'string',
    description: 'Context strategy',
    title: 'Context Strategy',
    enum: ['auto', 'full', 'window', 'outline_window']
  },
  { name: 'context_token_budget', type: 'string', description: 'Token budget for auto strategy', title: 'Context Token Budget' },
  { name: 'context_window_size', type: 'string', description: 'Context window size (chars)', title: 'Context Window Size' },
  { name: 'contextual_llm_model', type: 'string', description: 'LLM model for contextual chunking', title: 'Contextual Llm Model' },
  { name: 'cookies', type: 'string', description: 'Cookie string', title: 'Cookies' },
  { name: 'custom_chapter_pattern', type: 'string', description: 'Regex for chapter splitting', title: 'Custom Chapter Pattern' },
  { name: 'custom_prompt', type: 'string', description: 'Custom prompt', title: 'Custom Prompt' },
  { name: 'diarize', type: 'boolean', description: 'Enable speaker diarization', title: 'Diarize' },
  { name: 'embedding_model', type: 'string', description: 'Embedding model', title: 'Embedding Model' },
  { name: 'embedding_provider', type: 'string', description: 'Embedding provider', title: 'Embedding Provider' },
  { name: 'enable_contextual_chunking', type: 'boolean', description: 'Enable contextual chunking', title: 'Enable Contextual Chunking' },
  { name: 'end_time', type: 'string', description: 'End time (HH:MM:SS)', title: 'End Time' },
  { name: 'generate_embeddings', type: 'boolean', description: 'Generate embeddings', title: 'Generate Embeddings' },
  { name: 'ingest_attachments', type: 'boolean', description: 'Parse nested attachments', title: 'Ingest Attachments' },
  { name: 'keep_original_file', type: 'boolean', description: 'Retain original files', title: 'Keep Original File' },
  { name: 'keywords', type: 'string', description: 'Comma-separated keywords', title: 'Keywords' },
  { name: 'max_depth', type: 'integer', description: 'Max nested parsing depth', title: 'Max Depth' },
  { name: 'overwrite_existing', type: 'boolean', description: 'Overwrite existing media', title: 'Overwrite Existing' },
  { name: 'pdf_parsing_engine', type: 'string', description: 'PDF parsing engine', title: 'Pdf Parsing Engine' },
  { name: 'perform_analysis', type: 'boolean', description: 'Perform analysis', title: 'Perform Analysis' },
  { name: 'perform_chunking', type: 'boolean', description: 'Enable chunking', title: 'Perform Chunking' },
  { name: 'perform_claims_extraction', type: 'string', description: 'Extract factual claims', title: 'Perform Claims Extraction' },
  { name: 'perform_confabulation_check_of_analysis', type: 'boolean', description: 'Enable confabulation check', title: 'Confabulation Check' },
  { name: 'perform_rolling_summarization', type: 'boolean', description: 'Rolling summarization', title: 'Rolling Summarization' },
  { name: 'start_time', type: 'string', description: 'Start time (HH:MM:SS)', title: 'Start Time' },
  { name: 'summarize_recursively', type: 'boolean', description: 'Recursive summarization', title: 'Summarize Recursively' },
  { name: 'system_prompt', type: 'string', description: 'System prompt', title: 'System Prompt' },
  { name: 'timestamp_option', type: 'boolean', description: 'Include timestamps', title: 'Timestamp Option' },
  { name: 'title', type: 'string', description: 'Optional title', title: 'Title' },
  { name: 'transcription_language', type: 'string', description: 'Transcription language', title: 'Transcription Language' },
  { name: 'transcription_model', type: 'string', description: 'Transcription model', title: 'Transcription Model' },
  { name: 'use_adaptive_chunking', type: 'boolean', description: 'Adaptive chunking', title: 'Use Adaptive Chunking' },
  { name: 'use_cookies', type: 'boolean', description: 'Use cookies for downloads', title: 'Use Cookies' },
  { name: 'use_multi_level_chunking', type: 'boolean', description: 'Multi-level chunking', title: 'Use Multi Level Chunking' },
  { name: 'vad_use', type: 'boolean', description: 'Enable VAD filter', title: 'Vad Use' }
]
