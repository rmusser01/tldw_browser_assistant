# PRD: Search & Context Panel (Unified RAG)

## Summary
Redesign the "Ctx + Media" UI into a combined "Search & Context" panel (embedded in the sidepanel and options playground) that exposes all Unified RAG options with clear information architecture, progressive disclosure, and dependency-aware controls, while enabling in-panel search, review, and selection of results before insertion.

## Goals
- Provide full access to all Unified RAG request options in a usable, structured layout.
- Reduce cognitive load with clear grouping, defaults, and progressive disclosure.
- Make dependencies explicit (agentic-only, generation-only, citations-only).
- Allow in-panel search, preview, and selection of content before insertion.
- Ensure keyboard, screen reader, and low-vision accessibility.

## Non-goals
- Full document editing or library management.
- Changing backend APIs or behavior.
- New analytics schemas beyond basic UX instrumentation.

## Users and Jobs
- Researchers tuning retrieval quality.
- Analysts needing citation and verification control.
- Power users optimizing performance, safety, and cost.

## Success Metrics
- Reduced time to configure advanced settings.
- Increased use of advanced options without increased error rate.
- Lower configuration abandonment.

## Scope
- New Search & Context panel layout, controls, defaults, and presets.
- Dependency-aware visibility and validation.
- Explicit default values for every field (no "Auto").
- In-panel search results list with per-result actions (insert, ask, preview, open, copy, pin).
- Attached context list within the panel for tabs, files, and pinned results.

## Information Architecture
Common (default visible):
- Header: Title, Preset, Strategy, Explain only, Reset to Balanced
- Use current message toggle
- Query + Search
- Sources & Filters
- Retrieval
- Reranking
- Answer & Citations
- Safety & Integrity
- Context Construction
- Quick Wins
- Results list
- Attached context (tabs/files/pins)
- Footer actions (Apply, Apply & Search, Cancel)

Advanced (collapsed by default, search input present):
- Source scope
- Query expansion
- Caching
- Document processing
- VLM late chunking
- Advanced retrieval
- Claims & factuality
- Generation guardrails (generation-only)
- Post-verification (adaptive)
- Agentic strategy (agentic-only)
- Monitoring & analytics
- Performance
- Resilience
- Batch
- Feedback
- User context

Note: the current search input only filters Source scope labels.

## Presets
Presets apply explicit values to all fields and flip to "Custom" when any field changes.
- Fast
- Balanced (default)
- Thorough

## Dependencies and Progressive Disclosure
- Agentic-only settings render only when Strategy = Agentic; otherwise show a brief helper note.
- Generation-only settings render only when Enable Generation is on; guardrails show a helper note when generation is off.
- Citation-only settings render only when Enable Citations is on.
- VLM sub-controls render only when VLM late chunking is enabled (standard or agentic).

## Field Coverage (All Unified RAG Options)
Core:
- query (required), sources, strategy, corpus, index_namespace

Retrieval:
- search_mode, fts_level, hybrid_alpha, enable_intent_routing, top_k, min_score

Query Expansion:
- expand_query, expansion_strategies, spell_check

Caching:
- enable_cache, cache_threshold, adaptive_cache

Filtering/Selection:
- keyword_filter, include_media_ids, include_note_ids

Security/Privacy:
- enable_security_filter, detect_pii, redact_pii, sensitivity_level, content_filter

Document Processing:
- enable_table_processing, table_method

VLM Late Chunking:
- enable_vlm_late_chunking, vlm_backend, vlm_detect_tables_only, vlm_max_pages,
  vlm_late_chunk_top_k_docs

Chunking & Context:
- chunk_type_filter, enable_parent_expansion, parent_context_size,
  include_sibling_chunks, sibling_window, include_parent_document, parent_max_tokens

