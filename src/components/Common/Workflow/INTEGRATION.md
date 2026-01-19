# Workflow Integration Guide

Quick guide to integrating the Workflow UI Kit into the tldw Assistant sidepanel.

## Option 1: Full Integration (Recommended)

Wrap the sidepanel chat with the workflow integration component.

### Step 1: Modify `src/routes/sidepanel-chat.tsx`

Add the workflow integration wrapper:

```tsx
// Add import at top
import {
  SidepanelWorkflowIntegration,
  WorkflowSuggestionsBar
} from "@/components/Common/Workflow"

// Wrap the return in SidepanelChat component:
return (
  <SidepanelWorkflowIntegration>
    <div className="flex h-dvh w-full" data-testid="chat-workspace">
      {/* ... existing content ... */}
    </div>
  </SidepanelWorkflowIntegration>
)
```

### Step 2: Add Workflow Button to Header

Modify `src/components/Sidepanel/Chat/SidepanelHeaderSimple.tsx`:

```tsx
// Add import
import { WorkflowButton } from "@/components/Common/Workflow"

// Add button next to settings (around line 212):
<div className="flex items-center gap-1">
  <WorkflowButton />  {/* Add this */}
  <Tooltip title={t("sidepanel:header.openFullScreen", "Open Full-Screen")}>
    {/* ... existing buttons ... */}
  </Tooltip>
</div>
```

### Step 3: Add Suggestions to Chat Area (Optional)

To show contextual suggestions above chat messages, add to the chat body:

```tsx
import { WorkflowSuggestionsBar } from "@/components/Common/Workflow"

// In the chat messages area:
<div ref={containerRef} className="...">
  <WorkflowSuggestionsBar />  {/* Add at top */}
  {/* ... existing chat content ... */}
</div>
```

## Option 2: Minimal Integration

Just add the landing modal and button without modifying chat behavior.

### Step 1: Add to App Shell

Modify `src/entries/shared/apps.tsx`:

```tsx
import { WorkflowLandingModal } from "@/components/Common/Workflow"

export const SidepanelApp: React.FC = () => {
  // ... existing code ...

  return (
    <AppShell ...>
      <RouteShell kind="sidepanel" />
      <WorkflowLandingModal />  {/* Add this */}
    </AppShell>
  )
}
```

### Step 2: Add Workflow Button

Same as Option 1, Step 2.

## Option 3: Route-Based Workflows

Add workflows as a separate route in the sidepanel.

### Step 1: Create Route Component

Create `src/routes/sidepanel-workflows.tsx`:

```tsx
import React from "react"
import { WorkflowLanding } from "@/components/Common/Workflow"
import { useNavigate } from "react-router-dom"

const SidepanelWorkflows: React.FC = () => {
  const navigate = useNavigate()

  return (
    <WorkflowLanding
      onClose={() => navigate("/")}
      onJustChat={() => navigate("/")}
    />
  )
}

export default SidepanelWorkflows
```

### Step 2: Add Route

In `src/routes/route-registry.tsx`:

```tsx
const SidepanelWorkflows = lazy(() => import("./sidepanel-workflows"))

// Add to ROUTE_DEFINITIONS:
{
  kind: "sidepanel",
  path: "/workflows",
  element: <SidepanelWorkflows />
}
```

### Step 3: Navigate to Workflows

Add a link/button that navigates to `/workflows`:

```tsx
import { Link } from "react-router-dom"
import { Wand2 } from "lucide-react"

<Link to="/workflows" className="...">
  <Wand2 className="size-4" />
</Link>
```

## Triggering Suggestions from Existing Code

### On File Upload

```tsx
import { useWorkflowSuggestions } from "@/hooks/useWorkflowSuggestions"

const FileUploader = () => {
  const { triggerSuggestion } = useWorkflowSuggestions()

  const handleUpload = (file: File) => {
    // ... upload logic ...

    if (file.type === "application/pdf") {
      triggerSuggestion("pdf-uploaded", { filename: file.name })
    }
  }
}
```

### On URL Detection

```tsx
const { checkClipboard } = useClipboardWorkflowDetection()

const handlePaste = async (e: ClipboardEvent) => {
  const text = e.clipboardData?.getData("text")
  if (text) {
    await checkClipboard(text)  // Auto-detects YouTube URLs, etc.
  }
}
```

### After Summary Generation

```tsx
const { suggestAfterSummary } = usePostActionSuggestions()

const handleSummaryComplete = (summary: string) => {
  // ... display summary ...
  suggestAfterSummary()  // Suggests creating a quiz
}
```

## Testing the Integration

1. Build the extension:
   ```bash
   bun run build:chrome
   ```

2. Load unpacked extension from `.output/chrome-mv3/`

3. Open the sidepanel and verify:
   - Workflow button appears in header
   - Clicking button shows landing page
   - Selecting a workflow opens the wizard
   - Completing/canceling returns to chat

## Troubleshooting

### Landing Page Not Showing

Check if `showLanding` is false:
```tsx
const showLanding = useWorkflowsStore((s) => s.showLanding)
console.log("Show landing:", showLanding)
```

Reset landing config:
```tsx
chrome.storage.local.remove("tldw:workflow:landing-config")
```

### Workflow Button Not Visible

Ensure the import path is correct:
```tsx
import { WorkflowButton } from "@/components/Common/Workflow"
```

### Suggestions Not Appearing

Check if suggestions are being added:
```tsx
const suggestions = useWorkflowsStore((s) => s.suggestions)
console.log("Suggestions:", suggestions)
```

Check dismissed suggestions:
```tsx
const dismissed = useWorkflowsStore((s) => s.dismissedSuggestionIds)
console.log("Dismissed:", dismissed)
```

## Feature Flags (Optional)

Add a feature flag to control workflow visibility:

```tsx
// In connection store or settings
const SHOW_WORKFLOWS = true  // or from feature flags

// In header
{SHOW_WORKFLOWS && <WorkflowButton />}
```
