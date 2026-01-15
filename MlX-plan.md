# UX Audit & Redesign Plan: Llama.cpp and MLX Management Pages

## Executive Summary

This plan addresses a comprehensive UX/HCI redesign of the Llama.cpp and MLX admin playground pages to expose all available functionality with appropriate progressive disclosure, improved information architecture, and consistent design patterns.

---

## Phase 1: UX Audit Findings

### 1.1 Llama.cpp Admin Page (`src/components/Option/Admin/LlamacppAdminPage.tsx`)

#### Currently Exposed Features
- Server status (state, active model, port)
- Model list + dropdown selection
- Start/Stop server buttons
- Manual refresh

#### Hidden API Functionality NOT in UI
| Feature | API Parameter | Current Status |
|---------|---------------|----------------|
| Custom server args | `serverArgs: Record<string, any>` | **Not exposed** |
| Context size | `server_args.n_ctx` | Not exposed |
| GPU layers | `server_args.n_gpu_layers` | Not exposed |
| Thread count | `server_args.threads` | Not exposed |
| Batch size | `server_args.n_batch` | Not exposed |

#### UX Issues Identified

1. **Information Redundancy**: Model dropdown AND model list show identical data
2. **Poor Action Placement**: "Start with selected model" button lives in Status card, not Models card
3. **Missing Configuration**: No way to specify server arguments (context size, GPU layers, etc.)
4. **Weak Visual Hierarchy**: Status and Models cards have equal visual weight despite different importance
5. **No Progress Feedback**: Server start/stop shows only spinner, no progress indication
6. **No Model Details**: Model list shows only filenames, no size/quantization info

---

### 1.2 MLX Admin Page (`src/components/Option/Admin/MlxAdminPage.tsx`)

#### Currently Exposed Features
- Status display (active, model, concurrency, config summary)
- Model path/repo input
- Device selector (auto/mps/cpu)
- Compile & warmup toggles
- Max concurrent input
- Load/unload actions
- Provider model list with capabilities

#### Hidden API Functionality NOT in UI
| Feature | API Parameter | Current Status |
|---------|---------------|----------------|
| Max sequence length | `max_seq_len` | **Not exposed** |
| Max batch size | `max_batch_size` | **Not exposed** |
| Data type | `dtype` | **Not exposed** |
| Quantization | `quantization` | **Not exposed** |
| Prompt template | `prompt_template` | **Not exposed** |
| HF revision/branch | `revision` | **Not exposed** |
| Trust remote code | `trust_remote_code` | **Not exposed** |
| Custom tokenizer | `tokenizer` | **Not exposed** |
| LoRA adapter path | `adapter` | **Not exposed** |
| LoRA adapter weights | `adapter_weights` | **Not exposed** |
| KV cache size | `max_kv_cache_size` | **Not exposed** |

#### UX Issues Identified

1. **Three Cards When Two Suffice**: Status, Load/Unload, and Provider cards could consolidate
2. **Flat Form Layout**: Required vs optional fields indistinguishable
3. **No Model Discovery**: Must manually type model paths - no browsing/autocomplete
4. **Advanced Options Completely Hidden**: 11 parameters unavailable to users
5. **Redundant Provider Info**: Provider card shows little useful info beyond model list
6. **No Resource Indicators**: No memory usage, VRAM, or performance hints

---

## Phase 2: Redesign Recommendations

### 2.1 Shared Design Patterns (Both Pages)

#### Information Architecture
```
┌─────────────────────────────────────────────────────┐
│ Page Header                                          │
│ Title + Description + Connection Status Badge        │
├─────────────────────────────────────────────────────┤
│ Status Panel (Collapsible)                           │
│ - Current state indicator (prominent)                │
│ - Active model info                                  │
│ - Quick actions: Refresh | Stop (if running)         │
├─────────────────────────────────────────────────────┤
│ Model Selection / Load Panel (Primary Focus)         │
│ - Model selector/input (prominent)                   │
│ - Basic settings (always visible)                    │
│ - [Advanced Settings] collapsible section            │
│ - Primary action button                              │
├─────────────────────────────────────────────────────┤
│ Available Models Panel (Optional/Collapsible)        │
│ - Model list with metadata                           │
│ - Quick-load actions                                 │
└─────────────────────────────────────────────────────┘
```

#### Progressive Disclosure Strategy
1. **Level 1 (Always Visible)**: Model selection, status, primary actions
2. **Level 2 (Expandable)**: Common configuration options
3. **Level 3 (Advanced Collapse)**: Expert-level parameters