Agentic (strategy=agentic):
- agentic_top_k_docs, agentic_window_chars, agentic_max_tokens_read,
  agentic_max_tool_calls, agentic_extractive_only, agentic_quote_spans,
  agentic_debug_trace, agentic_enable_tools, agentic_use_llm_planner,
  agentic_time_budget_sec, agentic_cache_ttl_sec,
  agentic_enable_query_decomposition, agentic_subgoal_max,
  agentic_enable_semantic_within, agentic_enable_section_index,
  agentic_prefer_structural_anchors, agentic_enable_table_support,
  agentic_enable_vlm_late_chunking, agentic_vlm_backend,
  agentic_vlm_detect_tables_only, agentic_vlm_max_pages,
  agentic_vlm_late_chunk_top_k_docs, agentic_use_provider_embeddings_within,
  agentic_provider_embedding_model_id, agentic_adaptive_budgets,
  agentic_coverage_target, agentic_min_corroborating_docs,
  agentic_max_redundancy, agentic_enable_metrics

Advanced Retrieval:
- enable_multi_vector_passages, mv_span_chars, mv_stride, mv_max_spans,
  mv_flatten_to_spans, enable_numeric_table_boost

Claims & Factuality:
- enable_claims, claim_extractor, claim_verifier, claims_top_k, claims_conf_threshold,
  claims_max, claims_concurrency, nli_model

Reranking:
- enable_reranking, reranking_strategy, rerank_top_k, reranking_model,
  rerank_min_relevance_prob, rerank_sentinel_margin

Citations:
- enable_citations, citation_style, include_page_numbers, enable_chunk_citations

Answer Generation:
- enable_generation, strict_extractive, generation_model, generation_prompt,
  max_generation_tokens, enable_abstention, abstention_behavior,
  enable_multi_turn_synthesis, synthesis_time_budget_sec, synthesis_draft_tokens,
  synthesis_refine_tokens

Generation Guardrails:
- enable_content_policy_filter, content_policy_types, content_policy_mode,
  enable_html_sanitizer, html_allowed_tags, html_allowed_attrs, ocr_confidence_threshold

Post-Verification (Adaptive):
- enable_post_verification, adaptive_max_retries, adaptive_unsupported_threshold,
  adaptive_max_claims, adaptive_time_budget_sec, low_confidence_behavior,
  adaptive_advanced_rewrites, adaptive_rerun_on_low_confidence,
  adaptive_rerun_include_generation, adaptive_rerun_bypass_cache,
  adaptive_rerun_time_budget_sec, adaptive_rerun_doc_budget

Feedback:
- collect_feedback, feedback_user_id, apply_feedback_boost

Monitoring & Analytics:
- enable_monitoring, enable_analytics, enable_observability, trace_id

Performance:
- use_connection_pool, use_embedding_cache, enable_performance_analysis, timeout_seconds

Quick Wins:
- highlight_results, highlight_query_terms, track_cost, debug_mode

Explain/Dry-Run:
- explain_only

Injection/Numeric:
- enable_injection_filter, injection_filter_strength, require_hard_citations,
  enable_numeric_fidelity, numeric_fidelity_behavior

Batch:
- enable_batch, batch_queries, batch_concurrent

Resilience:
- enable_resilience, retry_attempts, circuit_breaker

User Context:
- user_id, session_id

## Defaults (Explicit Values)
Balanced preset is the default and sets explicit values for every field. See Appendix A for full values and preset overrides (Fast, Thorough).

## Backend-Validated Defaults and Sentinels
- query must be a concrete string in the request; resolve "Use current message" to actual text before calling the API.
- generation_model and generation_prompt should be null/omitted to use backend defaults; do not send "inherit_*" sentinel strings.
- user_id and session_id should be actual identifiers or omitted; do not send "current_*" sentinel strings.
- vlm_backend and agentic_vlm_backend accept "auto" or null; "auto" is normalized to default backend selection.
- Empty strings and empty arrays are omitted from request options; only non-empty values are sent.
- timeout_seconds is converted to milliseconds for the request timeout.

