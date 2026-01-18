# HCI/UX Review: Evaluations Playground Page

**Review Date:** 2026-01-17
**Reviewer:** Claude (HCI/UX Analysis)
**Component:** `src/components/Option/Evaluations/EvaluationsPlaygroundPage.tsx`
**Lines of Code:** ~2,532 lines (single component)

---

## Executive Summary

The Evaluations Playground page packs 10+ distinct features into a single 2,500-line React component. While functionally complete, the current implementation suffers from **high cognitive load**, **poor information architecture**, and **limited discoverability**. Users face a wall of stacked cards with no clear workflow guidance.

**Key Issues:**
1. Monolithic component with 40+ state variables creates maintenance burden
2. Deep selection nesting (eval → run → details) without URL routing
3. Raw JSON editing for all configurations
4. No visual feedback for metrics - just JSON dumps
5. Critical features (webhooks, idempotency) buried in dense forms

**Recommendation:** Adopt a **tab-based architecture** with **wizard-driven flows** for creation, and invest in **JSON editor improvements** as the highest-impact quick win.

---

## Part 1: Heuristic Evaluation (Nielsen's 10 Usability Heuristics)

### 1. Visibility of System Status
**Score: 4/10**

| Issue | Severity | Location |
|-------|----------|----------|
| Run status only shown as text ("running", "pending") | Medium | Run details card |
| No progress bar for evaluation runs | High | Run details card |
| Polling happens silently - user doesn't know refresh is active | Medium | Lines 379-385 |
| Rate limit consumption not shown until run starts | Medium | Rate limits card |

**Evidence:** The `refetchInterval` polls every 3s for running jobs (line 382-384), but there's no visual indicator that polling is active. Users may think the UI is static.

**Recommendations:**
- Add animated status badges (pulsing dot for "running")
- Show "Auto-refreshing..." indicator during polling
- Add progress bar based on `runDetail.progress` data
- Show rate limit consumption in real-time during runs

### 2. Match Between System and Real World
**Score: 5/10**

| Issue | Severity | Location |
|-------|----------|----------|
| Technical jargon without explanation ("Idempotency key") | High | Run config form |
| Eval types listed without descriptions | Medium | Eval type select |
| "eval_spec" terminology is API-centric, not user-centric | Low | Throughout |

**Evidence:** The idempotency key field (lines 1576-1605) has only a placeholder hint. Users unfamiliar with distributed systems won't understand its purpose.

**Recommendations:**
- Add tooltips explaining each eval type's use case
- Rename "Idempotency key" to "Request ID (prevents duplicates)"
- Provide contextual help icons next to technical fields

### 3. User Control and Freedom
**Score: 6/10**

| Issue | Severity | Location |
|-------|----------|----------|
| No undo for delete operations | High | Delete buttons |
| Cannot compare multiple runs side-by-side | Medium | Runs list |
| Cannot duplicate an existing evaluation | Medium | Eval actions |
| Cancel run requires confirmation but delete eval shows modal | Low | Actions |

**Evidence:** Delete mutations (lines 619-644, 565-586) immediately execute after modal confirmation. There's no soft-delete or undo period.

**Recommendations:**
- Add "Duplicate evaluation" action
- Implement soft-delete with 30-second undo toast
- Add multi-select mode for batch operations

### 4. Consistency and Standards
**Score: 7/10**

| Issue | Severity | Location |
|-------|----------|----------|
| Some forms use `Form.Item` names, others use controlled state | Medium | Throughout |
| "Start run" button appears in 2 places with different styles | Low | Lines 1181, 1607 |
| Inconsistent card sizing (some small, some dense) | Low | Right column |

**Evidence:** `evalSpecText` is controlled via `useState` (line 232) while form fields use `Form.Item`. This creates two parallel state systems.

**Recommendations:**
- Standardize on either fully controlled forms or Ant Design Form
- Unify button placement for primary actions

### 5. Error Prevention
**Score: 5/10**

| Issue | Severity | Location |
|-------|----------|----------|
| JSON validation happens on submit, not as-you-type | High | All JSON textareas |
| No schema validation for eval_spec based on eval_type | High | Create modal |
| Easy to submit duplicate runs without idempotency key | Medium | Run form |

**Evidence:** JSON parsing happens in `handleSubmitCreateEvaluation` (lines 916-927) only when user clicks "Create". Invalid JSON isn't caught until then.

