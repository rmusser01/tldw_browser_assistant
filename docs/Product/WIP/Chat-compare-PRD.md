# Chat Compare – PRD

## Overview

This feature enables users to generate and compare responses from multiple models within a single “Playground” chat turn, select one or more answers as the preferred responses, and either:

- Continue chatting with a single chosen model, or
- Keep multiple models “active” and send subsequent turns to all of them in parallel.

Users can also:

- Give individualized replies to each model inside the compare view (parallel convos in one UI).
- Split any model’s thread into a dedicated single‑model chat for focused deep dives.
- Build a canonical transcript by pinning one answer per multi‑model turn and exporting the result.

Compare mode is scoped **per chat** (not global) and the maximum number of models per turn is **configurable** (with a sane default).

---

## Problem / Opportunity

**Today**

- The Playground supports one message → one model → one reply.
- To compare models, users must:
  - Manually duplicate prompts across different chats.
  - Keep mental track of which chat corresponds to which model.
  - Copy/paste answers to compare them side‑by‑side.

**Pain**

- Slow and error‑prone to compare subjective/opinionated responses.
- Hard to see where models disagree or where one model surfaces better reasoning.
- Difficult to “follow a thread” with a promising model while still exploring others.

**Opportunity**

- Provide a first‑class “compare models” experience:
  - Side‑by‑side (or stacked) answers for the same prompt.
  - Direct selection of preferred answers.
  - Smooth transition from multi‑model comparison to focused single‑model chats.
  - Parallel per‑model threads, all visible within one UI.

---

## Goals & Non‑Goals

### Goals

- **G1:** Let users send a single prompt to multiple selected models and view their replies as one multi‑model reply cluster.
- **G2:** Let users select one or more answers from a cluster as preferred responses.
- **G3:** If one answer is selected, allow continuing the chat with that model only (normal single‑model flow).
- **G4:** If multiple answers are selected, allow sending the next message to all selected models (parallel conversations).
- **G5:** Allow per‑model follow‑up questions within the cluster (individualized mini threads).
- **G6:** Allow splitting any model’s thread from a cluster into a separate single‑model chat, with clear breadcrumbs between them.
- **G7:** Allow users to build and export a single canonical transcript by pinning one answer per multi‑model cluster.

### Non‑Goals

- **N1:** No new pricing or quota logic; treat each model call as a normal request.
- **N2:** No requirement to persist compare‑mode selections to the server in v1; local persistence per chat is sufficient.
- **N3:** No requirement to support arbitrarily many models per turn; a configurable limit (default 3) is acceptable.

---

## Scope & Interoperability

### Scope (v1)

- Compare mode is available **only in the Options Playground chat** (the main `/` Playground route).
- Out of scope in v1:
  - Sidepanel chat.
  - Media review chat and other specialized views (e.g., Review, Notes, Knowledge).
  - STT/TTS and Prompt Studio playgrounds.

Future phases may expand coverage, but this PRD assumes implementation in the primary Playground first.

### Interoperability with Existing Features

- **RAG / Knowledge context**
  - All models in a compare turn share the **same context** as a normal single‑model turn:
    - Same RAG / knowledge configuration (mode, top‑K, sources).
    - Same selected documents / media context.
  - Compare mode does not introduce per‑model RAG settings in v1.

- **Web Search / Tools**
  - Web search and tools run **per model**:
    - If web search or tools are enabled for the turn, each model’s request may trigger its own tool/web search usage.
    - Errors or tool failures for one model are confined to that model’s card.

- **Server‑backed chats**
  - Compare mode is **local only for now**:
    - Multi‑model turns and clusters are stored in local Dexie history.
    - v1 does not sync compare‑mode turns to server‑backed chat sessions.
  - Split‑off chats created from compare clusters are also local in v1; future work may add server‑backed branches.

---

## Implementation Phases

### Phase 1 – Core Compare Mode (MVP)

Focus: basic multi‑model answers in one turn, simple selection, and per‑chat compare state.