## Interaction Spec
- Search runs in-panel using draft settings (no Apply needed); Apply persists settings for future queries.
- If "Use current message" is enabled and query input is empty, resolve from the current draft chat input before Search; if no message exists, show inline error and block Search.
- When batch mode is enabled and the query input is empty, the first batch query is used to satisfy the required query before Search.
- Apply saves all fields to the next request payload and closes the panel.
- Apply & Search saves draft edits, executes Search with those settings, and keeps the panel open.
- Cancel discards draft edits, resets fields to last applied settings, and closes the panel.
- Any non-transient field change switches preset to "Custom" (exclude query and batch_queries).
- Dependency controls render conditionally or show helper text when not applicable.
- Query is required and shows an inline error; numeric inputs enforce ranges via control constraints.
- Explain-only toggles the explain flag; Apply/Apply & Search labels remain unchanged.
- Result actions:
  - Insert: inserts a formatted snippet with a source line into the current chat input.
  - Ask: starts a chat about the specific item; pinned results are ignored while tabs/files remain included.
  - Preview: opens a modal content preview for the item.
  - Open: opens the item in its source location (media/notes/other origin).
  - Copy: copies as markdown or plaintext (format selector).
  - Pin: pins the result to keep it while reviewing other results.
- Pinned results appear in Attached context alongside tabs and files and are included in the next message.
- Empty/no-results state shows a hint banner and a "No results yet" message.
- Error handling collapses to a timeout state with retry, increase-timeout, and server-health actions.

## Copy Guidance
- Title: "Search & Context"
- Strategy labels: "Standard" and "Agentic"
- Use plain-language labels: "Retrieval mode", "Results (top_k)", "Minimum relevance"
- Apply & Search button: "Apply & Search"
- Helper text for gated sections (guardrails, agentic) when disabled

## Accessibility
- Keyboard-only flow supports section navigation and field access.
- All controls have explicit labels (no placeholder-only inputs).
- ARIA grouping for sections and dependency announcements via live region.
- Minimum 44px hit targets and WCAG AA contrast.

## Key User Flows
- Configure and search: user opens the panel, tunes settings, runs search, reviews results,
  and inserts selected items into the current chat.
- Review and refine: user adjusts filters or retrieval mode, re-runs search,
  previews results, and pins selected items while continuing to browse.
- Apply & Search: user tunes settings and persists them while running search without closing the panel.
- Ask about a result: user chooses Ask on a specific item; if pins exist they confirm
  pins will be ignored, then a new chat starts with that item.
- Apply settings only: user tweaks settings and clicks Apply to persist for the next query.
- Power tuning: user opens Advanced and uses the search field to locate settings
  (currently scoped to source scope labels); preset flips to Custom on edits.

## UI States
- Idle: show a dismissible hint banner and "No results yet. Enter a query to search."
- Loading: show spinner; clear prior results while request is in flight.
- No results: same "No results yet" message (no suggestion list yet).
- Error/timeout: show "Request timed out" with retry, increase-timeout, and server-health actions.
- Offline/disconnected: overlay message "Connect to server to search knowledge base."
- Preview open: modal preview of the pinned snippet.

## Search and Results Behavior
- Search executes on Enter or Search button using draft settings; no auto-search on every field change.
- When Enable batch is on, Search executes batch queries and displays results grouped by query (supports `batch_results` or `results_by_query` payloads).
- Results are sorted by relevance by default; additional sorts include date and type.
- Each result displays title, snippet, and score (if available).
- Highlight terms and matches when enabled (highlight_results, highlight_query_terms).

## Result Actions (Behavior Detail)
- Insert: inserts a formatted snippet with a source line into the current chat input.
- Ask: starts a new chat about the specific item; if pins exist, confirm that pins will be ignored.
- Preview: opens a modal preview showing the pinned snippet and source.
- Open: deep-links to the item's origin (media viewer, notes, or source type).
- Copy: copy selector for Markdown or plain text.
- Pin: pins the result so it remains available while exploring other results.

## Attached Context Behavior
- Tabs and files from the composer context are mirrored in the panel; removing them updates the same selections.
- Tabs support Refresh and show an "Open tabs" list with Add actions; files support Add file; each item shows title/source and Remove.
- Pinned items appear alongside tabs/files; Clear all only affects pins.
- Pinned items are appended to the next outgoing message by default; Ask bypasses pins.