**Recommendations:**
- Validate JSON on blur or with debounce
- Show eval_spec schema hints based on selected eval_type
- Auto-generate idempotency key and show warning if user clears it

### 6. Recognition Rather Than Recall
**Score: 4/10**

| Issue | Severity | Location |
|-------|----------|----------|
| Users must remember JSON schema for each eval type | High | Eval spec textarea |
| Dataset samples not previewable when selecting dataset | Medium | Dataset select |
| No breadcrumbs showing selected evaluation context | Medium | Run details |

**Evidence:** `getDefaultEvalSpecForType` (lines 60-159) provides defaults, but users can't see the schema requirements while editing.

**Recommendations:**
- Add collapsible "Schema reference" panel in create modal
- Show dataset preview tooltip on hover in select
- Add breadcrumb: "Evaluations > my-eval > Run #123"

### 7. Flexibility and Efficiency of Use
**Score: 4/10**

| Issue | Severity | Location |
|-------|----------|----------|
| No keyboard shortcuts for common actions | High | Global |
| No saved presets/templates for eval configurations | High | Create modal |
| No URL deep-linking to specific evaluation or run | High | Navigation |
| No copy-to-clipboard for eval/run IDs | Medium | Details cards |

**Evidence:** The page uses only click-based navigation. No `useEffect` hooks for keyboard handlers. No URL params for selection state.

**Recommendations:**
- Add keyboard shortcuts: `n` (new eval), `r` (start run), `esc` (deselect)
- Implement URL routing: `/evaluations/:evalId/runs/:runId`
- Add "Save as template" for frequently-used configurations

### 8. Aesthetic and Minimalist Design
**Score: 3/10**

| Issue | Severity | Location |
|-------|----------|----------|
| Right column has 7 stacked cards creating visual overload | High | Layout |
| Alert boxes add clutter (info, warning, hints everywhere) | Medium | Throughout |
| Dense JSON preview blocks dominate visual space | Medium | Details cards |

**Evidence:** Lines 1348-2124 show 7 cards stacked in the right column: Rate limits, Ad-hoc evaluator, Runs, Run details, Datasets, History, Webhooks.

**Recommendations:**
- Group related features into tabs or collapsible sections
- Use progressive disclosure - hide advanced features by default
- Replace JSON previews with formatted key-value displays

### 9. Help Users Recognize, Diagnose, and Recover from Errors
**Score: 6/10**

| Issue | Severity | Location |
|-------|----------|----------|
| Generic error messages ("Failed to create evaluation") | Medium | Notifications |
| No suggestions for common errors (rate limit, auth) | Medium | Error handlers |
| Rate limit errors don't auto-retry | Medium | Mutation handlers |

**Evidence:** Error handlers (e.g., lines 496-513) show `error?.message` but don't categorize or suggest fixes.

**Recommendations:**
- Categorize errors: auth (re-login), rate limit (show countdown), validation (highlight field)
- Add "Retry after X seconds" countdown for rate limit errors
- Link to documentation for complex errors

### 10. Help and Documentation
**Score: 3/10**

| Issue | Severity | Location |
|-------|----------|----------|
| No contextual help or tooltips | High | Throughout |
| Dense hint alerts are ignored after first read | Medium | Modal alerts |
| No "Learn more" links to documentation | High | Forms |

**Evidence:** The create modal shows a dense Alert (lines 2150-2162) with all eval types in one paragraph. This is overwhelming and likely ignored.

**Recommendations:**
- Add `?` help icons that open contextual documentation
- Create an onboarding tour for first-time users
- Add inline examples in form fields

---

### Heuristic Summary Scores

| Heuristic | Score | Priority |
|-----------|-------|----------|
| H1: Visibility of system status | 4/10 | High |
| H2: Match between system and real world | 5/10 | Medium |
| H3: User control and freedom | 6/10 | Medium |
| H4: Consistency and standards | 7/10 | Low |
| H5: Error prevention | 5/10 | High |
| H6: Recognition rather than recall | 4/10 | High |
| H7: Flexibility and efficiency of use | 4/10 | High |
| H8: Aesthetic and minimalist design | 3/10 | High |
| H9: Error recovery | 6/10 | Medium |
| H10: Help and documentation | 3/10 | High |