- Enable per‑chat **Compare** toggle and multi‑select model picker (FR1).
- When Compare is ON, send a single prompt to multiple models and render a **multi‑model cluster** under the user message (FR2, FR3).
- Allow selecting one or more answers in a cluster and show selection state in a footer strip (FR4.1–FR4.2).
- Support:
  - Single‑selection → `Continue with this model` to switch the chat back to single‑model mode (FR4.3, FR5).
  - Multi‑selection → set active models and send the next global message to all active models (FR4.4–FR4.5, FR5.2–FR5.3).
- Implement core data/state wiring:
  - `compareMode`, `compareSelectedModels` per chat.
  - Basic `clusterId`/`messageType` metadata and grouping logic.

Out of scope for Phase 1:

- Per‑model mini composers.
- Split‑off chats.
- Canonical transcript and export.

### Phase 2 – Per‑Model Threads & Split‑Off Chats

Focus: individualized responses per model and the ability to branch into dedicated chats.

- Add **per‑model mini composers** inside each card to reply only to that model (FR6).
  - Scoped turns that extend only that model’s thread.
  - Short per‑model thread preview in each card.
- Implement **Open as full chat**:
  - Create new single‑model chats seeded with shared history and the chosen model’s responses (FR7.1–FR7.2).
  - Show breadcrumbs in the new chat header back to the originating comparison (FR7.3).
  - Indicate on the original card that a split chat exists, with a link back (FR7.4).
- Support **bulk split** when multiple answers are selected (`Open each selected answer as its own chat`) (FR7.5).
- Ensure split‑off chats:
  - Pre‑select the originating model but allow model switching freely (FR7.6).
- Integrate compare sessions and split‑off chats into history/navigation (FR8).

### Phase 3 – Canonical Transcript & Export + Polish

Focus: canonical answers, export, polish, and observability.

- Allow **pinning** exactly one canonical answer per cluster (FR9.1–FR9.2).
- Render a consolidated assistant bubble under clusters that have a canonical answer (FR9.3).
- Implement `Export canonical transcript` from the chat menu (FR9.4–FR9.5).
- Add configuration for **max models per turn** (default 3) and refine edge‑state UX (limits, errors) (Edge States & Limits).
- Add telemetry/metrics for compare usage, selection patterns, split‑off usage, and exports (Telemetry & Metrics).
- UX polish and performance tuning based on early feedback (e.g., cluster collapsing, thread preview truncation).

---

## Personas & Key Use Cases

### Personas

- **Researcher / Power User**
  - Wants to see where models agree/disagree on subjective topics.
  - Needs quick comparisons of tone, citation behavior, and nuance.
- **Developer / Prompt Engineer**
  - Iterates on prompts across different models/providers.
  - Needs to see which model best follows instructions or output formats.
- **Analyst / Knowledge Worker**
  - Asks complex reasoning questions.
  - Needs to explore multiple model “angles” but then go deep with one.

### Key Use Cases

- **UC1 – Opinion comparison:** Ask “Is framework X a good choice for Y?” and see 3–4 models’ takes in one cluster.
- **UC2 – Choose best answer:** Pick the most accurate/rigorous answer and continue the chat with that model alone.
- **UC3 – Parallel exploration:** Keep multiple models active across several turns to maintain multiple perspectives.
- **UC4 – Per‑model probing:** Ask targeted follow‑up questions to individual models within the cluster.
- **UC5 – Focused deep dive:** When a model surfaces a promising idea, split its thread into a dedicated single‑model chat.
- **UC6 – Canonical summary:** For each multi‑model turn, pin the best answer and export a user + canonical‑assistant transcript.

---

## User Experience

### 1. Entry Point: Compare Mode (Per‑Chat)

- A **Compare** toggle is added in the Playground header/composer area near the model selector.
- Behavior:
  - When **OFF**:
    - Existing behavior: one active model from the model selector.
  - When **ON**:
    - Model selector becomes multi‑select (e.g., “Selected: 3 models”).
    - A banner above the composer shows:  
      `Compare mode · Sending to N models`.
    - Selected models are stored **per chat** and restored when returning to that chat.
- Compare mode state (ON/OFF + selected models) is remembered per chat across page reloads.

### 2. Sending a Multi‑Model Turn

When Compare mode is ON and the user hits Send:

- A **single user message bubble** appears in the timeline (as today).
- Immediately below it, a **multi‑model answers cluster** is created:
  - One card per selected model.
  - Each card independently streams / resolves.
  - One model’s error does not block others.

### 3. Multi‑Model Cluster Layout

For each cluster:

  - **Cluster header**:
    - Label: `Multi‑model answers (N)`.
    - Optional actions (future): expand/collapse, filter models.

  - **Cards**:
  - **Header:**
    - Model name and provider icon (e.g., `GPT‑4o · OpenAI`).
    - Optional metadata (latency, token count) when available.
    - Overflow menu (`⋯`) with at least:
      - `Open as full chat`
      - (Future) `Focus on this model`, `Copy answer`.
  - **Body:**
    - Model answer as standard assistant text (with existing formatting, sources, etc.).
  - **Mini thread preview (Phase 2+):**
    - A short preview of per‑model history (latest 2–4 exchanges) within that model’s thread.
  - **Footer:**
    - Selection affordance (checkbox or “Use this answer” button).
    - A mini composer (see section 5).

- **Cluster footer strip** (full width under cards):
  - Shows selection state:
    - `Selected as answer: [ ] Model A  [✓] Model B  [ ] Model C`.
  - Behavior:
    - If **exactly 1** answer selected:
      - Primary button: `Continue with this model`.
      - Secondary: `Compare models again`.
    - If **2+** answers selected:
      - Label: `Active models next turn: Model B, Model C`.
      - Hint text: `Your next message will be sent to each active model.`

### 4. Answer Selection & Continuation

**Single selection (continue with one model)**

- When the user selects exactly one answer and clicks `Continue with this model`:
  - That model becomes the active model for this chat:
    - The chat returns to normal single‑model behavior.
    - The model selector is set to that model (user can still change it later).
  - Compare mode is turned OFF by default (user can re‑enable).
  - In the cluster:
    - The chosen card is highlighted as `Chosen answer`.
    - Other cards can be collapsed behind a link: `Show alternative answers (N)`.

**Multiple selections (parallel active models)**

- When the user selects 2+ answers:
  - An **Active models bar** appears above the composer:
    - `Active models: [Model B] [Model C]`.
  - The Send button label adapts:
    - `Send to 2 models`.
  - On Send:
    - The new user message is broadcast to all active models.
    - A new cluster is rendered using only those models.
  - The user can adjust the active set via:
    - Toggling chips in the Active models bar.
    - Opening the model picker while Compare mode is ON.
  - The Active models bar remains visible while multiple models are active, until the user returns to single‑model mode or clears the selection.

### 5. Per‑Model Mini Composers (Individualized Replies)

Inside each model card:

- A mini composer labeled `Reply only to [Model]` is available:
  - Either always visible as a small input, or as a “Reply…” link that expands an input.
- When the user sends from this mini composer:
  - A new **scoped turn** is created inside this card:
    - “You → [Model]” only; other models are unaffected.
  - A short per‑model thread is shown (e.g., last 2–4 exchanges):
    - `You (shared): Is AI dangerous?`
    - `Model: [cluster answer]`
    - `You (only Model): Please expand on X.`
    - `Model: [follow‑up answer].`

The main global composer continues to work as a **broadcast** tool in Compare mode and a **single‑model** composer when Compare mode is OFF.

### 6. Split‑Off Single‑Model Chats

Each model card has an overflow menu `⋯` with `Open as full chat`.

**Behavior when clicked:**

- A new **single‑model chat** is created:
  - Seeded history includes:
    - All shared user messages up to and including the selected multi‑model turn.
    - All replies and per‑model follow‑ups for this model under that cluster.
- Navigation:
  - The user is taken to this new chat.
  - The model selector is pre‑selected to the originating model, but:
    - The user **may switch models** freely in the new chat; it is not locked.

**Breadcrumbs & linking:**

- New chat header shows:
  - `← Back to comparison · From multi‑model session (timestamp/title)`.
- In the original cluster:
  - The card shows a badge linking back:
    - `Spawned chat →` or `Open split chat`.

**Bulk split:**

- When multiple answers are selected in a cluster:
  - Cluster footer offers `Open each selected answer as its own chat`.
  - Creates N new single‑model chats (one per selected model).