## Validation Rules (UI-Level)
- Required: query.
- Numeric ranges:
  - Probabilities/thresholds/alphas: 0.0–1.0.
  - K and counts: positive integers.
  - Token limits and time budgets: positive integers.
- Inputs enforce ranges via control constraints; only query shows inline error today.

## State Persistence
- Last applied settings persist per user across sessions; draft edits are discarded on Cancel.
- Preset selection and "Use current message" are persisted in storage.
- Query and batch queries are transient and cleared on Apply.
- Pinned results are session-only and cleared on restart.

## Telemetry (Lightweight, Existing Schema)
- Panel opened/closed.
- Preset applied or switched to Custom.
- Advanced toggled open and search used.
- Search executed, result count, and action usage (Insert/Ask/Preview/Open/Copy/Pin).
- Error and timeout events.
- Current implementation does not emit new telemetry hooks yet.

## Risks and Dependencies
- Large settings surface area risks overwhelm without clean grouping.
- Missing or slow metadata for preview may degrade UX; plan skeleton and timeout states.
- Deep-linking to media/notes sources requires reliable routing in the app.

## Staged Implementation Plan (Current Code)
### Phase 0: Discovery and Mapping (done)
- Unified defaults and preset overrides codified in `src/services/rag/unified-rag.ts`.
- Store wiring for rag options and pins in `src/store/option/slices/rag-slice.ts`.

### Phase 1: Layout and State Foundation (done)
- Extended `src/components/Sidepanel/Chat/RagSearchBar.tsx` into the Search & Context panel.
- Persisted preset selection, settings, and "Use current message" via storage.

### Phase 2: Search and Results (done)
- Search execution uses `buildRagSearchRequest` and `tldwClient.ragSearch`.
- Results list supports sorting, highlighting, batch grouping, and timeout handling.

### Phase 3: Preview, Pinning, and Context (done)
- Preview modal shows the pinned snippet with Insert/Ask/Copy.
- Pinned results stored in `ragPinnedResults` and appended to outgoing messages
  in `src/components/Sidepanel/Chat/form.tsx` and
  `src/components/Option/Playground/PlaygroundForm.tsx`.
- Sidepanel panel now surfaces tabs/files alongside pinned results with Refresh/Add file.
- Ask prompts confirm pins will be ignored.

### Phase 4: Dependencies, Validation, and Accessibility (partial)
- Conditional rendering and helper notes for agentic/guardrail-only sections.
- Query required error; numeric inputs enforce constraints via InputNumber.

### Phase 5: QA, i18n, and Documentation (partial)
- Unit tests added in `tests/unit/unified-rag.test.ts` and
  `tests/unit/rag-format.test.ts`.
- i18n keys are referenced via `sidepanel:rag.*` (locale updates pending).

## ASCII Wireframes

