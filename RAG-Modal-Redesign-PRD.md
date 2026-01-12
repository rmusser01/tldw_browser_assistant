# PRD: Search & Context Modal (Unified RAG)

## Summary
Redesign the "Ctx + Media" modal into a combined "Search & Context" experience that exposes all Unified RAG options with clear information architecture, progressive disclosure, and dependency-aware controls, while also enabling in-modal search, review, and selection of results before insertion.

## Goals
- Provide full access to all Unified RAG request options in a usable, structured layout.
- Reduce cognitive load with clear grouping, defaults, and progressive disclosure.
- Make dependencies explicit (agentic-only, generation-only, citations-only).
- Allow in-modal search, preview, and selection of content before insertion.
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
- New modal layout, controls, defaults, and presets.
- Dependency-aware visibility and validation.
- Explicit default values for every field (no "Auto").
- In-modal search results list with per-result actions (insert, ask, preview, open, copy, pin).
- Attached context list for pinned results, tabs, and files.

## Information Architecture
Common (default visible):
- Query
- Sources & Filters
- Retrieval
- Reranking
- Answer & Citations
- Safety & Integrity
- Context Construction
- Quick Wins
- Results list
- Attached context

Advanced (collapsed by default, searchable):
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
- Explain / Dry run
- User context

## Presets
Presets apply explicit values to all fields and flip to "Custom" when any field changes.
- Fast
- Balanced (default)
- Thorough

## Dependencies and Progressive Disclosure
- Agentic-only settings visible when Strategy = Agentic.
- Generation-only settings visible when Enable Generation is on.
- Citation-only settings visible when Enable Citations is on.
- VLM settings visible only when VLM late chunking is enabled (standard or agentic).

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

## Interaction Spec
- Search runs in-modal using current settings; results list updates inline.
- Apply saves all fields to the next request payload and closes the modal.
- Any field change switches preset to "Custom".
- Dependency controls show badges and are disabled with helper text when not applicable.
- Inline validation for numeric ranges; query is required.
- Explain-only switches Apply to "Preview request".
- Result actions:
  - Insert: inserts snippet + citation into the current chat input.
  - Ask: starts a chat about the specific item (pre-fills context from that item).
  - Preview: opens an in-modal content preview for the item.
  - Open: opens the item in its source location (media/notes/other origin).
  - Copy: copies as markdown or plaintext (format selector).
  - Pin: pins the result to keep it while reviewing other results.
- Pinned results appear in Attached context and are included in the next message.
- Empty state shows examples and quick actions (remove filters, switch retrieval mode).
- No results and error states include retry and diagnostic guidance.

## Copy Guidance
- Title: "Search & Context"
- Subtitle: "Retrieve sources and configure RAG behavior"
- Strategy labels: "Standard (fast)" and "Agentic (deep)"
- Use plain-language labels: "Retrieval mode", "Results (top_k)", "Minimum relevance"
- Dependency helper text for all gated settings

## Accessibility
- Keyboard-only flow supports section navigation and field access.
- All controls have explicit labels (no placeholder-only inputs).
- ARIA grouping for sections and dependency announcements via live region.
- Minimum 44px hit targets and WCAG AA contrast.

## Key User Flows
- Configure and search: user opens modal, tunes settings, runs search, reviews results,
  and inserts selected items into the current chat.
- Review and refine: user adjusts filters or retrieval mode, re-runs search,
  previews results, and pins selected items while continuing to browse.
- Ask about a result: user chooses Ask on a specific item, which starts a new chat
  with that item pre-attached as context.
- Apply settings only: user tweaks settings and clicks Apply to persist for the next query.
- Power tuning: user opens Advanced, uses search to jump to specific settings,
  and saves a preset for reuse.

## UI States
- Idle: no query yet; show examples and a "Search" affordance.
- Loading: show spinner and keep prior results visible with a subtle "stale" label.
- No results: show suggestions (switch retrieval mode, widen min_score, remove filters).
- Error/timeout: show retry and a quick way to increase timeout or reduce top_k.
- Offline/disconnected: show reconnect hint and link to settings.
- Preview open: focus trap within preview; return focus to the originating result.

## Search and Results Behavior
- Search executes on Enter or Search button; no auto-search on every field change.
- Results are sorted by relevance by default; additional sorts include date and type.
- Each result displays type, title, snippet, source, and score (if available).
- Highlight terms and matches when enabled (highlight_results, highlight_query_terms).

## Result Actions (Behavior Detail)
- Insert: inserts snippet + citation into current chat input.
- Ask: starts a new chat about the specific item; item is pinned automatically.
- Preview: opens an in-modal content preview with a scrollable excerpt and metadata.
- Open: deep-links to the item's origin (media viewer, notes, or source type).
- Copy: copy selector for Markdown or plain text.
- Pin: pins the result so it remains available while exploring other results.

## Attached Context Behavior
- Tabs and files are managed as before; pinned results are added as a third group.
- Each pinned item shows title + source; remove is immediate; Clear all only affects pins.
- Pinned items are included in the next request payload by default.

## Validation Rules (UI-Level)
- Required: query.
- Numeric ranges:
  - Probabilities/thresholds/alphas: 0.0–1.0.
  - K and counts: positive integers.
  - Token limits and time budgets: positive integers.