### 7. Canonical Transcript & Export

To support sharing and documentation, users can designate one answer per cluster as the **canonical** reply and export a linear transcript.

- Within each cluster:
  - Model cards can be marked `Pin as canonical answer`.
  - Only one canonical answer per cluster.
  - When pinned:
    - The card is labeled `Canonical`.
    - A consolidated assistant bubble is rendered below the cluster as the “official” answer for that turn.

- At the chat level:
  - The chat menu provides `Export canonical transcript`:
    - Builds a transcript consisting of:
      - User messages.
      - Canonical assistant replies where available.
    - For clusters without a canonical answer:
      - Behavior is implementation‑defined (e.g., use first reply or omit).

### 8. Edge States & Limits

- Max models per compare turn is **configurable**, with:
  - Default: 3.
  - Config range: e.g., 2–4 models.
  - UI prevents selecting more than the configured maximum and shows a short hint when the limit is reached.
- Error handling:
  - If a model fails, its card shows an error banner.
  - By default, errored cards are **not** selectable as answers; selection is limited to successful responses.
  - Other models’ cards still render normally.
- Empty output:
  - If no answer is selected, the cluster is purely informational; the chat continues with whichever mode is active (single‑model or compare).
- Concurrency and latency:
  - Requests to selected models in a compare turn may be issued in parallel up to the per‑chat max.
  - High latency for one model must not block display of other models; long‑running cards can show a “still running…” state.

---

## Functional Requirements

### FR1 – Compare Mode Toggle (Per‑Chat)

- FR1.1: Users can toggle Compare mode ON/OFF from the Playground UI.
- FR1.2: When Compare mode is ON, the model selector supports multi‑selection and displays a count of selected models.
- FR1.3: Compare mode state (ON/OFF and selected models) is remembered per chat across reloads.

### FR2 – Multi‑Model Turn Execution

- FR2.1: When Compare mode is ON and the user sends a message, the system issues requests to all selected models with the same prompt and context.
- FR2.2: Responses are associated with the originating user message and grouped as a multi‑model cluster.
- FR2.3: Each model’s request is handled independently; partial failures do not cancel the entire turn.

### FR3 – Cluster Rendering

- FR3.1: Each multi‑model turn appears as a user message followed by a multi‑model cluster.
- FR3.2: Each card clearly displays model identity and provider.
- FR3.3: Loading, success, and error states are shown per card.

### FR4 – Answer Selection & Active Models

- FR4.1: Users can select one or more model answers within a cluster.
- FR4.2: The cluster footer always reflects the current selection state.
- FR4.3: When exactly one answer is selected, a `Continue with this model` action is available.
- FR4.4: When 2+ answers are selected, an `Active models next turn` summary is shown.
- FR4.5: The next global message in Compare mode is sent to the active model set defined by the latest selection.

### FR5 – Global Composer Behavior

- FR5.1: When Compare mode is OFF, the global composer behaves as today (single active model).
- FR5.2: When Compare mode is ON and at least one model is selected, the global composer sends prompts to all active models and renders the results as a new cluster.
- FR5.3: The Send button text reflects the current mode (e.g., `Send to 3 models`).

### FR6 – Per‑Model Mini Composers

- FR6.1: Each model card provides a mini composer scoped to that model.
- FR6.2: Messages sent from a mini composer create new turns that affect only that model’s thread.
- FR6.3: Each card can show a short preview of its per‑model thread, with an optional “View full thread” affordance.

### FR7 – Split‑Off Single‑Model Chats

- FR7.1: Each model card exposes `Open as full chat` in its overflow menu.
- FR7.2: Invoking this action creates a new single‑model chat seeded with:
  - Shared user messages up to the selected cluster.
  - That model’s answers and per‑model replies relevant to that cluster.
- FR7.3: The new chat’s header displays a breadcrumb to return to the original comparison session.
- FR7.4: The originating model card shows a badge or link indicating that a split chat exists.
- FR7.5: When multiple answers are selected in a cluster, a bulk `Open each selected answer as its own chat` action is available.
- FR7.6: In split‑off chats, the model selector is pre‑set to the originating model but remains editable; users can switch models in that chat.