### Common (default)
```text
+--------------------------------------------------------------------------------------+
| SEARCH & CONTEXT                                                                      |
| Preset: [Balanced v]   Strategy: [Standard v]   Explain only: [ ]   Reset to Balanced |
+--------------------------------------------------------------------------------------+

COMMON
+--------------------------------------------------------------------------------------+
| [ Use current message ]                                                              |
| [__________________________________________] [Search]                                |
+--------------------------------------------------------------------------------------+

+--------------------------------------------------------------------------------------+
| Sources & Filters                                                                    |
| Sources: [media_db, notes, characters, chats]                                        |
| Keyword filter: [________________________________________]                            |
| Include media IDs: [____________________________________]  (comma separated)         |
| Include note IDs:  [____________________________________]  (comma separated)         |
+--------------------------------------------------------------------------------------+

+--------------------------------------------------------------------------------------+
| Retrieval                                                                            |
| Mode: (fts) (vector) (hybrid)   FTS level: (media) (chunk)   Hybrid alpha: [0.50]     |
| Intent routing: [x]           Top K: [8]                 Min score: [0.20]            |
+--------------------------------------------------------------------------------------+

+--------------------------------------------------------------------------------------+
| Reranking                                                                            |
| Enable: [x]  Strategy: [flashrank v]  Rerank top K: [20]  Model: [default]            |
| Min relevance prob: [0.20]   Sentinel margin: [0.05]                                   |
+--------------------------------------------------------------------------------------+

+--------------------------------------------------------------------------------------+
| Answer & Citations                                                                    |
| Generation: [x]  Strict extractive: [ ]  Max tokens: [800]                            |
| Model: [_________________]  Prompt: [_________________]                               |
| Abstention: [x] Behavior: [ask v]                                                     |
| Multi-turn synthesis: [ ] Time budget: [45] Draft: [400] Refine: [400]                |
| Citations: [x] Style: [apa v]  Page numbers: [x]  Chunk cites: [x]                    |
| Require hard citations: [ ]                                                          |
+--------------------------------------------------------------------------------------+

+--------------------------------------------------------------------------------------+
| Safety & Integrity                                                                    |
| Security filter: [x]   Content filter: [x]                                           |
| PII detect: [x]   PII redact: [ ]   Sensitivity: [internal v]                         |
| Injection filter: [x]  Strength: [0.70]                                               |
| Numeric fidelity: [ ]  Behavior: [ask v]                                              |
+--------------------------------------------------------------------------------------+

+--------------------------------------------------------------------------------------+
| Context Construction                                                                  |
| Chunk types: [x] text [x] code [x] table [x] list                                     |
| Parent expansion: [x]  Parent context size: [2]   Parent max tokens: [800]            |
| Include siblings: [x]  Sibling window: [1]   Include parent document: [ ]             |
+--------------------------------------------------------------------------------------+

+--------------------------------------------------------------------------------------+
| Quick Wins                                                                            |
| Highlight results: [x]  Highlight query terms: [x]  Track cost: [ ]  Debug: [ ]       |
+--------------------------------------------------------------------------------------+

ADVANCED (collapsed)
+--------------------------------------------------------------------------------------+
| [Show Advanced]   Search settings: [________________________________________]         |
| Sections: Source scope, Query expansion, Caching, Document processing, VLM,           |
| Advanced retrieval, Claims & factuality, Guardrails (Gen-only), Post verification,   |
| Agentic (Agentic-only), Monitoring, Performance, Resilience, Batch, Feedback,        |
| User context                                                                          |
+--------------------------------------------------------------------------------------+

RESULTS
+--------------------------------------------------------------------------------------+
| Results                                               Sort: [relevance | date | type] |
+--------------------------------------------------------------------------------------+
| "Machine Learning Fundamentals"        Score: 0.94                                    |
| Neural networks are computing systems inspired by biological...                       |
| [Insert] [Ask] [Preview] [Open] [Copy] [Pin]                                           |
|--------------------------------------------------------------------------------------|
| "Deep Learning Tutorial"                Score: 0.87                                   |
| Convolutional neural networks excel at image recognition...                           |
| [Insert] [Ask] [Preview] [Open] [Copy] [Pin]                                           |
+--------------------------------------------------------------------------------------+

ATTACHED CONTEXT
+--------------------------------------------------------------------------------------+
| Tabs (1)                                            [Refresh]                         |
| - GitHub - tldw-assistant                                           [Remove]          |
| Files (1)                                           [Add file]                        |
| - research-notes.pdf (2.3 MB)                                         [Remove]         |
| Pinned results (2)                                                     [Clear all]     |
| - "Machine Learning Fundamentals"                                      [Remove]        |
| - "Deep Learning Tutorial"                                            [Remove]        |
+--------------------------------------------------------------------------------------+

FOOTER
+--------------------------------------------------------------------------------------+
| Apply to next query [Apply] [Apply & Search]   [Cancel]                               |
+--------------------------------------------------------------------------------------+
```