#### Consistent Components
- Status badges: Green (running), Red (stopped), Yellow (loading), Gray (unknown)
- Refresh buttons in card headers (consistent placement)
- Form layout: Labels above inputs, consistent spacing
- Collapsible sections with clear expand/collapse indicators

---

### 2.2 Llama.cpp Page Redesign

#### New Component Structure
```
LlamacppAdminPage
├── StatusBanner (shared component)
│   ├── State badge (Running/Stopped/Loading)
│   ├── Active model name (if running)
│   ├── Port number (if running)
│   └── Quick Stop button (if running)
│
├── ModelLoadCard (primary interaction)
│   ├── Model Selector (dropdown with model filenames)
│   │
│   ├── Basic Settings Section (always visible)
│   │   ├── Context Size (n_ctx) - InputNumber with presets: 2048, 4096, 8192, 16384
│   │   └── GPU Layers (n_gpu_layers) - InputNumber (0 = CPU only, -1 = all)
│   │
│   ├── Performance Settings (CollapsibleSection)
│   │   ├── Threads (threads) - InputNumber
│   │   ├── Batch Size (n_batch) - InputNumber
│   │   └── Memory Lock (mlock) - Switch
│   │
│   ├── Custom Arguments (CollapsibleSection)
│   │   └── ServerArgsEditor - Toggle between form fields and raw JSON
│   │
│   └── Actions
│       ├── "Start Server" (primary button)
│       └── "Start with Defaults" (link/text button)
│
└── Available Models (CollapsibleSection, secondary)
    └── List of model filenames with quick-select action
```

#### Key Changes
1. **Consolidate to 2 main sections**: StatusBanner + ModelLoadCard
2. **Full server configuration**: All args exposed (n_ctx, n_gpu_layers, threads, n_batch, mlock)
3. **Custom args editor**: JSON mode for power users to pass any server argument
4. **Remove redundant list**: Model list becomes collapsible secondary section
5. **Move primary action**: Start button lives with configuration, not status
6. **Preset buttons**: Quick-set common context sizes

---

### 2.3 MLX Page Redesign

#### New Component Structure
```
MlxAdminPage
├── StatusBanner (condensed, top of page)
│   ├── State badge + Current model
│   ├── Resource indicator (if available)
│   └── Quick Unload button (if loaded)
│
├── ModelLoadCard (primary interaction)
│   ├── Model Input (with autocomplete from known models)
│   │   └── Helper text: "Enter HuggingFace repo or local path"
│   ├── Basic Settings Section
│   │   ├── Device (auto/mps/cpu) - Segmented control
│   │   ├── Compile at load - Toggle
│   │   └── Max concurrent - Input
│   ├── Performance Settings (Collapsible)
│   │   ├── Max Sequence Length
│   │   ├── Max Batch Size
│   │   ├── Data Type (dtype) - Dropdown
│   │   └── KV Cache Size
│   ├── Advanced Settings (Collapsible)
│   │   ├── Quantization - Dropdown
│   │   ├── Warmup - Toggle
│   │   ├── Trust Remote Code - Toggle (with warning)
│   │   ├── HF Revision - Input
│   │   ├── Custom Tokenizer Path - Input
│   │   └── Prompt Template - TextArea
│   ├── LoRA/Adapter Settings (Collapsible)
│   │   ├── Adapter Path - Input
│   │   └── Adapter Weights - Input
│   └── Action: "Load Model" button
│
└── ProviderModels (collapsible, secondary)
    └── List: Model ID | Capabilities (Vision/Tools/Audio)
```

#### Key Changes
1. **Consolidate to 2 sections**: Status + Model Configuration
2. **Expose ALL 11 hidden parameters** via progressive disclosure
3. **Group settings logically**: Basic → Performance → Advanced → LoRA
4. **Add model autocomplete**: Suggest from provider's known models
5. **Add tooltips/help text**: Explain what each parameter does
6. **Trust remote code warning**: Visual alert when enabled

---

## Phase 3: Implementation Plan

### 3.1 User Preferences (Confirmed)
- **Components**: Create shared reusable components
- **Llama.cpp**: Full configuration (all server args + custom JSON editor)
- **MLX**: Three collapsible groups for progressive disclosure

### 3.2 Files to Modify

| File | Changes |
|------|---------|
| `src/components/Option/Admin/LlamacppAdminPage.tsx` | Complete rewrite with full server args |
| `src/components/Option/Admin/MlxAdminPage.tsx` | Complete rewrite with 3-group layout |
| `src/assets/locale/en/settings.json` | Add new translation keys |