- Provide inline errors and keep user input on validation failures.

## State Persistence
- Preset selection and manual edits persist per user across sessions.
- Pinned results are session-only and cleared on restart.

## Telemetry (Lightweight, Existing Schema)
- Modal opened/closed.
- Preset applied or switched to Custom.
- Advanced toggled open and search used.
- Search executed, result count, and action usage (Insert/Ask/Preview/Open/Copy/Pin).
- Error and timeout events.

## Risks and Dependencies
- Large settings surface area risks overwhelm without clean grouping.
- Missing or slow metadata for preview may degrade UX; plan skeleton and timeout states.
- Deep-linking to media/notes sources requires reliable routing in the app.

## Staged Implementation Plan
### Phase 0: Discovery and Mapping
- Confirm API fields and defaults; identify existing settings sources and storage.
- Inventory current modal and search components; document data flow for search results.
- Define result object schema used by preview and actions.

### Phase 1: Layout and State Foundation
- Build new modal scaffold, header, presets, and Common sections layout.
- Implement local state model for all fields with explicit defaults.
- Add Advanced drawer with search filter and section navigation.

### Phase 2: Search and Results
- Wire search execution to API using current settings.
- Implement results list with actions and highlight support.
- Add empty/no-results/error/timeout states.

### Phase 3: Preview, Pinning, and Context
- Build preview modal with focus management and metadata.
- Implement Pin behavior and Attached context list (tabs/files/pins).
- Implement Ask flow (new chat with pinned item).

### Phase 4: Dependencies, Validation, and Accessibility
- Add dependency gating logic and helper text.
- Implement validation rules and inline errors.
- Add keyboard shortcuts and ARIA labeling; verify focus order and contrast.

### Phase 5: QA, i18n, and Documentation
- Add UI copy to locale files and update docs.
- Manual QA against edge cases and error states.
- Add unit, integration, and property tests where applicable.

## ASCII Wireframes

### Common (default)
```text
+--------------------------------------------------------------------------------------+
| SEARCH & CONTEXT                                                       [Help] [X]    |
| Preset: (Fast) (Balanced) (Thorough) (Custom)   Strategy: (Standard) (Agentic)       |
| Advanced: [Show]   Explain only: [ ]   Reset to Balanced                              |
+--------------------------------------------------------------------------------------+

COMMON
+--------------------------------------------------------------------------------------+
| Query (required)                                                                     |
| [ Use current message ] [__________________________________________] [Search]        |
+--------------------------------------------------------------------------------------+

+--------------------------------------------------------------------------------------+
| Sources & Filters                                                                    |
| Sources: [x] media_db  [x] notes  [x] characters  [x] chats                           |
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
| Enable: [x]  Strategy: [flashrank v]  Rerank top K: [20]  Model: [default v]          |
| Min relevance prob: [0.20]   Sentinel margin: [0.05]                                   |
+--------------------------------------------------------------------------------------+

+--------------------------------------------------------------------------------------+
| Answer & Citations                                                                    |
| Generation: [x]  Strict extractive: [ ]  Max tokens: [800]                            |
| Model: [inherit_chat_model v]  Prompt: [inherit_system_prompt v]                      |
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
| Explain-only, User context                                                           |
+--------------------------------------------------------------------------------------+

RESULTS
+--------------------------------------------------------------------------------------+
| Results (8 found)                                      Sort: [relevance | date | type]|
+--------------------------------------------------------------------------------------+
| [PDF] "Machine Learning Fundamentals"        Score: 0.94                              |
| Neural networks are computing systems inspired by biological...                       |
| Source: uploads/ml-book.pdf                                                           |
| [Insert] [Ask] [Preview] [Open] [Copy] [Pin]                                           |
|--------------------------------------------------------------------------------------|
| [HTML] "Deep Learning Tutorial"                Score: 0.87                             |
| Convolutional neural networks excel at image recognition...                           |
| Source: https://example.com/tutorial                                                  |
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
| Apply to next query [Apply]   [Cancel]   Save as preset [Save]                         |
+--------------------------------------------------------------------------------------+
```

### Advanced (expanded)
```text
ADVANCED (expanded)
+--------------------------------------------------------------------------------------+
| Advanced settings  |  Search: [_____________________________]                          |
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
| Enable VLM late chunking: [ ]  Backend: [auto v]                                     |
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
| Enable claims: [ ]  Extractor: [auto v]  Verifier: [hybrid v]  NLI model: [default v] |
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
| Agentic VLM late chunking: [ ]  Backend: [auto v]                                     |
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
| Explain / Dry Run                                                                    |
| Explain only: [ ]                                                                    |
+--------------------------------------------------------------------------------------+

+--------------------------------------------------------------------------------------+
| User Context                                                                        |
| User ID: [inherit_user]  Session ID: [inherit_session]                                |
+--------------------------------------------------------------------------------------+
```

## References
- RAG-Modal-Redesign-claude.md (prior review and architectural notes)

## Appendix A: Preset Defaults
Balanced defaults and preset overrides are explicit and should be copied into implementation constants without "Auto" placeholders.

```yaml
balanced:
  core:
    query: "use_current_message"
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
    generation_model: inherit_chat_model
    generation_prompt: inherit_system_prompt
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
    user_id: current_user
    session_id: current_session

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