### Advanced (expanded)
```text
ADVANCED (expanded)
+--------------------------------------------------------------------------------------+
| Advanced settings  |  Search settings: [_____________________________]               |
+--------------------------------------------------------------------------------------+

+--------------------------------------------------------------------------------------+
| Source Scope                                                                       |
| Corpus: [__________________________]     Index namespace: [_______________________]  |
+--------------------------------------------------------------------------------------+

+--------------------------------------------------------------------------------------+
| Query Expansion                                                                     |
| Expand query: [ ]  Spell check: [x]                                                  |
| Strategies: [x] acronym [x] synonym [x] semantic [x] domain [x] entity                |
+--------------------------------------------------------------------------------------+

+--------------------------------------------------------------------------------------+
| Caching                                                                             |
| Enable cache: [x]  Cache threshold: [0.80]  Adaptive cache: [x]                       |
+--------------------------------------------------------------------------------------+

+--------------------------------------------------------------------------------------+
| Document Processing                                                                 |
| Table processing: [x]  Method: (markdown) (html) (hybrid)                            |
+--------------------------------------------------------------------------------------+

+--------------------------------------------------------------------------------------+
| VLM Late Chunking                                                                   |
| Enable VLM late chunking: [ ]  Backend: [auto]                                       |
| Detect tables only: [ ]  Max pages: [20]  Top K docs: [5]                            |
+--------------------------------------------------------------------------------------+

+--------------------------------------------------------------------------------------+
| Advanced Retrieval                                                                  |
| Multi-vector passages: [ ]                                                           |
| Span chars: [1200]  Stride: [400]  Max spans: [5]  Flatten to spans: [x]             |
| Numeric table boost: [ ]                                                             |
+--------------------------------------------------------------------------------------+

+--------------------------------------------------------------------------------------+
| Claims & Factuality                                                                  |
| Enable claims: [ ]  Extractor: [auto v]  Verifier: [hybrid v]  NLI model: [default]   |
| Top K: [8]  Conf threshold: [0.50]  Max claims: [20]  Concurrency: [4]               |
+--------------------------------------------------------------------------------------+

+--------------------------------------------------------------------------------------+
| Generation Guardrails (Generation-only)                                              |
| Content policy filter: [x]  Mode: (redact) (drop) (annotate)                          |
| Types: [x] pii [x] phi                                                                |
| HTML sanitizer: [x]                                                                  |
| Allowed tags: [b, i, em, strong, a, code, pre, ul, ol, li, p, br, blockquote]        |
| Allowed attrs: [href, title, target, rel]                                            |
| OCR confidence threshold: [0.60]                                                     |
+--------------------------------------------------------------------------------------+

+--------------------------------------------------------------------------------------+
| Post-Verification (Adaptive)                                                         |
| Enable post verification: [ ]                                                        |
| Max retries: [1]  Unsupported threshold: [0.40]  Max claims: [20]                     |
| Time budget (s): [30]  Low confidence: [ask v]                                       |
| Advanced rewrites: [ ]  Rerun on low confidence: [x]                                  |
| Rerun include generation: [x]  Rerun bypass cache: [ ]                               |
| Rerun time budget: [30]  Rerun doc budget: [12]                                      |
+--------------------------------------------------------------------------------------+

+--------------------------------------------------------------------------------------+
| Agentic Strategy (Agentic-only)                                                      |
| Top K docs: [12]  Window chars: [5000]  Max tokens read: [5000]                       |
| Max tool calls: [6]  Extractive only: [ ]  Quote spans: [x]  Debug trace: [ ]         |
| Enable tools: [x]  Use LLM planner: [x]                                               |
| Time budget (s): [60]  Cache TTL (s): [600]                                          |
| Query decomposition: [x]  Subgoal max: [5]                                            |
| Semantic within: [x]  Section index: [x]  Prefer structural anchors: [x]              |
| Table support: [x]                                                                    |
| Agentic VLM late chunking: [ ]  Backend: [auto]                                       |
| VLM detect tables only: [ ]  VLM max pages: [20]  VLM top K docs: [5]                 |
| Use provider embeddings within: [ ]  Provider model id: [______________]             |
| Adaptive budgets: [x]  Coverage target: [0.80]  Min corroborating docs: [2]            |
| Max redundancy: [3]  Enable metrics: [ ]                                              |
+--------------------------------------------------------------------------------------+

+--------------------------------------------------------------------------------------+
| Monitoring & Analytics                                                               |
| Monitoring: [ ]  Analytics: [ ]  Observability: [ ]  Trace ID: [_____________]       |
+--------------------------------------------------------------------------------------+

+--------------------------------------------------------------------------------------+
| Performance                                                                          |
| Connection pool: [x]  Embedding cache: [x]  Perf analysis: [ ]  Timeout (s): [45]     |
+--------------------------------------------------------------------------------------+

+--------------------------------------------------------------------------------------+
| Resilience                                                                           |
| Enable resilience: [x]  Retry attempts: [2]  Circuit breaker: [x]                      |
+--------------------------------------------------------------------------------------+

+--------------------------------------------------------------------------------------+
| Batch                                                                               |
| Enable batch: [ ]  Concurrent: [2]                                                    |
| Batch queries:                                                                       |
| [ multi-line input ................................................................ ]|
+--------------------------------------------------------------------------------------+

+--------------------------------------------------------------------------------------+
| Feedback                                                                            |
| Collect feedback: [ ]  Feedback user id: [______________]  Apply boost: [ ]           |
+--------------------------------------------------------------------------------------+

+--------------------------------------------------------------------------------------+
| User Context                                                                        |
| User ID: [______________]  Session ID: [______________]                              |
+--------------------------------------------------------------------------------------+
```