**Overall Score: 4.7/10**

---

## Part 2: User Journey Map

### Primary Flow: Create and Run First Evaluation

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ STAGE 1: DISCOVERY                                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│ User Action     │ Land on Evaluations page                                  │
│ User Feeling    │ 😰 Overwhelmed by dense 2-column layout                   │
│ Pain Points     │ • No clear starting point                                 │
│                 │ • 7 cards in right column compete for attention           │
│                 │ • "Recent evaluations" empty with no guidance             │
│ Opportunity     │ Show onboarding state with guided first steps             │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ STAGE 2: CREATE EVALUATION                                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│ User Action     │ Click "New evaluation" button                             │
│ User Feeling    │ 😕 Confused by modal with JSON textarea                   │
│ Pain Points     │ • Must understand JSON schema for eval_spec               │
│                 │ • 13 eval types with no descriptions                      │
│                 │ • Idempotency key field is cryptic                        │
│                 │ • Inline dataset checkbox is hidden workflow              │
│ Opportunity     │ Wizard with eval type selection first, then guided config │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ STAGE 3: CONFIGURE RUN                                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│ User Action     │ Select newly created eval, fill run config form           │
│ User Feeling    │ 😣 Frustrated - must scroll to find run form              │
│ Pain Points     │ • Run form buried in "Runs" card after scrolling          │
│                 │ • Config JSON textarea with no validation                 │
│                 │ • Dataset override is another JSON field                  │
│                 │ • Webhook URL purpose unclear                             │
│ Opportunity     │ Show run config inline after selection, validate JSON     │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ STAGE 4: MONITOR RUN                                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│ User Action     │ Click "Start run", wait for completion                    │
│ User Feeling    │ 😟 Uncertain - is it still running?                       │
│ Pain Points     │ • Status text only, no progress indicator                 │
│                 │ • Silent 3-second polling, no visual feedback             │
│                 │ • Must manually click run to see details                  │
│ Opportunity     │ Auto-navigate to run details, show progress bar           │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ STAGE 5: ANALYZE RESULTS                                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│ User Action     │ View run details and metrics                              │
│ User Feeling    │ 😞 Disappointed - just raw JSON, no visualization         │
│ Pain Points     │ • Metrics shown as JSON, not charts                       │
│                 │ • No comparison with previous runs                        │
│                 │ • No export or sharing options                            │
│                 │ • Results snippets truncated at 40 lines                  │
│ Opportunity     │ Add metric charts, comparison view, export to CSV         │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Secondary Flow: Manage Datasets

```
User Goal: Create a reusable dataset for evaluations

Current Journey:
1. Scroll to "Datasets" card (buried among 7 cards)
2. Click "New dataset"
3. Fill form with JSON samples in textarea
4. Submit and hope JSON is valid
5. View samples via modal with pagination

Pain Points:
- Dataset creation modal requires typing JSON samples
- No CSV/file upload option
- Sample preview pagination is slow (server round-trip per page)
- Cannot edit existing dataset samples

Improvement: Add CSV import, drag-drop JSON file upload, inline sample editor
```

---

## Part 3: Prioritized Recommendations

### Quick Wins (< 1 week effort)

| # | Recommendation | Impact | Effort | Heuristics |
|---|----------------|--------|--------|------------|
| 1 | **Add JSON validation on blur** - Show red border and error message when JSON is invalid | High | Low | H5, H9 |
| 2 | **Add loading indicator during polling** - Pulsing badge or spinner when auto-refreshing | High | Low | H1 |
| 3 | **Add tooltips for technical fields** - "Idempotency key", eval types, metrics | Medium | Low | H2, H10 |
| 4 | **Collapse advanced fields by default** - Idempotency key, dataset override, webhook URL | Medium | Low | H8 |
| 5 | **Add copy-to-clipboard for IDs** - Eval ID, Run ID, Dataset ID | Medium | Low | H7 |

### Medium Effort (1-4 weeks)

| # | Recommendation | Impact | Effort | Heuristics |
|---|----------------|--------|--------|------------|
| 6 | **Implement URL routing** - `/evaluations/:evalId/runs/:runId` for deep linking | High | Medium | H7 |
| 7 | **Add metric visualizations** - Bar charts for scores, pass/fail badges with thresholds | High | Medium | H1, H8 |
| 8 | **Create tab-based layout** - Split into: Evaluations, Runs, Datasets, Settings tabs | High | Medium | H8 |
| 9 | **Add JSON editor with syntax highlighting** - Use Monaco or CodeMirror | Medium | Medium | H5, H6 |
| 10 | **Implement breadcrumb navigation** - "Evaluations > my-eval > Run #123" | Medium | Medium | H6 |

