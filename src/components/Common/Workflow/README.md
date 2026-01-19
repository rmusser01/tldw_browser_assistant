# Workflow UI Kit

A guided workflow system for helping new and non-technical users accomplish common tasks through step-by-step wizards.

## Contributor Quick Reference

Adding a new workflow? Here's your checklist:

1. [ ] **Add WorkflowId** - `src/types/workflows.ts` - Add to `WorkflowId` union type
2. [ ] **Define Workflow** - `src/components/Common/Workflow/workflow-definitions.ts` - Create definition & add to `ALL_WORKFLOWS`
3. [ ] **Create Component** - `src/components/Common/Workflow/steps/YourWorkflow.tsx`
4. [ ] **Export Component** - `src/components/Common/Workflow/steps/index.ts`
5. [ ] **Register Switch Case** - `src/components/Common/Workflow/WorkflowContainer.tsx`
6. [ ] **Add Translations** - `src/assets/locale/en/workflows.json`
7. [ ] **Verify** - Run `bun run compile` to check for TypeScript errors

> **Tip:** Copy `steps/_TEMPLATE.tsx.example` as a starting point for your workflow component.

See [Creating a New Workflow](#creating-a-new-workflow) for detailed instructions, or jump to [Troubleshooting](#troubleshooting-contributors) if something isn't working.

## Overview

The Workflow UI Kit provides:

- **Guided Workflows** - Step-by-step wizards for common tasks
- **Progressive Disclosure** - Start simple, reveal complexity on demand
- **Goal-Oriented Entry** - "What do you want to do?" instead of feature overload
- **Contextual Suggestions** - Smart prompts based on user actions

## Architecture

```
src/
├── types/workflows.ts           # Type definitions
├── store/workflows.ts           # Zustand state management
├── hooks/useWorkflowSuggestions.ts  # Suggestion triggers
└── components/Common/Workflow/
    ├── index.ts                 # Public exports
    ├── WizardShell.tsx          # Reusable wizard container
    ├── WorkflowCard.tsx         # Workflow selection card
    ├── WorkflowLanding.tsx      # Welcome/landing page
    ├── WorkflowContainer.tsx    # Active workflow router
    ├── WorkflowButton.tsx       # Header button component
    ├── ContextualSuggestion.tsx # Suggestion components
    ├── SidepanelWorkflowIntegration.tsx  # Sidepanel wrapper
    ├── workflow-definitions.ts  # Workflow catalog
    └── steps/                   # Individual workflow implementations
        ├── SummarizePageWorkflow.tsx
        └── QuickSaveWorkflow.tsx
```

## Quick Start

### 1. Add the Workflow Button to Header

```tsx
import { WorkflowButton } from "@/components/Common/Workflow"

// In your header component:
<WorkflowButton />
```

### 2. Wrap Your Main Component

```tsx
import { SidepanelWorkflowIntegration } from "@/components/Common/Workflow"

// Wrap the sidepanel chat:
<SidepanelWorkflowIntegration>
  <SidepanelChat />
</SidepanelWorkflowIntegration>
```

### 3. Trigger Contextual Suggestions

```tsx
import { useWorkflowSuggestions } from "@/hooks/useWorkflowSuggestions"

const MyComponent = () => {
  const { triggerSuggestion } = useWorkflowSuggestions()

  const handleFileUpload = (file: File) => {
    if (file.type === "application/pdf") {
      triggerSuggestion("pdf-uploaded", { filename: file.name })
    }
  }
}
```

## Components

### WizardShell

The main container for multi-step workflows. Provides:
- Step indicator (Ant Design Steps)
- Navigation (back/next/cancel)
- Processing state with progress bar
- Error handling

```tsx
import { WizardShell } from "@/components/Common/Workflow"
import { SUMMARIZE_PAGE_WORKFLOW } from "@/components/Common/Workflow"

<WizardShell
  workflow={SUMMARIZE_PAGE_WORKFLOW}
  canAdvance={isStepComplete}
  onComplete={handleComplete}
>
  <YourStepContent />
</WizardShell>
```

**Props:**
| Prop | Type | Description |
|------|------|-------------|
| `workflow` | `WorkflowDefinition` | The workflow definition |
| `children` | `ReactNode` | Step content to render |
| `canAdvance` | `boolean` | Whether user can proceed to next step |
| `onComplete` | `() => void` | Callback when workflow completes |

### WorkflowLanding

The welcome page shown to new users with workflow cards organized by category.

```tsx
import { WorkflowLanding, WorkflowLandingModal } from "@/components/Common/Workflow"

// Inline version
<WorkflowLanding
  onClose={() => {}}
  onJustChat={() => {}}
/>

// Modal version (overlay)
<WorkflowLandingModal />
```

### WorkflowCard

A clickable card representing a single workflow option.

```tsx
import { WorkflowCard } from "@/components/Common/Workflow"

<WorkflowCard
  workflow={SUMMARIZE_PAGE_WORKFLOW}
  onSelect={(workflowId) => startWorkflow(workflowId)}
  isCompleted={hasCompletedBefore}
  disabled={false}
/>
```

### ContextualSuggestion Components

Smart suggestion cards that appear based on user actions.

```tsx
import {
  ContextualSuggestionCard,
  ContextualSuggestionList,
  ContextualSuggestionToast
} from "@/components/Common/Workflow"

// List of suggestions (inline)
<ContextualSuggestionList />

// Single suggestion (floating toast)
<ContextualSuggestionToast />
```

## Store API

The `useWorkflowsStore` hook provides access to workflow state.

### State Selectors

```tsx
import { useWorkflowsStore } from "@/store/workflows"

// Get current state
const showLanding = useWorkflowsStore((s) => s.showLanding)
const activeWorkflow = useWorkflowsStore((s) => s.activeWorkflow)
const isProcessing = useWorkflowsStore((s) => s.isProcessing)
const suggestions = useWorkflowsStore((s) => s.suggestions)
```

### Actions

```tsx
// Landing page
const setShowLanding = useWorkflowsStore((s) => s.setShowLanding)
const dismissLanding = useWorkflowsStore((s) => s.dismissLanding)

// Workflow lifecycle
const startWorkflow = useWorkflowsStore((s) => s.startWorkflow)
const completeWorkflow = useWorkflowsStore((s) => s.completeWorkflow)
const cancelWorkflow = useWorkflowsStore((s) => s.cancelWorkflow)

// Workflow navigation
const setWorkflowStep = useWorkflowsStore((s) => s.setWorkflowStep)
const updateWorkflowData = useWorkflowsStore((s) => s.updateWorkflowData)

// Processing state
const setProcessing = useWorkflowsStore((s) => s.setProcessing)
const setProcessingProgress = useWorkflowsStore((s) => s.setProcessingProgress)

// Suggestions
const addSuggestion = useWorkflowsStore((s) => s.addSuggestion)
const dismissSuggestion = useWorkflowsStore((s) => s.dismissSuggestion)
```

## Creating a New Workflow

### Step 0: Add to WorkflowId Type

First, add your workflow ID to the union type in `src/types/workflows.ts`:

```typescript
export type WorkflowId =
  | "summarize-page"
  | "quick-save"
  // ... existing workflows
  | "my-new-workflow"  // Add your new workflow ID here
```

> **Why?** Without this, TypeScript won't recognize your workflow ID and you'll get type errors.

### Step 1: Define the Workflow

Add to `workflow-definitions.ts`:

```tsx
export const MY_NEW_WORKFLOW: WorkflowDefinition = {
  id: "my-new-workflow",
  category: "content-capture", // or knowledge-qa, media-processing, learning-tools
  labelToken: "workflows:myWorkflow.title",
  descriptionToken: "workflows:myWorkflow.description",
  icon: "FileText", // Lucide icon name
  steps: [
    {
      id: "step1",
      labelToken: "workflows:myWorkflow.steps.step1",
      component: "MyWorkflowStep1",
      autoAdvance: false
    },
    {
      id: "step2",
      labelToken: "workflows:myWorkflow.steps.step2",
      component: "MyWorkflowStep2",
      isOptional: true
    },
    {
      id: "step3",
      labelToken: "workflows:myWorkflow.steps.step3",
      component: "MyWorkflowStep3"
    }
  ],
  triggers: [
    {
      type: "user-action",
      condition: "my-trigger-condition",
      suggestionToken: "workflows:myWorkflow.suggestion"
    }
  ]
}

// Add to ALL_WORKFLOWS array
export const ALL_WORKFLOWS: WorkflowDefinition[] = [
  // ... existing workflows
  MY_NEW_WORKFLOW
]
```

### Step 2: Create the Workflow Component

Create `steps/MyNewWorkflow.tsx`:

```tsx
import React from "react"
import { useTranslation } from "react-i18next"
import { useWorkflowsStore } from "@/store/workflows"
import { WizardShell } from "../WizardShell"
import { MY_NEW_WORKFLOW } from "../workflow-definitions"

export const MyNewWorkflow: React.FC = () => {
  const activeWorkflow = useWorkflowsStore((s) => s.activeWorkflow)

  if (!activeWorkflow || activeWorkflow.workflowId !== "my-new-workflow") {
    return null
  }

  return (
    <WizardShell workflow={MY_NEW_WORKFLOW}>
      <StepContent />
    </WizardShell>
  )
}

const StepContent: React.FC = () => {
  const activeWorkflow = useWorkflowsStore((s) => s.activeWorkflow)
  const stepIndex = activeWorkflow?.currentStepIndex ?? 0

  switch (stepIndex) {
    case 0:
      return <Step1 />
    case 1:
      return <Step2 />
    case 2:
      return <Step3 />
    default:
      return null
  }
}

const Step1: React.FC = () => {
  const { t } = useTranslation(["workflows"])
  const updateWorkflowData = useWorkflowsStore((s) => s.updateWorkflowData)

  // Your step implementation
  return (
    <div>
      <h3>{t("workflows:myWorkflow.steps.step1")}</h3>
      {/* Step content */}
    </div>
  )
}

// ... Step2, Step3
```

### Step 2.5: Export from steps/index.ts

Add your component to the barrel export in `src/components/Common/Workflow/steps/index.ts`:

```typescript
export { SummarizePageWorkflow } from "./SummarizePageWorkflow"
export { QuickSaveWorkflow } from "./QuickSaveWorkflow"
export { MyNewWorkflow } from "./MyNewWorkflow"  // Add this line
```

> **Why?** This allows `WorkflowContainer.tsx` to import your workflow from the `./steps` directory cleanly.

### Step 3: Register in WorkflowContainer

Add to `WorkflowContainer.tsx`:

```tsx
import { MyNewWorkflow } from "./steps/MyNewWorkflow"

const renderWorkflow = () => {
  switch (activeWorkflow.workflowId) {
    case "summarize-page":
      return <SummarizePageWorkflow />
    case "quick-save":
      return <QuickSaveWorkflow />
    case "my-new-workflow":
      return <MyNewWorkflow />
    // ...
  }
}
```

### Step 4: Add Translations

Add to `src/assets/locale/en/workflows.json`:

```json
{
  "myWorkflow": {
    "title": "My New Workflow",
    "description": "Description of what this workflow does",
    "steps": {
      "step1": "First Step",
      "step2": "Second Step",
      "step3": "Third Step"
    },
    "suggestion": "Would you like to try this workflow?"
  }
}
```

### Step 5: Add Contextual Trigger (Optional)

Add to `useWorkflowSuggestions.ts`:

```tsx
const TRIGGER_MAP: Record<TriggerCondition, TriggerConfig> = {
  // ... existing triggers
  "my-trigger-condition": {
    workflowId: "my-new-workflow",
    titleToken: "workflows:suggestions.myTrigger.title",
    descriptionToken: "workflows:suggestions.myTrigger.description",
    priority: "medium"
  }
}
```

### Step 6: Verify Your Workflow

Run the TypeScript compiler to check for errors:

```bash
bun run compile
```

Common errors to watch for:
- `'"my-workflow"' is not assignable to type 'WorkflowId'` → You forgot Step 0
- `Module '"./steps"' has no exported member` → You forgot Step 2.5

Then test manually:
1. Build: `bun run build:chrome`
2. Load the extension in Chrome
3. Open the sidepanel and verify your workflow appears
4. Click through all steps to ensure they work

## Workflow Categories

| Category | Key | Use For |
|----------|-----|---------|
| Content Capture | `content-capture` | Saving, summarizing, ingesting content |
| Knowledge Q&A | `knowledge-qa` | Document upload, RAG chat |
| Media Processing | `media-processing` | Transcription, OCR, media handling |
| Learning Tools | `learning-tools` | Quizzes, flashcards, study aids |

## Available Workflows

| ID | Category | Description |
|----|----------|-------------|
| `summarize-page` | content-capture | Summarize current webpage |
| `quick-save` | content-capture | Save content to notes |
| `upload-ask` | knowledge-qa | Upload docs and ask questions |
| `ask-documents` | knowledge-qa | Chat with knowledge base |
| `transcribe-media` | media-processing | Transcribe video/audio |
| `extract-text` | media-processing | OCR from images |
| `create-quiz` | learning-tools | Generate quiz from content |
| `make-flashcards` | learning-tools | Create study flashcards |

## Contextual Trigger Conditions

| Condition | Triggered When |
|-----------|----------------|
| `pdf-uploaded` | User uploads a PDF file |
| `youtube-url-pasted` | YouTube URL detected |
| `text-selected` | Substantial text selected |
| `summary-viewed` | User views a summary |
| `on-webpage` | User is on any webpage |
| `documents-available` | 3+ docs in knowledge base |

## State Persistence

The workflow system automatically persists:

- **Landing config**: Whether to show landing page, completed workflows
- **Dismissed suggestions**: Which suggestion types user has dismissed

Storage keys:
- `tldw:workflow:landing-config`
- `tldw:workflow:dismissed-suggestions`

## Best Practices

### 1. Use Smart Defaults

Pre-configure sensible options so users can complete workflows with minimal input:

```tsx
// Good: Provide defaults
const style = (activeWorkflow?.data?.summaryStyle as SummaryStyle) || "brief"

// Bad: Require user to choose everything
if (!selectedStyle) {
  throw new Error("Please select a style")
}
```

### 2. Auto-Advance When Possible

Use `autoAdvance: true` for steps that complete automatically:

```tsx
{
  id: "process",
  labelToken: "...",
  component: "ProcessStep",
  autoAdvance: true  // Moves to next step when processing completes
}
```

### 3. Show Progress for Long Operations

```tsx
const setProcessing = useWorkflowsStore((s) => s.setProcessing)
const setProcessingProgress = useWorkflowsStore((s) => s.setProcessingProgress)

setProcessing(true, t("workflows:processing"))
for (let i = 0; i <= 100; i += 10) {
  await doWork()
  setProcessingProgress(i)
}
setProcessing(false)
```

### 4. Handle Errors Gracefully

```tsx
try {
  await riskyOperation()
} catch (error) {
  setWorkflowError(
    error instanceof Error
      ? error.message
      : t("workflows:genericError")
  )
}
```

### 5. Clean Up on Unmount

```tsx
useEffect(() => {
  return () => {
    // Cancel any pending operations
    controller.abort()
  }
}, [])
```

## Internationalization

All user-facing strings use i18n tokens. Add translations to:
- `src/assets/locale/{lang}/workflows.json`

Run `bun run locales:sync` after adding new translations.

## Accessibility

The workflow system includes:

- Keyboard navigation through wizard steps
- ARIA labels on interactive elements
- Focus management between steps
- Screen reader announcements for step changes

## Troubleshooting (Contributors)

Common issues when adding new workflows:

| Symptom | Cause | Fix |
|---------|-------|-----|
| TypeScript error: `'"my-workflow"' is not assignable to type 'WorkflowId'` | Forgot to add ID to type | Add to `WorkflowId` union in `src/types/workflows.ts` |
| Workflow not appearing in landing page | Forgot to add to array | Add to `ALL_WORKFLOWS` in `workflow-definitions.ts` |
| Showing `workflows:myWorkflow.title` instead of text | Missing translations | Add keys to `src/assets/locale/en/workflows.json` |
| "Workflow not implemented yet" message | Missing switch case | Add case to `WorkflowContainer.tsx` |
| `Module '"./steps"' has no exported member` | Missing export | Export from `steps/index.ts` |
| Workflow starts but shows blank content | StepContent switch missing case | Add case for each step index in your StepContent component |
| `Cannot read properties of null` in step | Missing workflow guard | Add `if (!activeWorkflow \|\| activeWorkflow.workflowId !== "...")` check |

### Debugging Tips

1. **Check the console** - Errors often appear in the browser's DevTools console
2. **Verify store state** - Use React DevTools to inspect `useWorkflowsStore` state
3. **Test step by step** - Comment out later steps and test each one individually
4. **Compare with existing** - Reference `SummarizePageWorkflow.tsx` as a working example

## Testing

Workflow components can be tested by:

1. Mocking the Zustand store
2. Rendering individual step components
3. Simulating user interactions

```tsx
import { renderHook, act } from "@testing-library/react"
import { useWorkflowsStore } from "@/store/workflows"

test("starts workflow correctly", () => {
  const { result } = renderHook(() => useWorkflowsStore())

  act(() => {
    result.current.startWorkflow("summarize-page")
  })

  expect(result.current.activeWorkflow?.workflowId).toBe("summarize-page")
  expect(result.current.isWizardOpen).toBe(true)
})
```