### 3.3 New Shared Components to Create

| Component | Purpose |
|-----------|---------|
| `src/components/Option/Admin/StatusBanner.tsx` | Reusable status header with badge, model info, quick actions |
| `src/components/Option/Admin/CollapsibleSection.tsx` | Consistent expand/collapse with icon animation |
| `src/components/Option/Admin/ServerArgsEditor.tsx` | Key-value editor for custom Llama.cpp args (JSON mode toggle) |

### 3.4 Implementation Order

1. **Create `CollapsibleSection.tsx`** - Ant Design Collapse wrapper with consistent styling
2. **Create `StatusBanner.tsx`** - Condensed status display with state badge + quick actions
3. **Create `ServerArgsEditor.tsx`** - Form fields + JSON editor toggle for custom args
4. **Rewrite `LlamacppAdminPage.tsx`**:
   - Use StatusBanner for server state
   - Add all server args: n_ctx, n_gpu_layers, threads, n_batch, mlock
   - Add ServerArgsEditor for custom args
   - Consolidate model selection + configuration
5. **Rewrite `MlxAdminPage.tsx`**:
   - Use StatusBanner for model state
   - Group 1 (Performance): max_seq_len, max_batch_size, dtype, max_kv_cache_size
   - Group 2 (Advanced): quantization, revision, trust_remote_code, tokenizer, prompt_template
   - Group 3 (LoRA): adapter, adapter_weights
6. **Add translation keys** to `src/assets/locale/en/settings.json`
7. **Test both pages** manually

---

## Phase 4: Verification Plan

### Manual Testing Checklist

#### Llama.cpp Page
- [ ] Status displays correctly when server running/stopped
- [ ] Model dropdown shows all available models
- [ ] Server starts with default settings
- [ ] Server starts with custom context size
- [ ] Server starts with custom GPU layers
- [ ] Advanced settings collapse/expand works
- [ ] Stop server works
- [ ] Error states display correctly
- [ ] Admin guard (403/404) displays correctly

#### MLX Page
- [ ] Status displays correctly when model loaded/unloaded
- [ ] Model path input accepts HF repos and local paths
- [ ] Basic settings (device, compile, max_concurrent) work
- [ ] Performance settings (max_seq_len, dtype, etc.) work
- [ ] Advanced settings (quantization, revision, etc.) work
- [ ] LoRA adapter settings work
- [ ] Trust remote code shows warning when enabled
- [ ] Unload model works
- [ ] Error states display correctly
- [ ] Admin guard (403/404) displays correctly

### Build Verification
```bash
bun run compile          # Type check
bun run build:chrome     # Build extension
# Load unpacked extension and test manually
```

---

## Appendix: Full Parameter Reference

### Llama.cpp Server Args (All Exposed in UI)
```typescript
interface LlamacppServerArgs {
  // Basic Settings (always visible)
  n_ctx?: number          // Context size (default: 2048) - affects memory usage
  n_gpu_layers?: number   // GPU layers (0=CPU, -1=all, default: 0)

  // Performance Settings (collapsible)
  threads?: number        // CPU threads (default: auto-detect)
  n_batch?: number        // Batch size for prompt processing (default: 512)
  mlock?: boolean         // Lock model in RAM (default: false)

  // Custom Args (JSON editor)
  [key: string]: any      // Any additional llama.cpp server arguments
}
```

**UI Presets for Context Size:**
- 2048 (Small, ~1.5GB VRAM)
- 4096 (Medium, ~3GB VRAM)
- 8192 (Large, ~6GB VRAM)
- 16384 (XL, ~12GB VRAM)
- Custom input allowed

### MLX Load Request (Complete)
```typescript
interface MlxLoadRequest {
  model_path?: string           // Required: HF repo or local path
  device?: string               // "auto" | "mps" | "cpu"
  compile?: boolean             // Compile model at load
  warmup?: boolean              // Warmup after load
  max_concurrent?: number       // Max concurrent requests
  max_seq_len?: number          // Max sequence length
  max_batch_size?: number       // Max batch size
  dtype?: string                // Data type
  quantization?: string         // Quantization method
  prompt_template?: string      // Custom prompt template
  revision?: string             // HF revision/branch
  trust_remote_code?: boolean   // Trust remote code (security risk)
  tokenizer?: string            // Custom tokenizer path
  adapter?: string              // LoRA adapter path
  adapter_weights?: string      // LoRA weights path
  max_kv_cache_size?: number    // KV cache limit
}
```