## References
- RAG-Modal-Redesign-claude.md (prior review and architectural notes)

## Appendix A: Preset Defaults
Balanced defaults and preset overrides are explicit and should be copied into implementation constants without "Auto" placeholders.

```yaml
balanced:
  core:
    # Resolved from UI before request; API requires a concrete string.
    query: ""
    sources: [media_db, notes, characters, chats]
    strategy: standard
    corpus: ""
    index_namespace: ""
  retrieval:
    search_mode: hybrid
    fts_level: chunk
    hybrid_alpha: 0.50
    enable_intent_routing: true
    top_k: 8
    min_score: 0.20
  query_expansion:
    expand_query: false
    expansion_strategies: [acronym, synonym, semantic, domain, entity]
    spell_check: true
  caching:
    enable_cache: true
    cache_threshold: 0.80
    adaptive_cache: true
  filtering_selection:
    keyword_filter: ""
    include_media_ids: []
    include_note_ids: []
  security_privacy:
    enable_security_filter: true
    detect_pii: true
    redact_pii: false
    sensitivity_level: internal
    content_filter: true
  document_processing:
    enable_table_processing: true
    table_method: hybrid
  vlm_late_chunking:
    enable_vlm_late_chunking: false
    vlm_backend: auto
    vlm_detect_tables_only: false
    vlm_max_pages: 20
    vlm_late_chunk_top_k_docs: 5
  chunking_context:
    chunk_type_filter: [text, code, table, list]
    enable_parent_expansion: true
    parent_context_size: 2
    include_sibling_chunks: true
    sibling_window: 1
    include_parent_document: false
    parent_max_tokens: 800
  agentic:
    agentic_top_k_docs: 12
    agentic_window_chars: 5000
    agentic_max_tokens_read: 5000
    agentic_max_tool_calls: 6
    agentic_extractive_only: false
    agentic_quote_spans: true
    agentic_debug_trace: false
    agentic_enable_tools: true
    agentic_use_llm_planner: true
    agentic_time_budget_sec: 60
    agentic_cache_ttl_sec: 600
    agentic_enable_query_decomposition: true
    agentic_subgoal_max: 5
    agentic_enable_semantic_within: true
    agentic_enable_section_index: true
    agentic_prefer_structural_anchors: true
    agentic_enable_table_support: true
    agentic_enable_vlm_late_chunking: false
    agentic_vlm_backend: auto
    agentic_vlm_detect_tables_only: false
    agentic_vlm_max_pages: 20
    agentic_vlm_late_chunk_top_k_docs: 5
    agentic_use_provider_embeddings_within: false
    agentic_provider_embedding_model_id: ""
    agentic_adaptive_budgets: true
    agentic_coverage_target: 0.80
    agentic_min_corroborating_docs: 2
    agentic_max_redundancy: 3
    agentic_enable_metrics: false
  advanced_retrieval:
    enable_multi_vector_passages: false
    mv_span_chars: 1200
    mv_stride: 400
    mv_max_spans: 5
    mv_flatten_to_spans: true
    enable_numeric_table_boost: false
  claims_factuality:
    enable_claims: false
    claim_extractor: auto
    claim_verifier: hybrid
    claims_top_k: 8
    claims_conf_threshold: 0.50
    claims_max: 20
    claims_concurrency: 4
    nli_model: default
  reranking:
    enable_reranking: true
    reranking_strategy: flashrank
    rerank_top_k: 20
    reranking_model: default
    rerank_min_relevance_prob: 0.20
    rerank_sentinel_margin: 0.05
  citations:
    enable_citations: true
    citation_style: apa
    include_page_numbers: true
    enable_chunk_citations: true
  answer_generation:
    enable_generation: true
    strict_extractive: false
    generation_model: null
    generation_prompt: null
    max_generation_tokens: 800
    enable_abstention: true
    abstention_behavior: ask
    enable_multi_turn_synthesis: false
    synthesis_time_budget_sec: 45
    synthesis_draft_tokens: 400
    synthesis_refine_tokens: 400
  generation_guardrails:
    enable_content_policy_filter: true
    content_policy_types: [pii, phi]
    content_policy_mode: redact
    enable_html_sanitizer: true
    html_allowed_tags:
      [b, i, em, strong, a, code, pre, ul, ol, li, p, br, blockquote]
    html_allowed_attrs: [href, title, target, rel]
    ocr_confidence_threshold: 0.60
  post_verification:
    enable_post_verification: false
    adaptive_max_retries: 1
    adaptive_unsupported_threshold: 0.40
    adaptive_max_claims: 20
    adaptive_time_budget_sec: 30
    low_confidence_behavior: ask
    adaptive_advanced_rewrites: false
    adaptive_rerun_on_low_confidence: true
    adaptive_rerun_include_generation: true
    adaptive_rerun_bypass_cache: false
    adaptive_rerun_time_budget_sec: 30
    adaptive_rerun_doc_budget: 12
  feedback:
    collect_feedback: false
    feedback_user_id: ""
    apply_feedback_boost: false
  monitoring_analytics:
    enable_monitoring: false
    enable_analytics: false
    enable_observability: false
    trace_id: ""
  performance:
    use_connection_pool: true
    use_embedding_cache: true
    enable_performance_analysis: false
    timeout_seconds: 45
  quick_wins:
    highlight_results: true
    highlight_query_terms: true
    track_cost: false
    debug_mode: false
  explain_only:
    explain_only: false
  injection_numeric:
    enable_injection_filter: true
    injection_filter_strength: 0.70
    require_hard_citations: false
    enable_numeric_fidelity: false
    numeric_fidelity_behavior: ask
  batch:
    enable_batch: false
    batch_queries: []
    batch_concurrent: 2
  resilience:
    enable_resilience: true
    retry_attempts: 2
    circuit_breaker: true
  user_context:
    user_id: null
    session_id: null

presets:
  fast_overrides:
    retrieval:
      search_mode: fts
      top_k: 5
    reranking:
      enable_reranking: false
    citations:
      enable_citations: false
    answer_generation:
      max_generation_tokens: 300
    performance:
      timeout_seconds: 20
  thorough_overrides:
    retrieval:
      top_k: 20
      min_score: 0.10
    reranking:
      enable_reranking: true
      rerank_top_k: 50
    citations:
      enable_citations: true
    claims_factuality:
      enable_claims: true
    post_verification:
      enable_post_verification: true
    answer_generation:
      enable_multi_turn_synthesis: true
      synthesis_time_budget_sec: 90
      max_generation_tokens: 1200
```