### FR8 – History & Navigation

- FR8.1: Compare sessions appear in chat history with a meaningful title (e.g., `Compare: [first user message snippet]`).
- FR8.2: Split‑off chats appear as separate history items, optionally labeled `(from compare)`.
- FR8.3: Navigating between a compare session and its split‑off chats preserves context and does not mutate underlying history.

### FR9 – Canonical Transcript & Export

- FR9.1: Within each cluster, exactly one model answer can be marked as the canonical answer.
- FR9.2: Canonical answers are visually distinguished from other cards.
- FR9.3: When a canonical answer exists, a consolidated assistant bubble is shown under the cluster representing the “official” reply for that turn.
- FR9.4: The chat menu offers `Export canonical transcript`, which builds a user + canonical‑assistant transcript (exported as Markdown or plain text and surfaced as a downloadable file or copy‑to‑clipboard action).
- FR9.5: For clusters with no canonical answer, export falls back to the first model reply in creation order for that turn, or omits the assistant reply if no answers exist.

---

## Data & State Design (High‑Level)

**Store / UI State (per chat):**

- `compareMode: boolean`
- `compareSelectedModels: string[]` — models selected in the composer when Compare mode is ON.
- `compareSelectedModelsByTurn: Record<turnId, string[]>` — preferred answers per cluster.
- `compareActiveModelsByTurn: Record<turnId, string[]>` — active models for subsequent multi‑model turns.

**Message‑level metadata (in‑memory, per message):**

- `messageType?: "compare:user" | "compare:reply" | "compare:perModelUser" | ...`
- `clusterId?: string` — groups user + replies belonging to the same multi‑model turn.
- `modelId?: string` — canonical model identifier for assistant replies.

Allowed `messageType` values (v1+):

- `"compare:user"` — a user message that initiated a multi‑model compare turn.
- `"compare:reply"` — an assistant reply from a specific model to a compare turn.
- `"compare:perModelUser"` — a user follow‑up message scoped to a single model within a compare cluster (mini composer).
- (Other existing values remain valid for non‑compare messages.)

**Underlying storage (Dexie / server):**

- Reuse existing `parent_message_id` and `depth` for per‑model subthreads.
- Multi‑model clusters are derived views over messages sharing the same `clusterId` and `messageType`, plus tree structure.

In v1, `clusterId` and `compare*ByTurn` maps are treated as **UI/view state** and do not need to be persisted beyond what is required to reconstruct clusters from local message history.

Implementation details (hooks, components, and API calls) are covered in separate technical design docs and are not part of this PRD.

---

## Telemetry & Metrics (Nice‑to‑Have)

- Percentage of chats that use Compare mode at least once.
- Average number of models per compare turn and distribution (2 vs 3 vs 4).
- Distribution of single vs multiple selected answers per cluster.
- Frequency of `Open as full chat` usage per model and per session.
- Export usage: how often canonical transcript export is invoked.
- Retention metric: percentage of users who use Compare mode more than once in a session.

### Rollout & Gating

- Phase 1 should ship behind a feature flag or experimental setting (e.g., “Enable Compare mode”) so it can be rolled out gradually.
- Metrics from Phase 1 will inform:
  - Whether to adjust the default max models per turn.
  - Priority of Phase 2 (per‑model threads and split‑off chats) and Phase 3 (canonical export).

---

## Risks & Considerations

- **Cognitive load:** Compare mode introduces several new concepts (multi‑model clusters, selection, mini composers, split‑off chats, canonical answers). UX must remain simple for casual users:
  - Keep Compare mode off by default.
  - Use clear copy and progressive disclosure for advanced options.
- **Latency and cost:** Fan‑out to multiple models increases response time and usage:
  - Encourage sensible defaults (e.g., 2–3 models).
  - Consider future optimizations (e.g., streaming or canceling slow models).
- **History complexity:** Per‑model subthreads increase history volume:
  - Restrict how much per‑model history is rendered inline (e.g., preview only).
  - Offer “View full thread” where needed instead of always expanding everything.

This PRD defines the expected behavior and user experience for Chat Compare. Implementation plans, technical details, and rollout strategy will be captured in accompanying design and engineering documents.