### Major Redesign (4+ weeks)

| # | Recommendation | Impact | Effort | Heuristics |
|---|----------------|--------|--------|------------|
| 11 | **Wizard-based evaluation creation** - Multi-step: Type → Config → Dataset → Review | High | High | H2, H5, H6 |
| 12 | **Visual spec builder** - Form fields instead of JSON for common eval types | High | High | H5, H6 |
| 13 | **Run comparison view** - Side-by-side metrics, diff highlighting | High | High | H3, H7 |
| 14 | **Dataset file upload** - CSV import, JSON drag-drop | Medium | High | H7 |
| 15 | **Onboarding tour** - First-time user guided walkthrough | Medium | High | H10 |

---

## Part 4: Recommended Redesign - Tab-Based Architecture

### Proposed Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Evaluations Playground                                            [?] [⚙️]  │
├─────────────────────────────────────────────────────────────────────────────┤
│ [Evaluations] [Runs] [Datasets] [Webhooks] [History]                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Tab Content Area                                                     │   │
│  │                                                                       │   │
│  │ • Single-purpose view per tab                                        │   │
│  │ • Reduces cognitive load                                             │   │
│  │ • URL routes: /evaluations, /evaluations/runs, etc.                 │   │
│  │                                                                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ Contextual Sidebar (when item selected)                              │  │
│  │ • Quick actions                                                       │  │
│  │ • Summary stats                                                       │  │
│  │ • Rate limits (always visible, compact)                              │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Tab: Evaluations

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Evaluations                                      [+ New Evaluation] [Filter]│
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐│
│ │ Search: [________________________] Type: [All ▼]                        ││
│ └─────────────────────────────────────────────────────────────────────────┘│
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐│
│ │ Name          │ Type            │ Dataset       │ Last Run   │ Actions  ││
│ ├───────────────┼─────────────────┼───────────────┼────────────┼──────────┤│
│ │ qa-quality-v2 │ response_quality│ qa_samples_v1 │ 2h ago ✓   │ [▶][✎][⋮]││
│ │ rag-pipeline  │ rag_pipeline    │ rag_test_set  │ 1d ago ✓   │ [▶][✎][⋮]││
│ │ ocr-accuracy  │ ocr             │ -             │ Never      │ [▶][✎][⋮]││
│ └─────────────────────────────────────────────────────────────────────────┘│
│                                                                             │
│ [▶] = Start Run  [✎] = Edit  [⋮] = More (Duplicate, Delete, View Runs)     │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Tab: Runs (with URL: `/evaluations/runs/:runId`)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ← Back to Evaluations    Run: run_abc123                    [Cancel] [↻]   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ ┌───────────────────────────────┐ ┌───────────────────────────────────────┐│
│ │ Status: ●  Running            │ │ Evaluation: qa-quality-v2            ││
│ │ Progress: ████████░░ 78%      │ │ Model: gpt-4                          ││
│ │ Samples: 156/200              │ │ Started: 2 min ago                    ││
│ └───────────────────────────────┘ └───────────────────────────────────────┘│
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐│
│ │ Metrics                                                    [Compare ▼] ││
│ │                                                                         ││
│ │ Coherence     ████████████████████████░░░░ 0.82                        ││
│ │ Relevance     ██████████████████████████░░ 0.91                        ││
│ │ Groundedness  ███████████████████░░░░░░░░░ 0.68  ⚠️ Below threshold    ││
│ │                                                                         ││
│ └─────────────────────────────────────────────────────────────────────────┘│
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐│
│ │ Results JSON                                               [Copy] [↓]  ││
│ │ ┌─────────────────────────────────────────────────────────────────────┐││
│ │ │ {                                                                   │││
│ │ │   "metrics": {                                                      │││
│ │ │     "coherence": 0.82,                                              │││
│ │ └─────────────────────────────────────────────────────────────────────┘││
│ └─────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
```

### Modal: Create Evaluation (Wizard)

```
Step 1 of 3: Choose Evaluation Type
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  ○ Response Quality                                                         │
│    Evaluate coherence, relevance, and conciseness of model outputs          │
│                                                                             │
│  ○ RAG Pipeline                                                             │
│    Test retrieval precision, faithfulness, and answer relevancy             │
│                                                                             │
│  ○ Exact Match                                                              │
│    Compare outputs against expected answers                                  │
│                                                                             │
│  ○ GEval                                                                    │
│    Use G-Eval scoring methodology                                           │
│                                                                             │
│  [Show all 13 types...]                                                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

                              [Cancel]  [Next →]


Step 2 of 3: Configure Evaluation
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  Name *                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ my-response-quality-eval                                             │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Metrics to evaluate                                                        │
│  ☑ Coherence   ☑ Relevance   ☐ Groundedness   ☐ Conciseness               │
│                                                                             │
│  Threshold (minimum passing score)                                          │
│  ┌──────────────┐                                                          │
│  │ 0.7          │                                                          │
│  └──────────────┘                                                          │
│                                                                             │
│  [▼ Advanced: Custom eval_spec JSON]                                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

                       [← Back]  [Cancel]  [Next →]
```

---

## Part 5: Proposed Component Hierarchy

### Current Structure (Monolithic)

```
EvaluationsPlaygroundPage.tsx (2,532 lines)
├── 40+ useState hooks
├── 15+ useQuery/useMutation hooks
├── 7 Card components inline
├── 3 Modal components inline
└── All business logic in one file
```

### Proposed Structure (Modular)

```
src/components/Option/Evaluations/
├── EvaluationsPage.tsx                 # Main page with tab router
├── tabs/
│   ├── EvaluationsTab/
│   │   ├── EvaluationsTab.tsx          # List view with table
│   │   ├── EvaluationRow.tsx           # Single row component
│   │   ├── EvaluationFilters.tsx       # Search and type filter
│   │   └── CreateEvaluationWizard/
│   │       ├── CreateEvaluationWizard.tsx
│   │       ├── EvalTypeStep.tsx
│   │       ├── ConfigStep.tsx
│   │       ├── DatasetStep.tsx
│   │       └── ReviewStep.tsx
│   ├── RunsTab/
│   │   ├── RunsTab.tsx                 # Runs list/detail view
│   │   ├── RunsList.tsx                # List of runs
│   │   ├── RunDetail.tsx               # Run detail panel
│   │   ├── MetricsChart.tsx            # Visual metrics display
│   │   ├── RunConfigForm.tsx           # Start run form
│   │   └── RunProgress.tsx             # Progress indicator
│   ├── DatasetsTab/
│   │   ├── DatasetsTab.tsx
│   │   ├── DatasetsList.tsx
│   │   ├── CreateDatasetModal.tsx
│   │   ├── DatasetPreview.tsx
│   │   └── SampleEditor.tsx
│   ├── WebhooksTab/
│   │   ├── WebhooksTab.tsx
│   │   └── WebhookForm.tsx
│   └── HistoryTab/
│       ├── HistoryTab.tsx
│       └── HistoryFilters.tsx
├── components/
│   ├── JsonEditor.tsx                  # Reusable JSON editor with validation
│   ├── StatusBadge.tsx                 # Animated status indicators
│   ├── RateLimitsWidget.tsx            # Compact rate limits display
│   ├── EvalTypeSelector.tsx            # Type picker with descriptions
│   └── QuotaBar.tsx                    # Visual quota consumption
├── hooks/
│   ├── useEvaluations.ts               # Evaluations CRUD operations
│   ├── useRuns.ts                      # Runs CRUD + polling logic
│   ├── useDatasets.ts                  # Datasets operations
│   ├── useWebhooks.ts                  # Webhooks operations
│   └── useEvaluationDefaults.ts        # User preferences
└── utils/
    ├── evalSpecSchemas.ts              # JSON schemas per eval type
    ├── metricsFormatter.ts             # Format metrics for display
    └── urlParams.ts                    # URL state management
```

### Key Component Responsibilities

**EvaluationsPage.tsx** (~100 lines)
```typescript
// Minimal orchestration - just routing and layout
export const EvaluationsPage = () => {
  const { tab } = useParams<{ tab?: string }>()

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader title="Evaluations Playground" />
      <Tabs activeKey={tab || 'evaluations'}>
        <TabPane key="evaluations" tab="Evaluations">
          <EvaluationsTab />
        </TabPane>
        <TabPane key="runs" tab="Runs">
          <RunsTab />
        </TabPane>
        {/* ... */}
      </Tabs>
      <RateLimitsWidget /> {/* Always visible sidebar */}
    </div>
  )
}
```

**useRuns.ts** (~150 lines)
```typescript
// Extract all run-related logic into a custom hook
export const useRuns = (evalId?: string) => {
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)

  const runsQuery = useQuery({
    queryKey: ['evaluations', 'runs', evalId],
    queryFn: () => listRuns(evalId!),
    enabled: !!evalId,
  })

  const runDetailQuery = useQuery({
    queryKey: ['evaluations', 'run', selectedRunId],
    queryFn: () => getRun(selectedRunId!),
    enabled: !!selectedRunId,
    refetchInterval: (query) => {
      const status = query.state.data?.status
      return ['running', 'pending'].includes(status) ? 3000 : false
    },
  })

  const createRunMutation = useMutation({...})
  const cancelRunMutation = useMutation({...})

  return {
    runs: runsQuery.data,
    isLoading: runsQuery.isLoading,
    selectedRunId,
    selectRun: setSelectedRunId,
    runDetail: runDetailQuery.data,
    isPolling: runDetailQuery.isFetching && ['running', 'pending'].includes(runDetail?.status),
    createRun: createRunMutation.mutate,
    cancelRun: cancelRunMutation.mutate,
  }
}
```

**JsonEditor.tsx** (~80 lines)
```typescript
// Reusable JSON editor with validation
type Props = {
  value: string
  onChange: (value: string) => void
  schema?: JSONSchema  // Optional schema for validation
  placeholder?: string
}

export const JsonEditor = ({ value, onChange, schema, placeholder }: Props) => {
  const [error, setError] = useState<string | null>(null)

  const handleChange = (newValue: string) => {
    onChange(newValue)
    // Debounced validation
    validateJson(newValue, schema)
      .then(() => setError(null))
      .catch((e) => setError(e.message))
  }

  return (
    <div>
      <CodeMirror
        value={value}
        onChange={handleChange}
        extensions={[json()]}
        className={error ? 'border-red-500' : ''}
      />
      {error && <div className="text-red-500 text-xs mt-1">{error}</div>}
    </div>
  )
}
```

---

## Part 6: Migration Path

### Phase 1: Foundation (Week 1-2)
1. **Extract custom hooks** - Move query/mutation logic into `useEvaluations`, `useRuns`, `useDatasets`
2. **Add URL routing** - Implement `/evaluations/:evalId/runs/:runId` with react-router
3. **Create JsonEditor component** - Replace all `<Input.TextArea>` for JSON with validated editor

### Phase 2: Tab Structure (Week 3-4)
1. **Split into tab components** - Create `EvaluationsTab`, `RunsTab`, `DatasetsTab`
2. **Add breadcrumb navigation** - Show current context path
3. **Implement rate limits widget** - Always-visible compact display

### Phase 3: Polish (Week 5-6)
1. **Add metrics visualization** - Bar charts for scores, pass/fail badges
2. **Create wizard for evaluation creation** - Multi-step flow with type descriptions
3. **Implement keyboard shortcuts** - `n` new, `r` run, `esc` back

### Phase 4: Advanced Features (Week 7-8)
1. **Run comparison view** - Side-by-side metrics comparison
2. **Dataset file upload** - CSV/JSON import
3. **Onboarding tour** - First-time user walkthrough

---

## Appendix: What to Keep

The current implementation has several strengths worth preserving:

1. **Comprehensive feature set** - All API capabilities are exposed
2. **React Query integration** - Good cache/refetch patterns
3. **Polling for run status** - Auto-refresh on running/pending runs (lines 379-385)
4. **Default spec generation** - `getDefaultEvalSpecForType()` provides reasonable defaults
5. **Idempotency key support** - Prevents duplicate creation on retry
6. **Error notification pattern** - Consistent toast notifications

---

## References

- Nielsen, J. (1994). *10 Usability Heuristics for User Interface Design*
- Cooper, A. (2014). *About Face: The Essentials of Interaction Design*
- Ant Design Documentation: https://ant.design/
- tldw_server API Documentation: (internal)
